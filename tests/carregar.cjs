const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Executa o TypeScript real com as fronteiras externas substituídas, sem credenciais ou rede.
function carregar(arquivo, mocks = {}) {
  const filename = path.resolve(arquivo);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  const requireLocal = (nome) => {
    if (Object.hasOwn(mocks, nome)) return mocks[nome];
    if (nome === 'server-only') return {};
    if (nome === 'react') return { ...require('react'), cache: (f) => f };
    if (nome.startsWith('@/')) {
      const base = `src/${nome.slice(2)}`;
      return carregar(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`, mocks);
    }
    if (nome.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), nome);
      return carregar(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`, mocks);
    }
    return require(nome);
  };
  new Function('require', 'module', 'exports', js)(requireLocal, mod, mod.exports);
  return mod.exports;
}
module.exports = { carregar };
