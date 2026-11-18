const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Worker de produção nasce isolado, com as proteções de cobrança e sem rotas ou cron', () => {
  const config = JSON.parse(fs.readFileSync('wrangler.producao.jsonc', 'utf8'));
  assert.equal(config.name, 'mercado-regiao-producao');
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.vars.VERCEL_ENV, 'production');
  assert.equal(config.vars.CLOUDFLARE_IMAGENS, '1');
  assert.notEqual(config.vars.CLOUDFLARE_SOMENTE_LEITURA, '1');
  assert.ok(config.services.some((s) => s.binding === 'IMAGENS_TRATAMENTO' && s.service === 'mercado-regiao-imagens'));
  assert.equal(config.routes, undefined);
  assert.equal(config.triggers, undefined);
});
