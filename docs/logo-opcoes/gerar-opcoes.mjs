// Gera opções do logo OLAKI como SVG com caminhos reais (sem depender de fonte instalada).
import opentype from 'opentype.js'
import { writeFileSync, mkdirSync } from 'node:fs'
const FONTS = '../fonts-logo/'
const BER = '#4B1248', LAR = '#FF6A13'
mkdirSync('out', { recursive: true })

// O pin do logo atual (public/logo/olaki-opcao1-pin.svg), parametrizado pelo raio R.
function pin(cx, tipY, R) {
  const cy = tipY - 1.778 * R
  const f = (n) => n.toFixed(2)
  const d = `M${f(cx)} ${f(tipY)} C${f(cx - 0.35 * R)} ${f(tipY - 0.778 * R)} ${f(cx - R)} ${f(tipY - 1.228 * R)} ${f(cx - R)} ${f(cy)} A${f(R)} ${f(R)} 0 1 1 ${f(cx + R)} ${f(cy)} C${f(cx + R)} ${f(tipY - 1.228 * R)} ${f(cx + 0.35 * R)} ${f(tipY - 0.778 * R)} ${f(cx)} ${f(tipY)}Z`
  return { d, cx, cy, r: 0.42 * R, top: cy - R }
}

function make({ name, font, text, size = 160, upper }) {
  const f = opentype.loadSync(FONTS + font)
  const glyphs = []
  f.forEachGlyph(text, 0, 0, size, { kerning: true }, (g, x, y, s) => glyphs.push({ g, x, y, s }))
  const paths = glyphs.map(({ g, x, y, s }, i) => ({ d: g.getPath(x, y, s).toPathData(2), color: i < 2 ? BER : LAR, bb: g.getPath(x, y, s).getBoundingBox() }))
  const last = paths[paths.length - 1].bb // o I / ı
  const scale = size / f.unitsPerEm
  const capH = (f.tables.os2.sCapHeight || 700) * scale
  const xH = (f.tables.os2.sxHeight || 500) * scale
  const R = upper ? 0.22 * capH : 0.265 * xH
  const cx = (last.x1 + last.x2) / 2
  const p = pin(cx, last.y1 - 0.48 * R, R)
  const xs = paths.flatMap((q) => [q.bb.x1, q.bb.x2]).concat([p.cx - R, p.cx + R])
  const ys = paths.flatMap((q) => [q.bb.y1, q.bb.y2]).concat([p.top])
  const pad = 24
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
  const w = (maxX - minX).toFixed(2), h = (maxY - minY).toFixed(2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${w} ${h}" width="${w}" height="${h}">
<g fill="${BER}">${paths.filter((q) => q.color === BER).map((q) => `<path d="${q.d}"/>`).join('')}</g>
<g fill="${LAR}">${paths.filter((q) => q.color === LAR).map((q) => `<path d="${q.d}"/>`).join('')}</g>
<path fill="${LAR}" d="${p.d}"/><circle cx="${p.cx.toFixed(2)}" cy="${p.cy.toFixed(2)}" r="${p.r.toFixed(2)}" fill="#fff"/>
</svg>
`
  writeFileSync(`out/${name}.svg`, svg)
  console.log(name, f.names.fullName.en, 'viewBox', w, 'x', h, 'glifo final', text.at(-1), 'ok')
}

make({ name: 'opcao-A-caixa-alta-poppins', font: 'Poppins-Bold.ttf', text: 'OLAKI', upper: true })
make({ name: 'opcao-B-minusculo-atkinson', font: 'AtkinsonHyperlegible-Bold.ttf', text: 'olakı' })
make({ name: 'opcao-C-minusculo-ubuntu', font: 'Ubuntu-Bold.ttf', text: 'olakı' })
make({ name: 'opcao-D-minusculo-poppins-bold', font: 'Poppins-Bold.ttf', text: 'olakı' })
