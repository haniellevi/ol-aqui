import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { inteiro, quando, reais } from "@/lib/admin/formato";
import { tipoDe } from "@/lib/admin/config";
import { asaasConfigurado, webhookConfigurado } from "@/lib/asaas";
import { linkAnuncio } from "@/lib/formato";
import { Cartao, Numero, Titulo } from "@/components/admin/ui";
import { FormConfig } from "../configuracoes/form-config";
import {
  BotaoCancelarDestaque,
  BotaoRemoverPrecoRegiao,
  FormCortesia,
  FormCreditos,
  FormPrecoRegiao,
  FormTipoDestaque,
} from "./formularios";
import type { ResultadoDestaque, TipoDestaque } from "@/lib/tipos-destaques";

export const metadata = { title: "Destaques" };

// Tela 10 · Destaques: tipos (preço, dias, vagas, ativo, ordem), créditos por plano,
// prazos, destaques ativos com resultado, cortesia e pagamentos esperando.
// Só admin (exigirAdmin + RLS e_admin no banco). Toda mudança vai para o histórico.

const CHAVES_CONFIG = [
  "destaque.reserva_minutos",
  "destaque.cancelar_pendente_horas",
  "destaque.subir_intervalo_horas",
  "destaque.subir_resultado_dias",
  "destaque.pendentes_max",
  "destaque.reserva_renovacoes_max",
  "destaque.reservas_max_por_vendedor",
  "cobranca.vencimento_dias",
  "cobranca.consulta_intervalo_segundos",
  "asaas.ambiente",
];

const ORIGEM: Record<string, string> = { pago: "Pago", credito: "Crédito do plano", cortesia: "Cortesia" };

type Config = { id: string; chave: string; valor: unknown; descricao: string | null };
type PrecoRegiao = { id: string; tipo: TipoDestaque["slug"]; microrregiao_id: string; preco_centavos: number | null; dias: number | null };
type Devolver = {
  id: string;
  valor_centavos: number;
  pago_em: string | null;
  devolver_motivo: string;
  link_pagamento: string | null;
  vitrines_lojas: { nome: string } | null;
};
type Pendente = {
  id: string;
  valor_centavos: number;
  forma: string | null;
  criado_em: string;
  vencimento: string | null;
  asaas_cobranca_id: string | null;
  link_pagamento: string | null;
  vitrines_lojas: { nome: string } | null;
  destaques: LinhaPendente | LinhaPendente[] | null;
};
type LinhaPendente = { id: string; tipo: string; status: string; reservado_ate: string | null };

export default async function DestaquesAdminPage() {
  const { supabase } = await exigirAdmin();
  const [tiposRes, creditosRes, planosRes, configsRes, ativosRes, pendentesRes, precosRes, regioesRes, devolverRes] = await Promise.all([
    supabase.from("destaque_tipos").select("*").order("ordem"),
    supabase.from("destaque_creditos_plano").select("plano_codigo, tipo, quantidade_mes"),
    supabase.from("planos").select("codigo, nome, ordem").order("ordem"),
    supabase.from("configuracoes").select("id, chave, valor, descricao").in("chave", CHAVES_CONFIG).is("microrregiao_id", null),
    supabase.rpc("resultados_destaques", { p_anuncio_id: null, p_todos: true, p_limite: 200 }),
    supabase
      .from("pagamentos")
      .select("id, valor_centavos, forma, criado_em, vencimento, asaas_cobranca_id, link_pagamento, vitrines_lojas(nome), destaques(id, tipo, status, reservado_ate)")
      .eq("tipo", "destaque")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false })
      .limit(50),
    supabase.from("destaque_precos_regiao").select("id, tipo, microrregiao_id, preco_centavos, dias"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    supabase
      .from("pagamentos")
      .select("id, valor_centavos, pago_em, devolver_motivo, link_pagamento, vitrines_lojas(nome)")
      .eq("tipo", "destaque")
      .eq("status", "pago")
      .not("devolver_motivo", "is", null)
      .order("pago_em", { ascending: false })
      .limit(50),
  ]);

  const tipos = (tiposRes.data ?? []) as TipoDestaque[];
  const nomeTipo = new Map(tipos.map((t) => [t.slug, t.nome]));
  const creditos = Object.fromEntries((creditosRes.data ?? []).map((c) => [`${c.plano_codigo}:${c.tipo}`, c.quantidade_mes as number]));
  const configs = ((configsRes.data ?? []) as Config[]).sort((a, b) => CHAVES_CONFIG.indexOf(a.chave) - CHAVES_CONFIG.indexOf(b.chave));
  const todos = ((ativosRes.data ?? []) as ResultadoDestaque[]).map((r) => ({
    ...r,
    visualizacoes: Number(r.visualizacoes ?? 0),
    cliques_whatsapp: Number(r.cliques_whatsapp ?? 0),
  }));
  const ativos = todos.filter((r) => r.status === "ativo");
  const pendentes = (pendentesRes.data ?? []) as unknown as Pendente[];
  const precosRegiao = (precosRes.data ?? []) as PrecoRegiao[];
  const regioes = (regioesRes.data ?? []) as { id: string; nome: string }[];
  const nomeRegiao = new Map(regioes.map((r) => [r.id, r.nome]));
  const devolver = (devolverRes.data ?? []) as unknown as Devolver[];
  const somaVis = ativos.reduce((s, r) => s + r.visualizacoes, 0);
  const somaCli = ativos.reduce((s, r) => s + r.cliques_whatsapp, 0);
  const temAsaas = asaasConfigurado();
  const temWebhook = webhookConfigurado();
  const ambiente = configs.find((c) => c.chave === "asaas.ambiente")?.valor;

  return (
    <>
      <Titulo sub="Preço, dias e vagas de cada destaque, créditos dos planos e cortesias. Todo destaque pago aparece no site com a etiqueta Patrocinado. Toda mudança fica no histórico.">
        Destaques
      </Titulo>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Destaques ativos" valor={inteiro(ativos.length)} />
        <Numero rotulo="Visualizações (ativos)" valor={inteiro(somaVis)} />
        <Numero rotulo="Cliques no WhatsApp" valor={inteiro(somaCli)} />
        <Numero rotulo="Esperando pagamento" valor={inteiro(pendentes.length)} />
      </div>

      <nav aria-label="Seções de destaques" className="mb-6 flex flex-wrap gap-x-5 gap-y-1 border-b border-borda pb-2 text-sm">
        {[["tipos", "Tipos"], ["regioes", "Regiões"], ["creditos", "Créditos"], ["cortesias", "Cortesias"], ["ativos", "Ativos"], ["cobranca", "Cobrança"]].map(([id, nome]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-12 items-center text-texto-suave underline-offset-4 hover:text-laranja-escuro hover:underline focus-visible:outline-2 focus-visible:outline-laranja-escuro">{nome}</a>
        ))}
      </nav>

      <div className="space-y-6">
        <Cartao>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-beringela">Pagamento (Asaas)</h2>
            <span className="rounded-campo bg-selecao px-2 py-1 text-legenda font-semibold text-beringela">{ambiente === "producao" ? "Produção" : "Ambiente de teste"}</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-legenda">
            <li>
              Chave da API: {" "}
              <strong className={temAsaas ? "text-verde-escuro" : "text-perigo"}>{temAsaas ? "configurada" : "falta na Vercel"}</strong>
            </li>
            <li>
              Token do aviso: {" "}
              <strong className={temWebhook ? "text-verde-escuro" : "text-perigo"}>{temWebhook ? "configurado" : "falta na Vercel"}</strong>
            </li>
          </ul>
          <details className="mt-2 text-legenda text-texto-suave">
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-laranja-escuro">Detalhes da integração</summary>
            <p className="max-w-[70ch] pb-2">Chaves na Vercel: ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN. Ambiente: <strong>{String(ambiente ?? "sandbox")}</strong>. Mude em &quot;asaas.ambiente&quot; abaixo: sandbox para testes, producao para valer.</p>
          </details>
          {!temAsaas && (
            <p className="mt-2 text-sm text-texto-suave">Sem a chave, o site mostra &quot;Pagamento em breve&quot;. Créditos do plano e cortesias funcionam.</p>
          )}
        </Cartao>

        <section id="tipos" className="scroll-mt-6 space-y-4">
          <h2 className="text-xl font-bold text-beringela">Tipos de destaque</h2>
          {tipos.map((t) => (
            <Cartao key={t.slug}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-beringela">{t.nome}</h3>
                <span className="text-legenda text-texto-suave">{t.alvo === "loja" ? "para lojas" : "para anúncios"}</span>
                {!t.ativo && <span className="rounded-full bg-borda px-2 py-0.5 text-[13px] font-semibold text-texto-suave">desligado</span>}
                <span className="ml-auto text-sm font-semibold text-beringela">
                  {t.preco_centavos ? reais(t.preco_centavos) : "Grátis"}
                  {t.dias ? ` / ${t.dias} dias` : ""}
                  {t.vagas_por_regiao ? ` · ${t.vagas_por_regiao} vagas por região` : ""}
                </span>
              </div>
              <FormTipoDestaque tipo={t} />
            </Cartao>
          ))}
        </section>

        <section id="regioes" className="scroll-mt-6"><Cartao>
          <h2 className="mb-1 text-lg font-semibold text-beringela">Preço e dias por região</h2>
          <p className="mb-3 text-sm text-texto-suave">
            Exceção para uma região (ex.: preço de lançamento). Campo vazio = usa o preço ou os dias do tipo. As vagas valem para todas as regiões.
          </p>
          {precosRegiao.length > 0 && (
            <ul className="mb-4 divide-y divide-borda rounded-card border border-borda">
              {precosRegiao.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-semibold text-beringela">{nomeRegiao.get(p.microrregiao_id) ?? "Região"}</span>
                  <span>{nomeTipo.get(p.tipo) ?? p.tipo}</span>
                  <span className="text-texto-suave">
                    {p.preco_centavos != null ? (p.preco_centavos ? reais(p.preco_centavos) : "Grátis") : "preço do tipo"}
                    {p.tipo !== "subir" ? ` · ${p.dias != null ? `${p.dias} dias` : "dias do tipo"}` : ""}
                  </span>
                  <span className="ml-auto">
                    <BotaoRemoverPrecoRegiao id={p.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <FormPrecoRegiao tipos={tipos.map((t) => ({ slug: t.slug, nome: t.nome }))} regioes={regioes} />
        </Cartao></section>

        <section id="creditos" className="scroll-mt-6"><Cartao>
          <h2 className="mb-1 text-lg font-semibold text-beringela">Créditos grátis por mês em cada plano</h2>
          <p className="mb-3 text-sm text-texto-suave">Ex.: Full ganha 4 &quot;Subir&quot; por mês. Os créditos voltam todo dia 1º. 0 = nenhum.</p>
          <FormCreditos
            planos={(planosRes.data ?? []) as { codigo: string; nome: string }[]}
            tipos={tipos.map((t) => ({ slug: t.slug, nome: t.nome }))}
            creditos={creditos}
          />
        </Cartao></section>

        <section id="cortesias" className="scroll-mt-6"><Cartao>
          <h2 className="mb-3 text-lg font-semibold text-beringela">Dar destaque de cortesia</h2>
          <FormCortesia tipos={tipos.map((t) => ({ slug: t.slug, nome: t.nome, dias: t.dias }))} />
        </Cartao></section>

        <section id="ativos" className="scroll-mt-6 space-y-3">
          <h2 className="text-xl font-bold text-beringela">Destaques ativos</h2>
          {ativos.length === 0 ? (
            <Cartao>
              <p className="text-sm text-texto-suave">Nenhum destaque ativo agora. Dê uma cortesia acima para testar.</p>
            </Cartao>
          ) : (
            ativos.map((r) => (
              <Cartao key={r.id}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-beringela">
                      {r.anuncio_id ? (
                        <Link href={linkAnuncio(r.anuncio_id, r.anuncio_titulo)} className="underline underline-offset-4">
                          {r.anuncio_titulo ?? "Anúncio"}
                        </Link>
                      ) : (
                        r.vitrine_nome
                      )}
                    </p>
                    <p className="text-[13px] text-texto-suave">
                      {r.tipo_nome} · {ORIGEM[r.origem] ?? r.origem}
                      {r.origem === "pago" ? ` · ${reais(r.preco_centavos)}` : ""} · {r.vitrine_nome} · de {quando(r.inicio)} até {quando(r.fim)}
                    </p>
                    {r.motivo && <p className="text-[13px] text-texto-suave">Motivo: {r.motivo}</p>}
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-beringela">
                    {inteiro(r.visualizacoes)} visualizações · {inteiro(r.cliques_whatsapp)} cliques no WhatsApp
                  </p>
                </div>
                <div className="mt-2">
                  <BotaoCancelarDestaque id={r.id} />
                </div>
              </Cartao>
            ))
          )}
        </section>

        <section id="cobranca" className="scroll-mt-6 space-y-3">
          <h2 className="text-xl font-bold text-beringela">Pagamentos esperando</h2>
          {pendentes.length === 0 ? (
            <Cartao>
              <p className="text-sm text-texto-suave">Nenhum pagamento de destaque esperando.</p>
            </Cartao>
          ) : (
            <Cartao className="p-0">
              <ul className="divide-y divide-borda">
                {pendentes.map((p) => {
                  const d = Array.isArray(p.destaques) ? p.destaques[0] : p.destaques;
                  const reservaValendo = !!d?.reservado_ate && new Date(d.reservado_ate).getTime() > Date.now();
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                      <span className="font-semibold text-beringela">{p.vitrines_lojas?.nome ?? "Vendedor"}</span>
                      <span>{d ? nomeTipo.get(d.tipo as TipoDestaque["slug"]) ?? d.tipo : "Destaque"}</span>
                      <span className="font-semibold">{reais(p.valor_centavos)}</span>
                      <span className="text-texto-suave">
                        {p.forma === "pix" ? "Pix" : p.forma === "cartao" ? "Cartão" : "não escolheu"} · pedido em {quando(p.criado_em)}
                        {reservaValendo ? ` · vaga guardada até ${quando(d!.reservado_ate)}` : ""}
                        {!p.asaas_cobranca_id ? " · sem cobrança no Asaas" : ""}
                      </span>
                      {p.link_pagamento && (
                        <a href={p.link_pagamento} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline">
                          Ver no Asaas
                        </a>
                      )}
                      {d?.status === "aguardando_pagamento" && (
                        <div className="w-full">
                          <BotaoCancelarDestaque id={d.id} texto="Cancelar pedido" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Cartao>
          )}
        </section>

        {devolver.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-beringela">Pagos sem destaque: devolver o dinheiro</h2>
            <p className="text-sm text-texto-suave">
              O dinheiro chegou, mas o destaque não pôde ser ligado. Faça a devolução no Asaas: quando o Asaas avisar, o pagamento sai desta lista.
            </p>
            <Cartao className="p-0">
              <ul className="divide-y divide-borda">
                {devolver.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                    <span className="font-semibold text-beringela">{p.vitrines_lojas?.nome ?? "Vendedor"}</span>
                    <span className="font-semibold">{reais(p.valor_centavos)}</span>
                    <span className="text-texto-suave">
                      {p.devolver_motivo}
                      {p.pago_em ? ` · pago em ${quando(p.pago_em)}` : ""}
                    </span>
                    {p.link_pagamento && (
                      <a href={p.link_pagamento} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline">
                        Ver no Asaas
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Cartao>
          </section>
        )}

        <details className="rounded-card border border-borda bg-cartao p-4">
          <summary className="min-h-12 cursor-pointer text-lg font-semibold text-beringela focus-visible:outline-2 focus-visible:outline-laranja-escuro">Prazos dos destaques e da cobrança</summary>
          <div className="space-y-4 pt-3">
          {configs.map((c) => (
            <section key={c.id} className="border-t border-borda pt-4">
              <div className="mb-3">
                <h3 className="font-semibold text-beringela">{c.descricao ?? c.chave}</h3>
                <p className="text-[13px] text-texto-suave">{c.chave}</p>
              </div>
              <FormConfig id={c.id} chave={c.chave} tipo={tipoDe(c.valor)} valor={c.valor} />
            </section>
          ))}
          <p className="text-sm text-texto-suave">
            Exceções destes prazos por região ficam em{" "}
            <Link href="/admin/configuracoes?grupo=planos" className="font-semibold text-laranja-escuro underline">
              Configurações
            </Link>
            . Preço e dias por região ficam no cartão &quot;Preço e dias por região&quot; acima.
          </p>
          </div>
        </details>

        {todos.some((r) => r.status !== "ativo") && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-beringela">Últimos encerrados e cancelados</h2>
            <Cartao className="p-0">
              <ul className="divide-y divide-borda">
                {todos
                  .filter((r) => r.status === "encerrado" || r.status === "cancelado")
                  .slice(0, 30)
                  .map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-1 p-4 text-sm">
                      <span className="font-semibold text-beringela">
                        {r.anuncio_id ? r.anuncio_titulo ?? "Anúncio" : r.vitrine_nome}
                      </span>
                      <span>{r.tipo_nome}</span>
                      <span className="text-texto-suave">
                        {r.status === "encerrado" ? "encerrado" : `cancelado${r.motivo ? `: ${r.motivo}` : ""}`} · {inteiro(r.visualizacoes)} visualizações ·{" "}
                        {inteiro(r.cliques_whatsapp)} cliques
                      </span>
                    </li>
                  ))}
              </ul>
            </Cartao>
          </section>
        )}
      </div>
    </>
  );
}
