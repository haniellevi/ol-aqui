const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const mod = carregar('src/lib/verificacao-loja/pdf.ts');

// PDF mínimo escrito à mão (sem dependência), com uma linha de texto.
function pdfMinimo(linha) {
  const conteudo = `BT /F1 12 Tf 20 100 Td (${linha}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1').toString('base64');
}

test('extrai o texto de um PDF real', async () => {
  const texto = await mod.extrairTextoPdf(pdfMinimo('Conta de Luz OLAKI Teste LTDA'));
  assert.match(texto, /Conta de Luz OLAKI Teste LTDA/);
});

test('base64 vazio ou lixo não vira texto', async () => {
  await assert.rejects(() => mod.extrairTextoPdf(''));
  await assert.rejects(() => mod.extrairTextoPdf(Buffer.from('isto não é um pdf').toString('base64')));
});
