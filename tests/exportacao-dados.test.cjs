const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// A exportação "Baixar meus dados" roda com a sessão da pessoa. Ela não pode pedir "*" em anuncios:
// o banco não concede o IP de criação nem a revisão da equipe a quem está logado, e "*" falha inteiro.
const ROTA = 'src/app/(conta)/minha-conta/privacidade/baixar/route.ts';
const MIGRACAO = 'supabase/migrations/20261125010000_seguranca_lote_banco.sql';

const lista = (texto) => texto.split(',').map((c) => c.trim()).filter(Boolean);

test('exportação não pede "*" em anúncios e lê só as colunas que o banco concede a quem está logado', () => {
  const rota = fs.readFileSync(ROTA, 'utf8');
  const migracao = fs.readFileSync(MIGRACAO, 'utf8');
  assert.doesNotMatch(rota, /daVitrine\("anuncios",\s*"\*"\)/);
  const usadas = /const COLUNAS_ANUNCIOS_DONO\s*=\s*"([^"]+)"/.exec(rota);
  const concedidas = /revoke select on table public\.anuncios from authenticated;\s*grant select \(([^)]*)\) on table public\.anuncios to authenticated;/.exec(migracao);
  assert.ok(usadas, 'a rota precisa de COLUNAS_ANUNCIOS_DONO');
  assert.ok(concedidas, 'a migração precisa conceder as colunas de anuncios a authenticated');
  assert.deepEqual([...lista(usadas[1])].sort(), [...lista(concedidas[1])].sort());
});

test('exportação não pede o IP de criação nem a revisão da equipe de anúncios', () => {
  const rota = fs.readFileSync(ROTA, 'utf8');
  const usadas = lista(/const COLUNAS_ANUNCIOS_DONO\s*=\s*"([^"]+)"/.exec(rota)[1]);
  assert.ok(!usadas.includes('criado_ip'));
  assert.ok(!usadas.includes('revisao_manual_admin'));
});
