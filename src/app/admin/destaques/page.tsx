import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { inteiro, quando, reais } from "@/lib/admin/formato";
import { tipoDe } from "@/lib/admin/config";
import { asaasConfigurado, webhookConfigurado } from "@/lib/asaas";
import { linkAnuncio } from "@/lib/formato";
import { Cartao, Numero, Titulo } from "@/components/admin/ui";
import { FormConfig } from "../configuracoes/form-config";
import { BotaoCancelarDestaque, FormCortesia, FormCreditos, FormTipoDestaque } from "./formularios";
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
  "cobranca.vencimento_dias",
  "asaas.ambiente",
];

const ORIGEM: Record<string, string> = { pago: "Pago", credito: "Crédito do plano", cortesia: "Cortesia" };

type Config = { id: string; chave: string; valor: unknown; descricao: string | null };
type Pendente = {
  id: string;
  valor_centavos: number;
  forma: string | null;
  criado_em: string;
  vencimento: string | null;
  asaas_cobranca_id: string | null;
  link_pagamento: string | null;
  vitrines_lojas: { nome: string } | null;
  destaques: { tipo: string; status: string; reservado_ate: string | null } | { tipo: string; status: string; reservado_ate: string | null }[] | null;
};

export default async function DestaquesAdminPage() {
  const { supabase } = await exigirAdmin();
  const [tiposRes, creditosRes, planosRes, configsRes, ativosRes, pendentesRes] = await Promise.all([
    supabase.from("destaque_tipos").select("*").order("ordem"),
    supabase.from("destaque_creditos_plano").select("plano_codigo, tipo, quantidade_mes"),
    supabase.from("planos").select("codigo, nome, ordem").order("ordem"),
    supabase.from("configuracoes").select("id, chave, valor, descricao").in("chave", CHAVES_CONFIG).is("microrregiao_id", null),
    supabase.rpc("resultados_destaques", { p_anuncio_id: null, p_todos: true, p_limite: 200 }),
    supabase
      .from("pagamentos")
      .select("id, valor_centavos, forma, criado_em, vencimento, asaas_cobranca_id, link_pagamento, vitrines_lojas(nome), destaques(tipo, status, reservado_ate)")
      .eq("tipo", "destaque")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false })
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

      <div className="space-y-6">
        <Cartao>
          <h2 className="mb-2 text-lg font-semibold text-beringela">Pagamento (Asaas)</h2>
          <ul className="space-y-1 text-sm">
            <li>
              Chave da API (ASAAS_API_KEY):{" "}
              <strong className={temAsaas ? "text-verde-escuro" : "text-perigo"}>{temAsaas ? "configurada" : "falta na Vercel"}</strong>
            </li>
            <li>
              Token do aviso (ASAAS_WEBHOOK_TOKEN):{" "}
              <strong className={temWebhook ? "text-verde-escuro" : "text-perigo"}>{temWebhook ? "configurado" : "falta na Vercel"}</strong>
            </li>
            <li>
              Ambiente: <strong>{String(ambiente ?? "sandbox")}</strong> (mude em &quot;asaas.ambiente&quot; abaixo: sandbox para testes, producao para valer)
            </li>
          </ul>
          {!temAsaas && (
            <p className="mt-2 text-sm text-texto-suave">Sem a chave, o site mostra &quot;Pagamento em breve&quot;. Créditos do plano e cortesias funcionam.</p>
          )}
        </Cartao>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-beringela">Tipos de destaque</h2>
          {tipos.map((t) => (
            <Cartao key={t.slug}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-beringela">{t.nome}</h3>
                <span className="rounded-full bg-fundo px-2 py-0.5 text-[13px] text-texto-suave">{t.alvo === "loja" ? "para lojas" : "para anúncios"}</span>
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

        <Cartao>
          <h2 className="mb-1 text-lg font-semibold text-beringela">Créditos grátis por mês em cada plano</h2>
          <p className="mb-3 text-sm text-texto-suave">Ex.: Full ganha 4 &quot;Subir&quot; por mês. Os créditos voltam todo dia 1º. 0 = nenhum.</p>
          <FormCreditos
            planos={(planosRes.data ?? []) as { codigo: string; nome: string }[]}
            tipos={tipos.map((t) => ({ slug: t.slug, nome: t.nome }))}
            creditos={creditos}
          />
        </Cartao>

        <Cartao>
          <h2 className="mb-3 text-lg font-semibold text-beringela">Dar destaque de cortesia</h2>
          <FormCortesia tipos={tipos.map((t) => ({ slug: t.slug, nome: t.nome, dias: t.dias }))} />
        </Cartao>

        <section className="space-y-3">
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

        <section className="space-y-3">
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
                    </li>
                  );
                })}
              </ul>
            </Cartao>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-beringela">Prazos dos destaques e da cobrança</h2>
          {configs.map((c) => (
            <Cartao key={c.id}>
              <div className="mb-3">
                <h3 className="font-semibold text-beringela">{c.descricao ?? c.chave}</h3>
                <p className="text-[13px] text-texto-suave">{c.chave}</p>
              </div>
              <FormConfig id={c.id} chave={c.chave} tipo={tipoDe(c.valor)} valor={c.valor} />
            </Cartao>
          ))}
          <p className="text-sm text-texto-suave">
            Exceções por região ficam em{" "}
            <Link href="/admin/configuracoes?grupo=planos" className="font-semibold text-laranja-escuro underline">
              Configurações
            </Link>
            .
          </p>
        </section>

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
