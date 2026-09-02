// Genera le icone dell'applicazione installabile a partire da brand/logo.png.
//
// Perche' scritto a mano invece di usare una libreria: ADR-0006 tiene un elenco
// chiuso di dipendenze, e una libreria di immagini non e' fra quelle autorizzate
// per questa fase. Qui servono solo lettura, riduzione e scrittura di PNG, che
// Node sa gia' fare con zlib. Si esegue una volta: `npm run icone`.
//
// Uscita: public/icona-192.png, icona-512.png, icona-maskable-512.png,
//         apple-touch-icon.png, favicon.png

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const qui = dirname(fileURLToPath(import.meta.url))
const sorgente = join(qui, '..', '..', 'brand', 'logo.png')
const cartellaUscita = join(qui, '..', 'public')

// Il fondo delle icone e' il verde notte del design system.
const SFONDO = [0x08, 0x2b, 0x1d]

// ─── Lettura PNG (8 bit, RGBA o RGB, non interlacciato) ─────────────────────

function leggiPng(percorso) {
  const buf = readFileSync(percorso)
  let p = 8
  let ihdr = null
  const pezziDati = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const tipo = buf.toString('ascii', p + 4, p + 8)
    const dati = buf.subarray(p + 8, p + 8 + len)
    if (tipo === 'IHDR') {
      ihdr = {
        w: dati.readUInt32BE(0),
        h: dati.readUInt32BE(4),
        profondita: dati[8],
        colore: dati[9],
        interlacciato: dati[12],
      }
    }
    if (tipo === 'IDAT') pezziDati.push(dati)
    if (tipo === 'IEND') break
    p += 12 + len
  }
  if (!ihdr) throw new Error('PNG senza intestazione IHDR')
  if (ihdr.profondita !== 8 || ihdr.interlacciato !== 0) {
    throw new Error(`PNG non gestito: profondita ${ihdr.profondita}, interlacciato ${ihdr.interlacciato}`)
  }
  const canali = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colore]
  if (!canali) throw new Error(`Tipo di colore non gestito: ${ihdr.colore}`)

  const grezzi = zlib.inflateSync(Buffer.concat(pezziDati))
  const passo = ihdr.w * canali
  const out = Buffer.alloc(ihdr.h * passo)
  let pos = 0
  for (let y = 0; y < ihdr.h; y++) {
    const filtro = grezzi[pos++]
    const riga = grezzi.subarray(pos, pos + passo)
    pos += passo
    for (let x = 0; x < passo; x++) {
      const a = x >= canali ? out[y * passo + x - canali] : 0
      const b = y > 0 ? out[(y - 1) * passo + x] : 0
      const c = x >= canali && y > 0 ? out[(y - 1) * passo + x - canali] : 0
      let v = riga[x]
      switch (filtro) {
        case 0: break
        case 1: v = (v + a) & 255; break
        case 2: v = (v + b) & 255; break
        case 3: v = (v + ((a + b) >> 1)) & 255; break
        case 4: {
          const pa = Math.abs(b - c)
          const pb = Math.abs(a - c)
          const pc = Math.abs(a + b - 2 * c)
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
          break
        }
        default: throw new Error(`Filtro PNG sconosciuto: ${filtro}`)
      }
      out[y * passo + x] = v
    }
  }
  return { larghezza: ihdr.w, altezza: ihdr.h, canali, pixel: out }
}

// ─── Scrittura PNG a colori pieni, senza trasparenza ────────────────────────

const tabellaCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = tabellaCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pezzo(tipo, dati) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(dati.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dati])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([len, corpo, crc])
}

function scriviPng(percorso, lato, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lato, 0)
  ihdr.writeUInt32BE(lato, 4)
  ihdr[8] = 8 // profondita
  ihdr[9] = 2 // colore: RGB
  const passo = lato * 3
  const conFiltro = Buffer.alloc(lato * (passo + 1))
  for (let y = 0; y < lato; y++) {
    conFiltro[y * (passo + 1)] = 0
    rgb.copy(conFiltro, y * (passo + 1) + 1, y * passo, (y + 1) * passo)
  }
  const file = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pezzo('IHDR', ihdr),
    pezzo('IDAT', zlib.deflateSync(conFiltro, { level: 9 })),
    pezzo('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(percorso, file)
  return file.length
}

// ─── Riduzione con media dei pixel, sopra il fondo verde ────────────────────

function generaIcona(sorgenteImg, lato, margineRelativo) {
  const { larghezza: sw, altezza: sh, canali, pixel } = sorgenteImg
  const margine = Math.round(lato * margineRelativo)
  const spazio = lato - margine * 2
  const scala = Math.min(spazio / sw, spazio / sh)
  const dw = Math.max(1, Math.round(sw * scala))
  const dh = Math.max(1, Math.round(sh * scala))
  const offX = Math.round((lato - dw) / 2)
  const offY = Math.round((lato - dh) / 2)

  const out = Buffer.alloc(lato * lato * 3)
  for (let i = 0; i < lato * lato; i++) {
    out[i * 3] = SFONDO[0]
    out[i * 3 + 1] = SFONDO[1]
    out[i * 3 + 2] = SFONDO[2]
  }

  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw))
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * canali
          const a = canali === 4 ? pixel[i + 3] / 255 : 1
          sr += pixel[i] * a
          sg += pixel[i + 1] * a
          sb += pixel[i + 2] * a
          sa += a
          n++
        }
      }
      // Media pesata sull'opacita', poi composizione sul fondo.
      const alpha = sa / n
      const r = sa > 0 ? sr / sa : 0
      const g = sa > 0 ? sg / sa : 0
      const b = sa > 0 ? sb / sa : 0
      const d = ((y + offY) * lato + (x + offX)) * 3
      out[d] = Math.round(r * alpha + SFONDO[0] * (1 - alpha))
      out[d + 1] = Math.round(g * alpha + SFONDO[1] * (1 - alpha))
      out[d + 2] = Math.round(b * alpha + SFONDO[2] * (1 - alpha))
    }
  }
  return out
}

// ─── Esecuzione ─────────────────────────────────────────────────────────────

const logo = leggiPng(sorgente)
console.log(`Logo letto: ${logo.larghezza}x${logo.altezza}, ${logo.canali} canali`)
mkdirSync(cartellaUscita, { recursive: true })

// Il margine maskable e' piu' largo perche' Android ritaglia un cerchio.
const daGenerare = [
  ['icona-192.png', 192, 0.06],
  ['icona-512.png', 512, 0.06],
  ['icona-maskable-512.png', 512, 0.18],
  ['apple-touch-icon.png', 180, 0.08],
  ['favicon.png', 64, 0.04],
]

for (const [nome, lato, margine] of daGenerare) {
  const byte = scriviPng(join(cartellaUscita, nome), lato, generaIcona(logo, lato, margine))
  console.log(`  ${nome.padEnd(26)} ${String(lato).padStart(3)}px  ${(byte / 1024).toFixed(1)} KB`)
}
console.log('Icone generate in public/')
