// Conjunto final do logo OLAKI, opção A (caixa alta): claro, escuro, ícones. Caminhos reais, sem fontes externas.
import opentype from 'opentype.js'
import { writeFileSync, mkdirSync } from 'node:fs'
const FONTS = '../fonts-logo/'
const BER = '#4B1248', LAR = '#FF6A13', WHT = '#FFFFFF'
mkdirSync('final', { recursive: true })
const f2 = (n) => Number(n.toFixed(2))
const bold = opentype.loadSync(FONTS + 'Poppins-Bold.ttf')
const regular = opentype.loadSync(FONTS + 'Poppins-Regular.ttf')
const capH = (font, size) => (font.tables.os2.sCapHeight / font.unitsPerEm) * size

// Pin do logo atual, parametrizado pelo raio R; a ponta fica em (cx, tipY).
function pin(cx, tipY, R) {
  const cy = tipY - 1.778 * R
  const d = `M${f2(cx)} ${f2(tipY)} C${f2(cx - 0.35 * R)} ${f2(tipY - 0.778 * R)} ${f2(cx - R)} ${f2(tipY - 1.228 * R)} ${f2(cx - R)} ${f2(cy)} A${f2(R)} ${f2(R)} 0 1 1 ${f2(cx + R)} ${f2(cy)} C${f2(cx + R)} ${f2(tipY - 1.228 * R)} ${f2(cx + 0.35 * R)} ${f2(tipY - 0.778 * R)} ${f2(cx)} ${f2(tipY)}Z`
  return { d, cx, cy, r: 0.42 * R, top: cy - R, left: cx - R, right: cx + R }
}

// Glifos de um texto, com kerning, a partir de (x, baseline).
function glyphs(font, text, x, y, size) {
  const out = []
  font.forEachGlyph(text, x, y, size, { kerning: true }, (g, gx, gy, gs) => {
    const p = g.getPath(gx, gy, gs)
    out.push({ d: p.toPathData(2), bb: p.getBoundingBox() })
  })
  return out
}
const width = (font, text, size) => font.getAdvanceWidth(text, size, { kerning: true })
const paths = (fill, list) => `<g fill="${fill}">${list.map((g) => `<path d="${g.d}"/>`).join('')}</g>`

// Logotipo 435×220: OLAKI + pin no I + tagline. Mesma caixa dos arquivos atuais.
function wordmark({ dark }) {
  const W = 435, H = 220
  const size = 380 / width(bold, 'OLAKI', 1)
  const cH = capH(bold, size)
  const R = 0.2 * cH
  const pinBlock = 3.26 * R // do topo do pin até o topo do I (0,48R de folga + 1,778R + R)
  const top = 6
  const base = top + pinBlock + cH
  const x0 = (W - 380) / 2
  const g = glyphs(bold, 'OLAKI', x0, base, size)
  const I = g[4].bb
  const p = pin((I.x1 + I.x2) / 2, I.y1 - 0.48 * R, R)
  const tagSize = 377 / width(regular, 'olha aqui o que você procura', 1)
  const tagTop = base + 24
  const asc = (regular.tables.os2.sTypoAscender / regular.unitsPerEm) * tagSize
  const tagBase = tagTop + capH(regular, tagSize)
  const tag = glyphs(regular, 'olha aqui o que você procura', (W - 377) / 2, tagBase, tagSize)
  const tagBottom = Math.max(...tag.map((t) => t.bb.y2))
  console.log(`wordmark: size ${size.toFixed(1)} capH ${cH.toFixed(1)} R ${R.toFixed(1)} pinTop ${p.top.toFixed(1)} base ${base.toFixed(1)} tag ${tagSize.toFixed(1)}px top ${tagTop.toFixed(1)} bottom ${tagBottom.toFixed(1)} pinRight ${p.right.toFixed(1)} asc ${asc.toFixed(1)}`)
  const ink = dark ? WHT : BER
  const hole = dark ? BER : WHT
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${dark ? `<rect width="${W}" height="${H}" fill="${BER}"/>` : ''}${paths(ink, g.slice(0, 2))}${paths(LAR, g.slice(2))}
<path fill="${LAR}" d="${p.d}"/><circle cx="${f2(p.cx)}" cy="${f2(p.cy)}" r="${f2(p.r)}" fill="${hole}"/>
${paths(ink, tag)}
</svg>
`
}

// Ícone 512×512 (fundo laranja, raio 112). Variante 1: "O" + "I" com o pin. Variante 2: "O" com o pin dentro.
function icon({ variant, rx = 112 }) {
  const S = 512
  let body = ''
  if (variant === 'AKI') {
    const size = 160 / (bold.tables.os2.sCapHeight / bold.unitsPerEm)
    const cH = capH(bold, size)
    const R = 0.2 * cH
    const w = width(bold, 'AKI', size)
    const total = 3.26 * R + cH
    const base = (S - total) / 2 + 3.26 * R + cH
    const g = glyphs(bold, 'AKI', (S - w) / 2, base, size)
    const I = g[2].bb
    const p = pin((I.x1 + I.x2) / 2, I.y1 - 0.48 * R, R)
    body = `${paths(WHT, g)}<path fill="${BER}" d="${p.d}"/><circle cx="${f2(p.cx)}" cy="${f2(p.cy)}" r="${f2(p.r)}" fill="${LAR}"/>`
  } else if (variant === 'O') {
    const size = 280 / (bold.tables.os2.sCapHeight / bold.unitsPerEm)
    const cH = capH(bold, size)
    const w = width(bold, 'O', size)
    const g = glyphs(bold, 'O', (S - w) / 2, (S + cH) / 2, size)
    body = paths(WHT, g)
  } else if (variant === 1) {
    const size = 190 / (bold.tables.os2.sCapHeight / bold.unitsPerEm)
    const cH = capH(bold, size)
    const R = 0.2 * cH
    const w = width(bold, 'OI', size)
    const total = 3.26 * R + cH
    const base = (S - total) / 2 + 3.26 * R + cH
    const g = glyphs(bold, 'OI', (S - w) / 2, base, size)
    const I = g[1].bb
    const p = pin((I.x1 + I.x2) / 2, I.y1 - 0.48 * R, R)
    body = `${paths(WHT, g)}<path fill="${BER}" d="${p.d}"/><circle cx="${f2(p.cx)}" cy="${f2(p.cy)}" r="${f2(p.r)}" fill="${LAR}"/>`
  } else {
    const size = 250 / (bold.tables.os2.sCapHeight / bold.unitsPerEm)
    const cH = capH(bold, size)
    const w = width(bold, 'O', size)
    const base = (S + cH) / 2
    const g = glyphs(bold, 'O', (S - w) / 2, base, size)
    const R = 0.19 * cH
    const cx = S / 2
    const centerY = base - cH / 2
    const h = 3.26 * R - 0.48 * R // altura visível do pin (ponta até o topo)
    const p = pin(cx, centerY + h / 2, R)
    body = `${paths(WHT, g)}<path fill="${BER}" d="${p.d}"/><circle cx="${f2(p.cx)}" cy="${f2(p.cy)}" r="${f2(p.r)}" fill="${LAR}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<rect width="${S}" height="${S}" rx="${rx}" fill="${LAR}"/>${body}
</svg>
`
}

writeFileSync('final/olaki-opcao1-pin.svg', wordmark({ dark: false }))
writeFileSync('final/olaki-opcao1-pin-fundo-escuro.svg', wordmark({ dark: true }))
writeFileSync('final/icone-AKI.svg', icon({ variant: 'AKI' }))
writeFileSync('final/icone-O.svg', icon({ variant: 'O' }))
writeFileSync('final/icone-v2-O-pin.svg', icon({ variant: 2 }))
writeFileSync('final/icone-v2-O-pin-quadrado.svg', icon({ variant: 2, rx: 0 }))
console.log('ok final/')
