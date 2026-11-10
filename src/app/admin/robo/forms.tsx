"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Aviso, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { CampoBusca, type OpcaoBusca } from "@/components/admin/campo-busca";
import { reais } from "@/lib/admin/formato";
import type { ModeloAoVivo } from "@/lib/aki/catalogo-ao-vivo";
import type { ModeloIA, ProvedorIA, ResultadoTeste } from "@/lib/aki/tipos";
import {
  buscarModelos,
  escolherModelo,
  ligarGeral,
  ligarRegiao,
  resolverBuscaVazia,
  salvarLimites,
  salvarModelo,
  salvarTextos,
  testarModelo,
} from "./actions";

const NOMES_PROVEDOR: Record<ProvedorIA, string> = { openrouter: "OpenRouter", anthropic: "Anthropic", openai: "OpenAI" };

const us = (n: number | null) => (n == null ? "?" : `US$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`);

/** Linha de apoio de cada modelo na lista: preço e data. */
function detalheModelo(m: ModeloAoVivo): string {
  const preco = m.preco_entrada_usd == null ? "preço não informado" : `entrada ${us(m.preco_entrada_usd)} · saída ${us(m.preco_saida_usd)} por milhão`;
  return [preco, m.lancado_em ? `lançado em ${m.lancado_em.split("-").reverse().join("/")}` : ""].filter(Boolean).join(" · ");
}

/** Mesma regra do servidor: lê imagem, usa ferramentas e tem preço. */
const serveParaOAki = (m: ModeloAoVivo) => m.le_imagem && m.usa_ferramentas && m.preco_entrada_usd !== null && m.preco_saida_usd !== null;

/** Carrega a lista ao vivo sempre que o provedor muda. */
function useModelosAoVivo(provedor: ProvedorIA | "") {
  const [estado, setEstado] = useState<{ carregando: boolean; modelos: ModeloAoVivo[]; erro: string | null }>({
    carregando: false,
    modelos: [],
    erro: null,
  });
  useEffect(() => {
    if (!provedor) return;
    let vivo = true;
    setEstado({ carregando: true, modelos: [], erro: null });
    buscarModelos(provedor).then((r) => {
      if (!vivo) return;
      setEstado(r.ok ? { carregando: false, modelos: r.modelos, erro: null } : { carregando: false, modelos: [], erro: r.erro });
    });
    return () => {
      vivo = false;
    };
  }, [provedor]);
  return estado;
}

function SeletorProvedor({ valor, onMudar, chaves, nome }: { valor: string; onMudar: (p: ProvedorIA) => void; chaves?: Record<string, boolean>; nome?: string }) {
  return (
    <label className="block text-sm font-semibold">
      Provedor
      <select name={nome} value={valor} onChange={(e) => onMudar(e.target.value as ProvedorIA)} className={estiloCampo}>
        {!valor && (
          <option value="" disabled>
            Escolha o provedor
          </option>
        )}
        {(Object.keys(NOMES_PROVEDOR) as ProvedorIA[]).map((p) => (
          <option key={p} value={p}>
            {NOMES_PROVEDOR[p]}
            {chaves && !chaves[p] ? " (falta a chave)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

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
  /** "provedor|modelo" salvo agora */
  atual: string;
  /** catálogo (ativos que servem): usado só para avisar se o salvo saiu de uso */
  modelos: ModeloIA[];
  chaves: Record<string, boolean>;
}) {
  const [estado, acao, pendente] = useActionState(escolherModelo, null);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, iniciarTeste] = useTransition();
  const [provAtual, ...resto] = atual.split("|");
  const modeloAtual = resto.join("|");
  const provedorValido = (Object.keys(NOMES_PROVEDOR) as string[]).includes(provAtual);
  // provedor salvo inválido (ex.: "deepseek"): começa pelo OpenRouter, que tem a lista pública
  const [provedor, setProvedor] = useState<ProvedorIA>(provedorValido ? (provAtual as ProvedorIA) : "openrouter");
  const [modelo, setModelo] = useState(provedorValido && provAtual === provedor ? modeloAtual : "");
  const { carregando, modelos: aoVivo, erro } = useModelosAoVivo(provedor);
  const servem = aoVivo.filter(serveParaOAki);
  const opcoes: OpcaoBusca[] = servem.map((m) => ({ valor: m.modelo, nome: m.nome, detalhe: `${m.modelo} · ${detalheModelo(m)}` }));
  // o modelo salvo continua aparecendo mesmo que tenha saído da lista do provedor
  if (modelo && !opcoes.some((o) => o.valor === modelo)) opcoes.unshift({ valor: modelo, nome: modelo, detalhe: "modelo salvo agora" });
  const atualServe = modelos.some((m) => `${m.provedor}|${m.modelo}` === atual);
  const escolhido = modelo ? `${provedor}|${modelo}` : "";

  return (
    <div className="space-y-3">
      <form action={acao} className="space-y-2">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="modelo" value={escolhido} />
        <h3 className="text-base font-semibold text-beringela">{titulo}</h3>
        <SeletorProvedor
          valor={provedor}
          chaves={chaves}
          onMudar={(p) => {
            setProvedor(p);
            setModelo("");
            setTeste(null);
          }}
        />
        <div className="text-sm font-semibold">
          Modelo
          <CampoBusca
            key={`${provedor}|${carregando}`}
            rotulo={`Modelo de ${titulo.toLowerCase()}`}
            opcoes={opcoes}
            valorInicial={modelo}
            desativado={carregando || !!erro}
            placeholder={carregando ? "Carregando a lista do provedor…" : "Digite parte do nome. Ex.: deepseek flash"}
            onEscolher={(v) => {
              setModelo(v);
              setTeste(null);
            }}
          />
          {!carregando && !erro && (
            <p className="mt-1 text-[13px] font-normal text-texto-suave">
              {servem.length} modelos que leem foto e usam as funções do site, do mais novo para o mais antigo. A lista vem do {NOMES_PROVEDOR[provedor]} na hora.
            </p>
          )}
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!atualServe && (
          <p className="text-[13px] text-aviso">
            O modelo salvo ({atual.replace("|", " · ") || "nenhum"}) não está pronto para uso. O Aki fica descansando até escolher outro e salvar.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button disabled={pendente} className={estiloBotaoSec}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            disabled={testando || !escolhido}
            className={estiloBotaoSec}
            onClick={() =>
              iniciarTeste(async () => {
                setTeste(null);
                setTeste(await testarModelo(tipo, escolhido));
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

export function FormLimites(p: { limite: number; orcamentoReais: string; alerta: number; cotacao: number; reservaTokens: number }) {
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
      <label className="text-sm font-semibold sm:col-span-2">
        Tokens de entrada reservados por volta (enquanto a resposta não termina)
        <input name="reserva_tokens_entrada" type="number" min={0} max={1000000} defaultValue={p.reservaTokens} className={estiloCampo} />
      </label>
      <p className="text-[13px] text-texto-suave sm:col-span-2">
        Antes de cada resposta o Aki separa do orçamento o máximo que ela pode custar; no fim entra o valor certo. Assim muita gente ao
        mesmo tempo não passa do orçamento. Quando o gasto do mês chega no orçamento, o Aki descansa até o mês seguinte e o resto do site funciona normal.
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
  const [provedor, setProvedor] = useState<ProvedorIA>(modelo?.provedor ?? "openrouter");
  // novo modelo: a lista vem do provedor e, ao escolher, preenche nome, preços e capacidades
  const { carregando, modelos: aoVivo, erro } = useModelosAoVivo(novo ? provedor : "");
  const [pre, setPre] = useState<ModeloAoVivo | null>(null);
  const base = modelo ?? pre;
  const chaveCampos = novo ? `${provedor}|${pre?.modelo ?? ""}` : modelo.id;
  return (
    <form action={acao} className="grid grid-cols-2 items-end gap-3 @3xl/painel:grid-cols-4">
      {novo ? (
        <>
          <SeletorProvedor
            nome="provedor"
            valor={provedor}
            onMudar={(p) => {
              setProvedor(p);
              setPre(null);
            }}
          />
          <div className="col-span-2 text-sm font-semibold @3xl/painel:col-span-3">
            Modelo
            <CampoBusca
              key={`${provedor}|${carregando}`}
              nome="modelo"
              rotulo="Modelo do provedor"
              opcoes={aoVivo.map((m) => ({ valor: m.modelo, nome: m.nome, detalhe: `${m.modelo} · ${detalheModelo(m)}` }))}
              desativado={carregando || !!erro}
              placeholder={carregando ? "Carregando a lista do provedor…" : "Digite parte do nome para filtrar"}
              onEscolher={(v) => setPre(aoVivo.find((m) => m.modelo === v) ?? null)}
            />
            {erro && (
              <div className="mt-1">
                <Aviso tipo="erro">{erro}</Aviso>
              </div>
            )}
          </div>
        </>
      ) : (
        <input type="hidden" name="id" value={modelo.id} />
      )}
      <label key={`nome-${chaveCampos}`} className="col-span-2 text-sm font-semibold">
        Nome no painel
        <input name="nome" required defaultValue={base?.nome} className={estiloCampo} />
      </label>
      <label key={`e-${chaveCampos}`} className="text-sm font-semibold">
        Entrada (US$/milhão)
        <input name="preco_entrada_usd" inputMode="decimal" defaultValue={usd(base?.preco_entrada_usd ?? null)} className={estiloCampo} />
      </label>
      <label key={`s-${chaveCampos}`} className="text-sm font-semibold">
        Saída (US$/milhão)
        <input name="preco_saida_usd" inputMode="decimal" defaultValue={usd(base?.preco_saida_usd ?? null)} className={estiloCampo} />
      </label>
      <label key={`cl-${chaveCampos}`} className="text-sm font-semibold">
        Leitura de cache (US$/milhão)
        <input name="preco_cache_leitura_usd" inputMode="decimal" placeholder="igual à entrada" defaultValue={usd(base?.preco_cache_leitura_usd ?? null)} className={estiloCampo} />
      </label>
      <label key={`ce-${chaveCampos}`} className="text-sm font-semibold">
        Escrita de cache (US$/milhão)
        <input name="preco_cache_escrita_usd" inputMode="decimal" placeholder="igual à entrada" defaultValue={usd(base?.preco_cache_escrita_usd ?? null)} className={estiloCampo} />
      </label>
      <div key={`caps-${chaveCampos}`} className="col-span-2 flex flex-wrap gap-x-4 @3xl/painel:col-span-4">
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="le_imagem" defaultChecked={base?.le_imagem ?? false} className="size-5 accent-laranja-escuro" />
          Lê imagem
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="usa_ferramentas" defaultChecked={base?.usa_ferramentas ?? false} className="size-5 accent-laranja-escuro" />
          Usa ferramentas
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="ativo" defaultChecked={modelo?.ativo ?? !!pre} className="size-5 accent-laranja-escuro" />
          Ativo (aparece na escolha)
        </label>
        {(modelo?.provedor ?? provedor) === "anthropic" && (
          <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="fallback_servidor" defaultChecked={modelo?.fallback_servidor ?? false} className="size-5 accent-laranja-escuro" />
            Outro modelo responde se este recusar
          </label>
        )}
      </div>
      <label className="col-span-2 text-sm font-semibold @3xl/painel:col-span-4">
        Observação
        <input name="observacao" maxLength={300} defaultValue={modelo?.observacao ?? ""} className={estiloCampo} />
      </label>
      <div className="col-span-2 flex items-center gap-3 @3xl/painel:col-span-4">
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente ? "Salvando…" : novo ? "Adicionar modelo" : "Salvar modelo"}
        </button>
      </div>
      <div className="col-span-2 @3xl/painel:col-span-4">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

/* ---------------------------- Buscas sem resultado ---------------------------- */

export function FormResolverBusca({ id }: { id: number }) {
  const [estado, acao, pendente] = useActionState(resolverBuscaVazia, null);
  return (
    <form action={acao} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button disabled={pendente} className={estiloBotaoSec}>
        {pendente ? "Salvando…" : "Resolvido"}
      </button>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}
