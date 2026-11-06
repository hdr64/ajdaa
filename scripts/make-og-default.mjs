// Builds public/og-default.png (1200x630): the logo centred on the brand background.
// Run once: node scripts/make-og-default.mjs  (uses sharp from server/node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(root, 'server', 'package.json'))('sharp');

const logo = await sharp(path.join(root, 'public', 'logo.png')).resize({ width: 640 }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#f6f8fa' } })
  .composite([{ input: logo, gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, 'public', 'og-default.png'));
console.log('public/og-default.png written');
