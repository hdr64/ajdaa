import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

interface TotpQrCodeProps {
  /** The `otpauth://` payload to encode. */
  uri: string;
  alt: string;
  /** Rendered square size in pixels. */
  size?: number;
}

/**
 * Renders an `otpauth://` URI as a QR image. Shared by the login-time enrollment
 * step and the profile 2FA card so both encode the secret identically, and falls
 * back to a placeholder rather than a broken image if encoding fails.
 */
export const TotpQrCode: React.FC<TotpQrCodeProps> = ({ uri, alt, size = 220 }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    setDataUrl('');
    QRCode.toDataURL(uri, { margin: 1, width: size })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [uri, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-xl bg-canvas border border-muted-border/40 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <QrCode className="w-10 h-10 text-neutral-text/40" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className="rounded-xl bg-white p-2 border border-muted-border/40"
    />
  );
};
