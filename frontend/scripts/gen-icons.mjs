// Generates PWA PNG icons with zero dependencies (pure Node + zlib).
// Draws the SafeHold mark: dark rounded square, red circle, white "!".
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dir, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // filter byte 0 per row
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const radius = maskable ? size * 0.42 : size * 0.3 // circle radius
  const corner = size * 0.19 // rounded-square corner radius (for non-maskable)
  const barW = size * 0.045
  const barTop = cy - radius * 0.55
  const barBot = cy + radius * 0.12
  const dotY = cy + radius * 0.42
  const dotR = size * 0.05

  const set = (x, y, r, g, b) => {
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = 255
  }

  const inRoundedSquare = (x, y) => {
    if (maskable) return true // full bleed
    const rx = Math.max(corner - x, x - (size - corner), 0)
    const ry = Math.max(corner - y, y - (size - corner), 0)
    return rx * rx + ry * ry <= corner * corner
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedSquare(x, y)) {
        // transparent outside rounded square
        continue
      }
      // default dark background
      let r = 11, g = 11, b = 15
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= radius * radius) {
        r = 225; g = 29; b = 42 // red circle
        // white exclamation bar
        if (Math.abs(dx) <= barW && y >= barTop && y <= barBot) {
          r = 255; g = 255; b = 255
        }
        // white dot
        if (dx * dx + (y - dotY) * (y - dotY) <= dotR * dotR) {
          r = 255; g = 255; b = 255
        }
      }
      set(x, y, r, g, b)
    }
  }
  return encodePNG(size, size, px)
}

writeFileSync(join(outDir, 'icon-192.png'), draw(192))
writeFileSync(join(outDir, 'icon-512.png'), draw(512))
writeFileSync(join(outDir, 'icon-512-maskable.png'), draw(512, { maskable: true }))
console.log('Icons written to', outDir)
