// Gera a identidade do Mercado da Região: símbolo (M + pin), logotipos, ícones. Texto em caminhos (Figtree), sem fonte externa.
// Decisão de 14/11/2026 (DESIGN.md, seção 6): nome em uma linha, todo na cor da tinta (beringela ou branco); o laranja fica só no pin.
// Uso: FONTS=pasta/com/Figtree-*.ttf/ OUT=pasta/de/saida node docs/marca/gerar-logos.mjs (precisa do pacote opentype.js).
import opentype from 'opentype.js'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
const carregar = (c) => { const b = readFileSync(c); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
const FONTS = process.env.FONTS || './'
const OUT = process.env.OUT || 'saida'
const BER = '#4B1248', LAR = '#FF6A13', WHT = '#FFFFFF'
mkdirSync(OUT, { recursive: true })
const f2 = (n) => Number(n.toFixed(2))
const bold = carregar(FONTS + 'Figtree-Bold.ttf')
const regular = carregar(FONTS + 'Figtree-Regular.ttf')
const semi = carregar(FONTS + 'Figtree-SemiBold.ttf')
const NOME = 'Mercado da Região'
const capH = (font, size) => (font.tables.os2.sCapHeight / font.unitsPerEm) * size
const width = (font, text, size, ls = 0) => font.getAdvanceWidth(text, size, { kerning: true }) + ls * (text.length - 1)
function texto(font, text, x, y, size, fill, ls = 0) {
  let out = '', cx = x
  if (!ls) return `<path fill="${fill}" d="${font.getPath(text, x, y, size, { kerning: true }).toPathData(2)}"/>`
  for (const ch of text) { out += font.getPath(ch, cx, y, size).toPathData(2); cx += font.getAdvanceWidth(ch, size) + ls }
  return `<path fill="${fill}" d="${out}"/>`
}

// Símbolo: M de "Mercado" com o pin da "Região" pousando no meio. Caixa de 100 x 128 (pin sobe 28 acima do M).
// (x, y) = canto de cima à esquerda da caixa; s = escala (altura total = 128*s).
function simbolo(x, y, s, { m = BER, pin = LAR, furo = WHT } = {}) {
  const X = (v) => f2(x + v * s), Y = (v) => f2(y + (v + 28) * s)
  const t = 23
  const M = `<path fill="none" stroke="${m}" stroke-width="${f2(t * s)}" stroke-linejoin="round" stroke-linecap="round" d="M${X(11.5)} ${Y(88.5)}V${Y(11.5)}L${X(50)} ${Y(66)}L${X(88.5)} ${Y(11.5)}V${Y(88.5)}"/>`
  const R = 19, cy = -9, tip = 33
  const P = `<path fill="${pin}" d="M${X(50)} ${Y(tip)}C${X(50 - 0.4 * R)} ${Y(tip - 0.75 * R)} ${X(50 - R)} ${Y(cy + 0.62 * R)} ${X(50 - R)} ${Y(cy)}A${f2(R * s)} ${f2(R * s)} 0 1 1 ${X(50 + R)} ${Y(cy)}C${X(50 + R)} ${Y(cy + 0.62 * R)} ${X(50 + 0.4 * R)} ${Y(tip - 0.75 * R)} ${X(50)} ${Y(tip)}Z"/><circle cx="${X(50)}" cy="${Y(cy)}" r="${f2(7.2 * s)}" fill="${furo}"/>`
  return M + P
}
const svg = (W, H, corpo, fundo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mercado da Região">\n${fundo ? `<rect width="${W}" height="${H}" fill="${fundo}"/>` : ''}${corpo}\n</svg>\n`
const TAG = 'aqui a sua cidade aparece'

// Marca horizontal: símbolo + "Mercado da Região" numa linha, centrado na altura do M. Com ou sem a frase.
function marca({ dark, tag, cidade, s = 1 }) {
  const pad = dark ? 20 : 4
  const size = 62 * s
  const cH = capH(bold, size)
  const gap = 20 * s
  const tx = pad + 100 * s + gap
  const base = pad + (28 + 50) * s + cH / 2   // meio da letra maiúscula no meio do M
  const w = width(bold, NOME, size)
  let W = Math.ceil(tx + w + pad + 2), H = Math.ceil(pad + 128 * s + pad)
  const ink = dark ? WHT : BER
  let corpo = simbolo(pad, pad, s, { m: ink, furo: dark ? BER : WHT }) + texto(bold, NOME, tx, base, size, ink)
  if (tag || cidade) {
    const t = cidade ? cidade.toUpperCase() : TAG
    const font = cidade ? semi : regular
    const ls = cidade ? 5 : 0
    const ts = cidade ? 22 : w / width(regular, TAG, 1)
    if (cidade) {
      corpo += `<rect x="${pad}" y="${H + 4}" width="${W - 2 * pad}" height="2" fill="${dark ? '#7A3F76' : '#E6E0E9'}"/>`
      corpo += texto(font, t, (W - width(font, t, ts, ls)) / 2, H + 40, ts, dark ? WHT : BER, ls)
      H = H + 40 + pad + 10
    } else {
      corpo += texto(font, t, tx, H + 26, ts, dark ? '#E9DCEA' : '#5E5266')
      H = H + 26 + pad + 10
    }
  }
  return svg(W, H, corpo, dark ? BER : null)
}

// Marca em uma linha, menor (rodapé, assinatura, documentos). Mesmo desenho da marca.
const linha = ({ dark }) => marca({ dark, s: 0.62 })

// Só o símbolo.
const soSimbolo = (dark) => svg(dark ? 140 : 108, dark ? 168 : 136, simbolo(dark ? 20 : 4, dark ? 20 : 4, 1, { m: dark ? WHT : BER, furo: dark ? BER : WHT }), dark ? BER : null)

// Ícone do app: quadrado beringela (o sistema arredonda), M branco, pin laranja.
function icone({ lado = 512, raio = 0, fundo = BER, m = WHT, pin = LAR, margem = 0.2 }) {
  const s = (lado * (1 - 2 * margem)) / 128
  const x = (lado - 100 * s) / 2, y = (lado - 128 * s) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}" role="img" aria-label="Mercado da Região">\n<rect width="${lado}" height="${lado}" rx="${raio}" fill="${fundo}"/>${simbolo(x, y, s, { m, pin, furo: fundo })}\n</svg>\n`
}

// Imagem de compartilhamento (WhatsApp, Facebook): 1200 x 630. Nome numa linha, centrado.
function og() {
  const W = 1200, H = 630, s = 1.55
  const size = 62 * s, gap = 20 * s
  const w = width(bold, NOME, size)
  const total = 100 * s + gap + w, x0 = (W - total) / 2, y0 = 150
  const tx = x0 + 100 * s + gap
  let c = simbolo(x0, y0, s, { m: WHT, furo: BER })
  c += texto(bold, NOME, tx, y0 + (28 + 50) * s + capH(bold, size) / 2, size, WHT)
  const ts = 44
  c += texto(regular, TAG, (W - width(regular, TAG, ts)) / 2, 470, ts, '#E9DCEA')
  c += `<rect x="0" y="${H - 14}" width="${W}" height="14" fill="${LAR}"/>`
  return svg(W, H, c, BER)
}

const arquivos = {
  'mercado-da-regiao-logo.svg': marca({ tag: true }),
  'mercado-da-regiao-logo-fundo-escuro.svg': marca({ dark: true, tag: true }),
  'mercado-da-regiao-marca.svg': marca({}),
  'mercado-da-regiao-marca-fundo-escuro.svg': marca({ dark: true }),
  'mercado-da-regiao-linha.svg': linha({}),
  'mercado-da-regiao-linha-fundo-escuro.svg': linha({ dark: true }),
  'mercado-da-regiao-simbolo.svg': soSimbolo(false),
  'mercado-da-regiao-simbolo-fundo-escuro.svg': soSimbolo(true),
  'mercado-da-regiao-icone-app.svg': icone({}),
  'mercado-da-regiao-icone-app-laranja.svg': icone({ fundo: LAR, m: BER, pin: WHT }),
  'mercado-da-regiao-favicon.svg': icone({ lado: 64, raio: 14, margem: 0.14 }),
  'mercado-da-regiao-franquia-corrente.svg': marca({ cidade: 'Corrente' }),
  'mercado-da-regiao-compartilhar.svg': og(),
}
for (const [nome, conteudo] of Object.entries(arquivos)) writeFileSync(`${OUT}/${nome}`, conteudo)
console.log(Object.keys(arquivos).length + ' arquivos em ' + OUT)
