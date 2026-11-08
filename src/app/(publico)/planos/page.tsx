import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Check, ChevronDown, Minus, Star } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { perguntasDosPlanos, planosPublicos } from "@/lib/dados/vitrine-completa";
import { preco } from "@/lib/formato";
import type { PlanoPublico } from "@/lib/tipos-vitrine";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";

// Página pública dos planos. Tudo vem da tabela planos (painel, tela 2) e as perguntas da
// configuração planos.perguntas_frequentes: nenhum preço ou limite fica no código.
// Botão de cada plano: vendedor logado → Meu plano (assinar); logado sem loja → abrir loja;
// visitante → entrar e voltar para cá.

export const metadata: Metadata = {
  title: "Planos",
  description: "Veja os planos do OLAKI para vender na sua região: anúncios, Radar de Negócios e vitrine da loja.",
  alternates: { canonical: "/planos" },
};

type Props = { searchParams: Promise<{ origem?: string | string[] }> };

function lerOrigem(v: string | string[] | undefined): string | null {
  const o = Array.isArray(v) ? v[0] : v;
  return o && /^[a-z0-9_-]{1,30}$/.test(o) ? o : null;
}

function textoPreco(p: PlanoPublico): { valor: string; periodo: string | null } {
  if (p.preco_centavos === 0) return { valor: "Grátis", periodo: p.e_teste ? `por ${p.periodo_dias} dias` : null };
  return { valor: preco(p.preco_centavos), periodo: p.periodo_dias === 30 ? "por mês" : `a cada ${p.periodo_dias} dias` };
}

function quantos(n: number | null, um: string, varios: string): string {
  return n === null ? `${varios.charAt(0).toUpperCase()}${varios.slice(1)} sem limite` : `Até ${n} ${n === 1 ? um : varios}`;
}

export default async function PaginaPlanos({ searchParams }: Props) {
  const [sp, { userId }] = await Promise.all([searchParams, auth()]);
  const origem = lerOrigem(sp.origem);
  const [planos, perguntas, conta] = await Promise.all([planosPublicos(), perguntasDosPlanos(), userId ? meuPerfilEVitrine() : Promise.resolve(null)]);
  const voltar = `/planos${origem ? `?origem=${origem}` : ""}`;
  const entrar = `/entrar?redirect_url=${encodeURIComponent(voltar)}`;
  const vendedor = !!conta?.vitrine;
  const loja = conta?.vitrine?.tipo === "loja";
  const atual = conta?.plano?.codigo ?? null;

  function acao(p: PlanoPublico): { href: string; texto: string } | null {
    if (atual === p.codigo) return null;
    if (!userId) return { href: entrar, texto: p.preco_centavos > 0 ? "Entrar para assinar" : "Entrar e começar" };
    if (p.e_teste) return vendedor ? null : { href: "/quero-vender/loja", texto: "Abrir minha loja grátis" };
    if (p.publico === "pf" && p.preco_centavos === 0) return vendedor ? null : { href: "/quero-vender", texto: "Começar a vender" };
    if (!vendedor) return { href: p.publico === "pf" ? "/quero-vender" : "/quero-vender/loja", texto: "Começar a vender" };
    return { href: `/minha-conta/plano?origem=${encodeURIComponent(origem ?? "planos")}&plano=${encodeURIComponent(p.codigo)}`, texto: `Quero o ${p.nome.replace(/^Plano\s+/i, "")}` };
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold leading-7">Planos do OLAKI</h1>
        <p className="text-base text-texto-suave">
          Escolha como quer vender na sua região. Você pode mudar de plano quando quiser.
        </p>
        {origem === "vitrine" && (
          <p className="rounded-card bg-laranja-claro p-3 text-base font-semibold">
            Foto da fachada, seções próprias e produtos no topo da vitrine estão nos planos marcados abaixo.
          </p>
        )}
        {origem === "radar" && (
          <p className="rounded-card bg-laranja-claro p-3 text-base font-semibold">
            Para ver os pedidos do Radar e mandar propostas, escolha um plano com Radar.
          </p>
        )}
      </header>

      {planos.length === 0 ? (
        <Vazio titulo="Os planos estão sendo atualizados" texto="Volte daqui a pouco ou fale com o suporte do OLAKI.">
          <Botao href="/" larguraTotal>
            Voltar ao início
          </Botao>
        </Vazio>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planos.map((p) => {
            const valor = textoPreco(p);
            const cta = acao(p);
            const destaque = p.recomendado;
            const eAtual = atual === p.codigo;
            return (
              <li
                key={p.codigo}
                className={`relative flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1 ${
                  destaque ? "border-2 border-laranja-escuro" : "border-2 border-transparent"
                }`}
              >
                {destaque && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-laranja-claro px-3 py-1 text-[13px] font-bold text-beringela">
                    <Star className="size-4 text-laranja-escuro" aria-hidden /> Mais escolhido
                  </span>
                )}
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{p.nome}</h2>
                  <p>
                    <span className="text-2xl font-bold">{valor.valor}</span>
                    {valor.periodo && <span className="text-base text-texto-suave"> {valor.periodo}</span>}
                  </p>
                  {p.descricao && <p className="text-base text-texto-suave">{p.descricao}</p>}
                  {p.publico !== "todos" && (
                    <p className="text-[13px] font-semibold text-texto-suave">{p.publico === "pf" ? "Para pessoa física" : "Para lojas e empresas"}</p>
                  )}
                </div>

                <ul className="flex flex-col gap-2 text-base">
                  <Item sim>{p.limite_anuncios === null ? "Anúncios sem limite" : quantos(p.limite_anuncios, "anúncio no ar", "anúncios no ar")}</Item>
                  <Item sim={p.acesso_radar}>
                    {p.acesso_radar
                      ? p.propostas_radar_mes === null
                        ? "Radar de Negócios: propostas sem limite"
                        : `Radar de Negócios: ${p.propostas_radar_mes} ${p.propostas_radar_mes === 1 ? "proposta" : "propostas"}${p.e_teste ? "" : " por mês"}`
                      : "Sem Radar de Negócios"}
                  </Item>
                  {p.publico !== "pf" && (
                    <>
                      <Item sim>Vitrine da loja com banner modelo e informações</Item>
                      <Item sim={p.vitrine_foto_fachada}>{p.vitrine_foto_fachada ? "Foto da fachada no banner" : "Sem foto da fachada"}</Item>
                      <Item sim={p.vitrine_secoes_max !== 0}>
                        {p.vitrine_secoes_max === 0 ? "Sem seções próprias" : quantos(p.vitrine_secoes_max, "seção própria", "seções próprias")}
                      </Item>
                      <Item sim={p.vitrine_fixados_max !== 0}>
                        {p.vitrine_fixados_max === 0 ? "Sem produtos no topo" : quantos(p.vitrine_fixados_max, "produto no topo", "produtos no topo")}
                      </Item>
                    </>
                  )}
                </ul>

                <div className="mt-auto pt-1">
                  {eAtual ? (
                    <p className="inline-flex min-h-12 items-center font-semibold text-verde-escuro">Seu plano atual</p>
                  ) : cta ? (
                    <Botao href={cta.href} variante={destaque ? "primario" : "secundario"} larguraTotal>
                      {cta.texto}
                    </Botao>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loja && (
        <p className="text-base text-texto-suave">
          Quer ver o seu uso e os pagamentos?{" "}
          <Link href="/minha-conta/plano" className="inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
            Abrir Meu plano
          </Link>
        </p>
      )}

      {perguntas.length > 0 && (
        <section aria-labelledby="titulo-perguntas" className="flex flex-col gap-3">
          <h2 id="titulo-perguntas" className="text-lg font-semibold">
            Perguntas frequentes
          </h2>
          <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
            {perguntas.map((q) => (
              <li key={q.pergunta}>
                <details className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro [&::-webkit-details-marker]:hidden">
                    {q.pergunta}
                    <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                  </summary>
                  <p className="px-4 pb-4 text-base text-texto-suave">{q.resposta}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Item({ sim, children }: { sim: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-start gap-2 ${sim ? "" : "text-texto-suave"}`}>
      {sim ? (
        <Check className="mt-0.5 size-5 shrink-0 text-verde-escuro" aria-hidden />
      ) : (
        <Minus className="mt-0.5 size-5 shrink-0 text-texto-suave" aria-hidden />
      )}
      <span>
        <span className="sr-only">{sim ? "Tem: " : "Não tem: "}</span>
        {children}
      </span>
    </li>
  );
}
