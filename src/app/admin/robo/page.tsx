import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { inteiro, paraReaisInput, quando, reais } from "@/lib/admin/formato";
import { Cartao, Numero, Titulo } from "@/components/admin/ui";
import { chavesConfiguradas } from "@/lib/aki/provedores";
import type { ModeloIA, PainelAki, ProvedorIA } from "@/lib/aki/tipos";
import { FormLigarGeral, FormLimites, FormModelo, FormModeloEscolhido, FormRegiao, FormResolverBusca, FormTextos } from "./forms";

export const metadata = { title: "Robô Aki" };

const NOME_PROVEDOR: Record<ProvedorIA, string> = { anthropic: "Anthropic", openrouter: "OpenRouter", openai: "OpenAI" };
const NOME_CHAVE: Record<ProvedorIA, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">{titulo}</h2>
      {children}
    </>
  );
}

const texto = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);
const numero = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || padrao);
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

export default async function RoboPage() {
  const { supabase } = await exigirAdmin();
  const [painelR, modelosR, configR, regioesR] = await Promise.all([
    supabase.rpc("robo_painel", { p_dias: 14 }),
    supabase.from("robo_modelos").select("*").order("provedor").order("nome"),
    supabase.from("configuracoes").select("chave, valor, microrregiao_id").like("chave", "robo.%"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
  ]);

  const painel = (painelR.data ?? null) as PainelAki | null;
  const modelos = (modelosR.data ?? []) as ModeloIA[];
  const regioes = (regioesR.data ?? []) as { id: string; nome: string }[];
  const chaves = chavesConfiguradas();

  const geral = new Map<string, unknown>();
  const excecoesAtivo = new Map<string, boolean>();
  for (const c of (configR.data ?? []) as { chave: string; valor: unknown; microrregiao_id: string | null }[]) {
    if (c.microrregiao_id === null) geral.set(c.chave, c.valor);
    else if (c.chave === "robo.ativo") excecoesAtivo.set(c.microrregiao_id, c.valor === true);
  }

  const ligado = geral.get("robo.ativo") === true;
  const escolhiveis = modelos.filter((m) => m.ativo && m.le_imagem && m.usa_ferramentas);
  const atual = (t: "conversa" | "foto") => `${texto(geral.get(`robo.provedor_${t}`))}|${texto(geral.get(`robo.modelo_${t}`))}`;

  const custoMes = painel?.custo_mes_centavos ?? 0;
  const orcamento = painel?.orcamento_centavos ?? numero(geral.get("robo.orcamento_mensal_centavos"), 0);
  const alerta = painel?.alerta_percentual ?? numero(geral.get("robo.alerta_percentual"), 80);
  const usoPct = orcamento > 0 ? Math.round((custoMes / orcamento) * 100) : 0;
  const estourou = orcamento > 0 && custoMes >= orcamento;
  const perto = !estourou && orcamento > 0 && usoPct >= alerta;

  // custo por provedor (somando os modelos)
  const porProvedor = new Map<string, { custo: number; respostas: number }>();
  for (const l of painel?.por_provedor ?? []) {
    const p = porProvedor.get(l.provedor) ?? { custo: 0, respostas: 0 };
    p.custo += Number(l.custo) || 0;
    p.respostas += Number(l.respostas) || 0;
    porProvedor.set(l.provedor, p);
  }
  const dias = painel?.por_dia ?? [];
  const maxConversas = Math.max(1, ...dias.map((d) => d.conversas));
  const totalAvaliacoes = (painel?.avaliacoes.boas ?? 0) + (painel?.avaliacoes.ruins ?? 0);

  return (
    <>
      <Titulo sub="O ajudante com IA do site. Chaves dos provedores ficam só nas variáveis de ambiente da Vercel. Toda mudança fica no histórico.">
        Robô Aki
      </Titulo>

      {painelR.error && (
        <p role="alert" className="mb-4 rounded-card bg-perigo-fundo px-4 py-3 text-sm text-perigo">
          Não deu para carregar os números: {painelR.error.message}
        </p>
      )}
      {(estourou || perto) && (
        <p
          role="alert"
          className={`mb-4 rounded-card px-4 py-3 text-sm font-semibold ${estourou ? "bg-perigo-fundo text-perigo" : "bg-aviso-fundo text-aviso"}`}
        >
          {estourou
            ? `O gasto do mês (${reais(custoMes)}) chegou no orçamento (${reais(orcamento)}). O Aki está descansando até o mês que vem, ou até você aumentar o orçamento.`
            : `O gasto do mês já está em ${usoPct}% do orçamento (${reais(custoMes)} de ${reais(orcamento)}).`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Gasto no mês" valor={reais(custoMes)} detalhe={orcamento > 0 ? `${usoPct}% do orçamento` : "sem orçamento"} alerta={estourou || perto} />
        <Numero rotulo="Orçamento do mês" valor={reais(orcamento)} />
        <Numero rotulo="Respostas no mês" valor={inteiro(painel?.respostas_mes ?? 0)} />
        <Numero
          rotulo="Avaliações"
          valor={`${inteiro(painel?.avaliacoes.boas ?? 0)} boas · ${inteiro(painel?.avaliacoes.ruins ?? 0)} ruins`}
          detalhe={totalAvaliacoes ? `${Math.round(((painel?.avaliacoes.boas ?? 0) / totalAvaliacoes) * 100)}% boas` : "nenhuma ainda"}
        />
      </div>

      <Secao titulo="Ligar e desligar">
        <div className="grid gap-3 md:grid-cols-2">
          <Cartao>
            <FormLigarGeral ligado={ligado} />
          </Cartao>
          <Cartao>
            <p className="mb-3 text-sm text-texto-suave">Exceções por região (valem mais que o geral).</p>
            <div className="space-y-3">
              {regioes.map((r) => (
                <FormRegiao
                  key={r.id}
                  id={r.id}
                  nome={r.nome}
                  situacao={excecoesAtivo.has(r.id) ? (excecoesAtivo.get(r.id) ? "ligado" : "desligado") : "geral"}
                />
              ))}
              {!regioes.length && <p className="text-sm text-texto-suave">Nenhuma região cadastrada.</p>}
            </div>
          </Cartao>
        </div>
      </Secao>

      <Secao titulo="Provedor e modelo">
        <Cartao className="mb-3">
          <p className="mb-2 text-sm text-texto-suave">Chaves nas variáveis de ambiente (Vercel):</p>
          <ul className="flex flex-wrap gap-2">
            {(Object.keys(NOME_PROVEDOR) as ProvedorIA[]).map((p) => (
              <li
                key={p}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold ${chaves[p] ? "bg-sucesso-fundo text-verde-escuro" : "bg-fundo text-texto-suave"}`}
              >
                {NOME_PROVEDOR[p]}: {chaves[p] ? "configurada" : `falta ${NOME_CHAVE[p]}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-texto-suave">Escolha o provedor e a lista de modelos vem dele na hora. Digite parte do nome para filtrar. Ao salvar, o modelo entra no catálogo com o preço do provedor.</p>
        </Cartao>
        <div className="grid gap-3 md:grid-cols-2">
          <Cartao>
            <FormModeloEscolhido tipo="conversa" titulo="Modelo da conversa" atual={atual("conversa")} modelos={escolhiveis} chaves={chaves} />
          </Cartao>
          <Cartao>
            <FormModeloEscolhido tipo="foto" titulo="Modelo da foto (cadastro pela foto)" atual={atual("foto")} modelos={escolhiveis} chaves={chaves} />
          </Cartao>
        </div>
      </Secao>

      <Secao titulo="Limites e orçamento">
        <Cartao>
          <FormLimites
            limite={numero(geral.get("robo.limite_diario_pessoa"), 20)}
            orcamentoReais={paraReaisInput(numero(geral.get("robo.orcamento_mensal_centavos"), 0))}
            alerta={numero(geral.get("robo.alerta_percentual"), 80)}
            cotacao={numero(geral.get("robo.cotacao_dolar"), 5.5)}
            reservaTokens={numero(geral.get("robo.reserva_tokens_entrada"), 20000)}
          />
        </Cartao>
      </Secao>

      <Secao titulo="Textos do Aki">
        <Cartao>
          <FormTextos
            boasVindas={texto(geral.get("robo.boas_vindas"))}
            avisoIa={texto(geral.get("robo.aviso_ia"))}
            sugestoes={lista(geral.get("robo.sugestoes"))}
            temas={lista(geral.get("robo.temas_proibidos"))}
          />
        </Cartao>
        <p className="mt-2 text-[13px] text-texto-suave">
          Outros ajustes (tamanho das respostas, histórico, foto, esforço) ficam em{" "}
          <Link href="/admin/configuracoes?grupo=robo" className="font-semibold text-laranja-escuro underline">
            Configurações › Robô Aki
          </Link>
          .
        </p>
      </Secao>

      <Secao titulo="Gasto por provedor e modelo (mês)">
        <Cartao>
          {porProvedor.size ? (
            <div className="space-y-4">
              <ul className="flex flex-wrap gap-2">
                {[...porProvedor].map(([p, v]) => (
                  <li key={p} className="rounded-card bg-fundo px-3 py-2 text-sm">
                    <strong>{NOME_PROVEDOR[p as ProvedorIA] ?? p}</strong>: {reais(v.custo)} · {inteiro(v.respostas)} respostas
                  </li>
                ))}
              </ul>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[13px] text-texto-suave">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Modelo</th>
                      <th className="py-2 pr-3 font-semibold">Respostas</th>
                      <th className="py-2 pr-3 font-semibold">Tokens entrada</th>
                      <th className="py-2 pr-3 font-semibold">Tokens saída</th>
                      <th className="py-2 font-semibold">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(painel?.por_provedor ?? []).map((l) => (
                      <tr key={`${l.provedor}|${l.modelo}`} className="border-t border-borda">
                        <td className="py-2 pr-3 font-mono text-[13px]">
                          {NOME_PROVEDOR[l.provedor as ProvedorIA] ?? l.provedor} · {l.modelo}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{inteiro(l.respostas)}</td>
                        <td className="py-2 pr-3 tabular-nums">{inteiro(l.tokens_entrada)}</td>
                        <td className="py-2 pr-3 tabular-nums">{inteiro(l.tokens_saida)}</td>
                        <td className="py-2 tabular-nums">{reais(Number(l.custo))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-texto-suave">Nenhum gasto neste mês ainda.</p>
          )}
        </Cartao>
      </Secao>

      <Secao titulo="Conversas por dia (14 dias)">
        <Cartao>
          <ol className="flex h-40 items-end gap-1" aria-label="Conversas por dia">
            {dias.map((d) => (
              <li key={d.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[13px] tabular-nums text-texto-suave">{d.conversas || ""}</span>
                <span
                  className="w-full rounded-t-[4px] bg-laranja"
                  style={{ height: `${Math.max(2, (d.conversas / maxConversas) * 100)}%` }}
                  title={`${d.dia}: ${d.conversas} conversas, ${d.mensagens} mensagens, ${reais(Number(d.custo))}`}
                />
              </li>
            ))}
          </ol>
          <div className="mt-1 flex justify-between text-[13px] text-texto-suave">
            <span>{dias[0]?.dia.split("-").reverse().slice(0, 2).join("/")}</span>
            <span>hoje</span>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo="Respostas mal avaliadas">
        <Cartao>
          {painel?.piores.length ? (
            <ul className="divide-y divide-borda">
              {painel.piores.map((p) => (
                <li key={p.mensagem_id} className="space-y-1 py-3 text-sm">
                  <p className="text-[13px] text-texto-suave">
                    {quando(p.quando)} {p.modelo && <span className="font-mono">· {p.modelo}</span>}
                  </p>
                  {p.pergunta && (
                    <p>
                      <strong>Pergunta:</strong> {p.pergunta}
                    </p>
                  )}
                  <p className="whitespace-pre-line">
                    <strong>Resposta:</strong> {p.resposta ?? "—"}
                  </p>
                  {p.comentario && <p className="rounded-card bg-fundo px-3 py-2">“{p.comentario}”</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma resposta mal avaliada até agora.</p>
          )}
        </Cartao>
      </Secao>

      <Secao titulo="Buscas sem resultado (o que falta no site)">
        <Cartao>
          {painel?.buscas_vazias.length ? (
            <ul className="divide-y divide-borda">
              {painel.buscas_vazias.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {b.termo || "(sem palavra)"} {b.categoria_slug && <span className="font-normal text-texto-suave">em {b.categoria_slug}</span>}
                    </p>
                    <p className="text-[13px] text-texto-suave">
                      {inteiro(b.vezes)} {b.vezes === 1 ? "vez" : "vezes"} · {b.regiao ?? "sem região"} · última {quando(b.ultima_em)}
                    </p>
                  </div>
                  <FormResolverBusca id={b.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma busca sem resultado. Quando o Aki não achar algo, aparece aqui.</p>
          )}
        </Cartao>
      </Secao>

      <Secao titulo="Catálogo de modelos">
        <p className="mb-3 text-[13px] text-texto-suave">
          Preços em dólar por milhão de tokens, copiados da página do provedor. O custo de cada mensagem é calculado com eles e com a cotação do dólar.
        </p>
        <div className="space-y-3">
          {modelos.map((m) => (
            <Cartao key={m.id}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-beringela">{m.nome}</h3>
                <span className="rounded-full bg-fundo px-2 py-0.5 font-mono text-[13px] text-texto-suave">
                  {NOME_PROVEDOR[m.provedor]} · {m.modelo}
                </span>
                {!m.ativo && <span className="rounded-full bg-borda px-2 py-0.5 text-[13px] font-semibold text-texto-suave">inativo</span>}
              </div>
              <FormModelo modelo={m} />
            </Cartao>
          ))}
          <Cartao className="border-dashed">
            <h3 className="mb-3 text-lg font-semibold text-beringela">Novo modelo</h3>
            <FormModelo />
          </Cartao>
        </div>
      </Secao>
    </>
  );
}
