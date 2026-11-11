const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
// anuncios e vitrines_lojas têm duas ligações com categorias (a escolhida e a sugerida pela IA).
// Sem dizer qual (categorias!<nome_da_ligacao>(...)), o Supabase recusa a consulta por ambiguidade.
function arquivos(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? arquivos(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []); }
test('consultas que trazem a categoria dizem qual ligação usar', () => {
  const soltas = arquivos('src').flatMap((f) => (fs.readFileSync(f, 'utf8').match(/[\s,("'`]categorias\(/g) ?? []).map(() => f))
    .filter((f) => !/tipos-cadastros\.ts$|aki\/ferramentas\.ts$/.test(f));
  assert.deepEqual(soltas, []);
});
