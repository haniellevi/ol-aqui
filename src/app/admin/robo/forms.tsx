"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { reais } from "@/lib/admin/formato";
import type { ModeloIA, ResultadoTeste } from "@/lib/aki/tipos";
import { escolherModelo, ligarGeral, ligarRegiao, salvarLimites, salvarModelo, salvarTextos, testarModelo } from "./actions";

function Retorno({ estado }: { estado: { ok?: string; erro?: string } | null }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

/* ------------------------------ Ligar / desligar ------------------------------ */

export function FormLigarGeral({ ligado }: { ligado: boolean }) {
  const [estado, acao, pendente] = useActionState(ligarGeral, null);
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="ligar" value={ligado ? "0" : "1"} />
      <p className="text-base">
        Agora o Aki está <strong className={ligado ? "text-verde-escuro" : "text-perigo"}>{ligado ? "ligado" : "desligado"}</strong> em
        todas as regiões (menos as exceções abaixo).
      </p>
      <button disabled={pendente} className={ligado ? estiloBotaoSec : estiloBotao}>
        {pendente ? (ligado ? "Desligando…" : "Ligando…") : ligado ? "Desligar o Aki" : "Ligar o Aki"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormRegiao({ id, nome, situacao }: { id: string; nome: string; situacao: "ligado" | "desligado" | "geral" }) {
  const [estado, acao, pendente] = useActionState(ligarRegiao, null);
  const [modo, setModo] = useState<string>(situacao === "geral" ? "geral" : situacao === "ligado" ? "ligar" : "desligar");
  return (
    <form action={acao} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="microrregiao_id" value={id} />
      <label className="min-w-48 flex-1 text-sm font-semibold">
        {nome}
        <select name="modo" value={modo} onChange={(e) => setModo(e.target.value)} className={estiloCampo}>
          <option value="geral">Seguir o geral</option>
          <option value="ligar">Ligado nesta região</option>
          <option value="desligar">Desligado nesta região</option>
        </select>
      </label>
      <button disabled={pendente} className={estiloBotaoSec}>
        {pendente ? "Salvando…" : "Salvar"}
      </button>
      <div className="w-full">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

/* ----------------------------- Provedor e modelo ----------------------------- */

export function FormModeloEscolhido({
  tipo,
  titulo,
  atual,
  modelos,
  chaves,
}: {
  tipo: "conversa" | "foto";
  titulo: string;
  atual: string;
  modelos: ModeloIA[];
  chaves: Record<string, boolean>;
}) {
  const [estado, acao, pendente] = useActionState(escolherModelo, null);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, iniciarTeste] = useTransition();
  const atualNaLista = modelos.some((m) => `${m.provedor}|${m.modelo}` === atual);
  const NOMES: Record<string, string> = { anthropic: "Anthropic", openrouter: "OpenRouter", openai: "OpenAI" };

  return (
    <div className="space-y-3">
      <form action={acao} className="space-y-2">
        <input type="hidden" name="tipo" value={tipo} />
        <label className="block text-sm font-semibold">
          {titulo}
          <select name="modelo" defaultValue={atualNaLista ? atual : ""} className={estiloCampo}>
            <option value="" disabled>
              Escolha um modelo
            </option>
            {modelos.map((m) => (
              <option key={m.id} value={`${m.provedor}|${m.modelo}`}>
                {NOMES[m.provedor]} · {m.nome}
                {chaves[m.provedor] ? "" : " (falta a chave)"}
              </option>
            ))}
          </select>
        </label>
        {!atualNaLista && (
          <p className="text-[13px] text-aviso">O modelo salvo não está ativo no catálogo (ou não lê imagem e usa ferramentas). O Aki fica descansando até escolher outro.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button disabled={pendente} className={estiloBotaoSec}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            disabled={testando}
            className={estiloBotaoSec}
            onClick={() =>
              iniciarTeste(async () => {
                setTeste(null);
                setTeste(await testarModelo(tipo));
              })
            }
          >
            {testando ? "Testando…" : "Testar"}
          </button>
        </div>
        <Retorno estado={estado} />
      </form>
      {teste &&
        (teste.ok ? (
          <div role="status" className="space-y-1 rounded-card bg-sucesso-fundo px-4 py-3 text-sm text-verde-escuro">
            <p>
              <strong>Resposta:</strong> {teste.resposta}
            </p>
            <p>
              Tempo: {(teste.latenciaMs / 1000).toFixed(1)} s · Custo: {teste.custoCentavos == null ? "não gravado" : reais(teste.custoCentavos)} · Modelo: {teste.modelo}
            </p>
          </div>
        ) : (
          <Aviso tipo="erro">{teste.erro}</Aviso>
        ))}
    </div>
  );
}

/* --------------------------- Limites e orçamento --------------------------- */

export function FormLimites(p: { limite: number; orcamentoReais: string; alerta: number; cotacao: number }) {
  const [estado, acao, pendente] = useActionState(salvarLimites, null);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">
        Mensagens por pessoa por dia
        <input name="limite_diario" type="number" min={0} max={1000} defaultValue={p.limite} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Orçamento do mês (R$)
        <input name="orcamento_reais" inputMode="decimal" defaultValue={p.orcamentoReais} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Avisar quando passar de (% do orçamento)
        <input name="alerta_percentual" type="number" min={1} max={100} defaultValue={p.alerta} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Cotação do dólar (R$)
        <input name="cotacao_dolar" inputMode="decimal" defaultValue={String(p.cotacao).replace(".", ",")} className={estiloCampo} />
      </label>
      <p className="text-[13px] text-texto-suave sm:col-span-2">
        Quando o gasto do mês chega no orçamento, o Aki descansa até o mês seguinte e o resto do site funciona normal.
      </p>
      <div className="sm:col-span-2">
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente ? "Salvando…" : "Salvar limites"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

/* --------------------------------- Textos --------------------------------- */

export function FormTextos(p: { boasVindas: string; avisoIa: string; sugestoes: string[]; temas: string[] }) {
  const [estado, acao, pendente] = useActionState(salvarTextos, null);
  return (
    <form action={acao} className="space-y-3">
      <label className="block text-sm font-semibold">
        Mensagem de boas-vindas
        <textarea name="boas_vindas" rows={3} maxLength={600} defaultValue={p.boasVindas} className={`${estiloCampo} h-auto py-2`} />
      </label>
      <label className="block text-sm font-semibold">
        Aviso de que é uma IA (aparece sempre no topo da conversa)
        <textarea name="aviso_ia" rows={2} maxLength={300} defaultValue={p.avisoIa} className={`${estiloCampo} h-auto py-2`} />
      </label>
      <label className="block text-sm font-semibold">
        Sugestões de perguntas (uma por linha, até 6)
        <textarea name="sugestoes" rows={4} defaultValue={p.sugestoes.join("\n")} className={`${estiloCampo} h-auto py-2`} />
      </label>
      <label className="block text-sm font-semibold">
        Temas proibidos (um por linha): o Aki explica que não pode ajudar
        <textarea name="temas_proibidos" rows={4} defaultValue={p.temas.join("\n")} className={`${estiloCampo} h-auto py-2`} />
      </label>
      <button disabled={pendente} className={estiloBotaoSec}>
        {pendente ? "Salvando…" : "Salvar textos"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}

/* --------------------------- Catálogo de modelos --------------------------- */

const usd = (n: number | null) => (n == null ? "" : String(n));

export function FormModelo({ modelo }: { modelo?: ModeloIA }) {
  const novo = !modelo;
  const [estado, acao, pendente] = useActionState(salvarModelo, null);
  const [provedor, setProvedor] = useState<string>(modelo?.provedor ?? "openrouter");
  return (
    <form action={acao} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {novo ? (
        <>
          <label className="text-sm font-semibold">
            Provedor
            <select name="provedor" value={provedor} onChange={(e) => setProvedor(e.target.value)} className={estiloCampo}>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Id do modelo
            <input name="modelo" required placeholder="ex.: openai/gpt-…" className={`${estiloCampo} font-mono`} />
          </label>
        </>
      ) : (
        <input type="hidden" name="id" value={modelo.id} />
      )}
      <label className="col-span-2 text-sm font-semibold">
        Nome no painel
        <input name="nome" required defaultValue={modelo?.nome} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Entrada (US$/milhão)
        <input name="preco_entrada_usd" inputMode="decimal" defaultValue={usd(modelo?.preco_entrada_usd ?? null)} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Saída (US$/milhão)
        <input name="preco_saida_usd" inputMode="decimal" defaultValue={usd(modelo?.preco_saida_usd ?? null)} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Leitura de cache (US$/milhão)
        <input name="preco_cache_leitura_usd" inputMode="decimal" placeholder="igual à entrada" defaultValue={usd(modelo?.preco_cache_leitura_usd ?? null)} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Escrita de cache (US$/milhão)
        <input name="preco_cache_escrita_usd" inputMode="decimal" placeholder="igual à entrada" defaultValue={usd(modelo?.preco_cache_escrita_usd ?? null)} className={estiloCampo} />
      </label>
      <div className="col-span-2 flex flex-wrap gap-x-4 md:col-span-4">
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="le_imagem" defaultChecked={modelo?.le_imagem ?? false} className="size-5 accent-laranja-escuro" />
          Lê imagem
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="usa_ferramentas" defaultChecked={modelo?.usa_ferramentas ?? false} className="size-5 accent-laranja-escuro" />
          Usa ferramentas
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="ativo" defaultChecked={modelo?.ativo ?? false} className="size-5 accent-laranja-escuro" />
          Ativo (aparece na escolha)
        </label>
        {(modelo?.provedor ?? provedor) === "anthropic" && (
          <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="fallback_servidor" defaultChecked={modelo?.fallback_servidor ?? false} className="size-5 accent-laranja-escuro" />
            Outro modelo responde se este recusar
          </label>
        )}
      </div>
      <label className="col-span-2 text-sm font-semibold md:col-span-4">
        Observação
        <input name="observacao" maxLength={300} defaultValue={modelo?.observacao ?? ""} className={estiloCampo} />
      </label>
      <div className="col-span-2 flex items-center gap-3 md:col-span-4">
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente ? "Salvando…" : novo ? "Adicionar modelo" : "Salvar modelo"}
        </button>
      </div>
      <div className="col-span-2 md:col-span-4">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}
