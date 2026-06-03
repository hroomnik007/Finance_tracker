import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

const input = process.argv[2]
if (!input) {
  console.error('Usage: node scripts/generate-icons.mjs <path-to-logo>')
  process.exit(1)
}

const sizes = [
  { file: 'icons/icon-72.png',   size: 72  },
  { file: 'icons/icon-96.png',   size: 96  },
  { file: 'icons/icon-128.png',  size: 128 },
  { file: 'icons/icon-144.png',  size: 144 },
  { file: 'icons/icon-152.png',  size: 152 },
  { file: 'icons/icon-192.png',  size: 192 },
  { file: 'icons/icon-384.png',  size: 384 },
  { file: 'icons/icon-512.png',  size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32x32.png',    size: 32  },
  { file: 'favicon-16x16.png',    size: 16  },
]

for (const { file, size } of sizes) {
  const out = resolve(publicDir, file)
  await sharp(input)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(out)
  console.log(`✓ ${file} (${size}×${size})`)
}

console.log('\nAll icons generated.')
