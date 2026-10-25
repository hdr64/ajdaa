import { describe, expect, it } from 'vitest';
import {
  buildOtpAuthUri,
  decodeBase32,
  formatSecretForDisplay,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  totpCodeAt,
  verifyRecoveryCode,
  verifyTotp,
} from '../src/services/totpService.js';

/**
 * The TOTP service is pure and dependency-free, so it is exercised directly
 * against the published RFC 6238 vectors rather than only through the routes.
 */

/** RFC 4226/6238 SHA-1 test secret: the ASCII string "12345678901234567890". */
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_SECRET_ASCII = '12345678901234567890';

/**
 * RFC 6238 Appendix B, HMAC-SHA1 column, with the 8-digit values reduced to the
 * trailing six digits because this service is fixed at 6 digits.
 */
const RFC_VECTORS: { unixSeconds: number; eightDigits: string }[] = [
  { unixSeconds: 59, eightDigits: '94287082' },
  { unixSeconds: 1111111109, eightDigits: '07081804' },
  { unixSeconds: 1111111111, eightDigits: '14050471' },
  { unixSeconds: 1234567890, eightDigits: '89005924' },
  { unixSeconds: 2000000000, eightDigits: '69279037' },
  { unixSeconds: 20000000000, eightDigits: '65353130' },
];

describe('base32', () => {
  it('decodes the RFC test secret back to its ASCII bytes', () => {
    expect(decodeBase32(RFC_SECRET_BASE32)?.toString('utf8')).toBe(RFC_SECRET_ASCII);
  });

  it('round-trips a generated secret through decode to exactly 20 bytes', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(decodeBase32(secret)).toHaveLength(20);
  });

  it('generates a different secret every time', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateTotpSecret()));
    expect(seen.size).toBe(20);
  });

  it('rejects characters outside the alphabet, padding and an empty string', () => {
    expect(decodeBase32('')).toBeNull();
    expect(decodeBase32('ABC1')).toBeNull(); // '1' is not in the alphabet
    expect(decodeBase32('ABC=')).toBeNull();
    expect(decodeBase32('abc!')).toBeNull();
  });
});

describe('RFC 6238 vectors', () => {
  it.each(RFC_VECTORS)('T=$unixSeconds yields the expected six digits', ({ unixSeconds, eightDigits }) => {
    expect(totpCodeAt(RFC_SECRET_BASE32, unixSeconds)).toBe(eightDigits.slice(-6));
  });

  it('returns null for a secret that is not base32', () => {
    expect(totpCodeAt('not-base32!', 59)).toBeNull();
  });
});

describe('verifyTotp', () => {
  const secret = RFC_SECRET_BASE32;
  // A fixed instant inside a step: 1234567890 is step 41152263.
  const instantMs = 1234567890 * 1000;
  const currentCode = totpCodeAt(secret, 1234567890)!;

  it('accepts the current code and reports the matched step', () => {
    expect(verifyTotp(secret, currentCode, instantMs)).toBe(Math.floor(1234567890 / 30));
  });

  it('accepts the previous step (clock a little behind)', () => {
    const previous = totpCodeAt(secret, 1234567890 - 30)!;
    expect(previous).not.toBe(currentCode);
    expect(verifyTotp(secret, previous, instantMs)).toBe(Math.floor(1234567890 / 30) - 1);
  });

  it('accepts the next step (clock a little ahead)', () => {
    const next = totpCodeAt(secret, 1234567890 + 30)!;
    expect(verifyTotp(secret, next, instantMs)).toBe(Math.floor(1234567890 / 30) + 1);
  });

  it('rejects a code two steps away, i.e. the window is exactly ±1', () => {
    const tooOld = totpCodeAt(secret, 1234567890 - 60)!;
    const tooNew = totpCodeAt(secret, 1234567890 + 60)!;
    expect(verifyTotp(secret, tooOld, instantMs)).toBeNull();
    expect(verifyTotp(secret, tooNew, instantMs)).toBeNull();
  });

  it('rejects a wrong code of the right shape', () => {
    // 000000 cannot be produced by this secret at any nearby step in practice;
    // assert it against the real codes to be certain.
    expect([currentCode, totpCodeAt(secret, 1234567890 - 30), totpCodeAt(secret, 1234567890 + 30)]).not.toContain(
      '000000'
    );
    expect(verifyTotp(secret, '000000', instantMs)).toBeNull();
  });

  it('returns null (rather than throwing) for non-numeric or wrong-length input', () => {
    expect(verifyTotp(secret, '', instantMs)).toBeNull();
    expect(verifyTotp(secret, '12345', instantMs)).toBeNull();
    expect(verifyTotp(secret, '1234567', instantMs)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', instantMs)).toBeNull();
    expect(verifyTotp(secret, '12 456', instantMs)).toBeNull();
  });

  it('returns null when the stored secret is unusable', () => {
    expect(verifyTotp('not base32', currentCode, instantMs)).toBeNull();
  });
});

describe('buildOtpAuthUri', () => {
  it('advertises the exact parameters authenticator apps must use', () => {
    const uri = buildOtpAuthUri(RFC_SECRET_BASE32, 'Ajda', 'admin@ajdaa.sa');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    const parsed = new URL(uri);
    expect(parsed.searchParams.get('secret')).toBe(RFC_SECRET_BASE32);
    expect(parsed.searchParams.get('issuer')).toBe('Ajda');
    expect(parsed.searchParams.get('algorithm')).toBe('SHA1');
    expect(parsed.searchParams.get('digits')).toBe('6');
    expect(parsed.searchParams.get('period')).toBe('30');
    expect(decodeURIComponent(parsed.pathname)).toContain('Ajda:admin@ajdaa.sa');
  });
});

describe('formatSecretForDisplay', () => {
  it('groups the secret in fours for hand entry', () => {
    expect(formatSecretForDisplay('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567')).toBe(
      'ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567'
    );
  });

  it('leaves a short secret untouched', () => {
    expect(formatSecretForDisplay('ABC')).toBe('ABC');
  });
});

describe('recovery codes', () => {
  it('mints ten `XXXXX-XXXXX` codes from an unambiguous alphabet', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
      // The letters and digits that are easy to misread are excluded.
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('hashes deterministically, differently per code, and never stores the code itself', () => {
    const [first, second] = generateRecoveryCodes();
    const firstHash = hashRecoveryCode(first);
    expect(firstHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRecoveryCode(first)).toBe(firstHash);
    expect(hashRecoveryCode(second)).not.toBe(firstHash);
    expect(firstHash).not.toContain(first.replace('-', ''));
  });

  it('verifies the right code regardless of case, spaces and dashes, and rejects others', () => {
    const [code, other] = generateRecoveryCodes();
    const hash = hashRecoveryCode(code);
    expect(verifyRecoveryCode(hash, code)).toBe(true);
    expect(verifyRecoveryCode(hash, code.toLowerCase())).toBe(true);
    expect(verifyRecoveryCode(hash, code.replace('-', ''))).toBe(true);
    expect(verifyRecoveryCode(hash, `  ${code}  `)).toBe(true);
    expect(verifyRecoveryCode(hash, other)).toBe(false);
    expect(verifyRecoveryCode(hash, 'WRONG-WRONG')).toBe(false);
  });

  it('returns false, not an exception, for a malformed stored hash', () => {
    const [code] = generateRecoveryCodes();
    expect(verifyRecoveryCode('', code)).toBe(false);
    expect(verifyRecoveryCode('zzzz', code)).toBe(false);
    expect(verifyRecoveryCode('ab', code)).toBe(false);
  });
});
