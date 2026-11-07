import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, Eye, Heart, ImageOff, MessageCircle, Plus } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { meusAnuncios } from "@/lib/dados/anuncios";
import { fraseResultado, resultadosDestaques } from "@/lib/dados/destaques";
import type { ResultadoDestaque } from "@/lib/tipos-destaques";
import { inteiro, linkAnuncio, preco, tempoRelativo } from "@/lib/formato";
import type { MeuAnuncio, StatusAnuncio } from "@/lib/tipos";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { AcoesAnuncio } from "@/components/conta/acoes-anuncio";
import { Aviso } from "@/components/conta/aviso";
import { resumoPlano } from "@/components/conta/resumo-plano";

export const metadata: Metadata = { title: "Meus anúncios" };

// T32 · Meus anúncios: abas por situação; cada linha com foto, preço, números e botões.

const ABAS = [
  { chave: "ativos", nome: "Ativos", status: ["ativo"] },
  { chave: "analise", nome: "Em análise", status: ["em_analise", "congelado"] },
  { chave: "rascunhos", nome: "Rascunhos", status: ["rascunho"] },
  { chave: "pausados", nome: "Pausados", status: ["pausado", "expirado"] },
  { chave: "vendidos", nome: "Vendidos", status: ["vendido"] },
] as const satisfies readonly { chave: string; nome: string; status: readonly StatusAnuncio[] }[];

const ROTULO: Record<StatusAnuncio, { texto: string; cor: string }> = {
  ativo: { texto: "No ar", cor: "bg-sucesso-fundo text-verde-escuro" },
  em_analise: { texto: "Em análise", cor: "bg-aviso-fundo text-aviso" },
  congelado: { texto: "Bloqueado", cor: "bg-perigo-fundo text-perigo" },
  rascunho: { texto: "Rascunho", cor: "bg-fundo text-texto-suave" },
  pausado: { texto: "Pausado", cor: "bg-fundo text-texto-suave" },
  expirado: { texto: "Vencido", cor: "bg-fundo text-texto-suave" },
  vendido: { texto: "Vendido", cor: "bg-beringela text-white" },
};

export default async function PaginaMeusAnuncios({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  const [sp, conta, anuncios, destaques] = await Promise.all([searchParams, meuPerfilEVitrine(), meusAnuncios(), resultadosDestaques()]);

  if (!conta?.vitrine) {
    return (
      <PaginaConta>
        <TopoConta titulo="Meus anúncios" />
        <Vazio titulo="Você ainda não vende no OLAKI" texto="Comece agora: leva poucos minutos.">
          <Botao href="/quero-vender" larguraTotal>Quero vender</Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const contagem = Object.fromEntries(
    ABAS.map((a) => [a.chave, anuncios.filter((x) => (a.status as readonly StatusAnuncio[]).includes(x.status)).length]),
  ) as Record<(typeof ABAS)[number]["chave"], number>;
  const pedida = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const aba =
    ABAS.find((a) => a.chave === pedida) ??
    (contagem.ativos === 0 && contagem.rascunhos > 0 ? ABAS[2] : ABAS[0]);
  const lista = anuncios.filter((x) => (aba.status as readonly StatusAnuncio[]).includes(x.status));
  const plano = resumoPlano(conta);
  // resultado do destaque mais recente de cada anúncio (ativo ou que já acabou)
  const ultimoDestaque = new Map<string, ResultadoDestaque>();
  for (const d of destaques) {
    if (d.anuncio_id && (d.status === "ativo" || d.status === "encerrado") && !ultimoDestaque.has(d.anuncio_id)) ultimoDestaque.set(d.anuncio_id, d);
  }

  return (
    <PaginaConta>
      <TopoConta titulo="Meus anúncios" texto={plano ? plano.uso : undefined}>
        <Botao href="/anunciar" icone={<Plus />} larguraTotal className="sm:w-fit">
          Novo anúncio
        </Botao>
      </TopoConta>

      {!conta.podePublicar && (
        <Aviso tipo="atencao">
          <span>Você está no limite do seu plano. Para pôr mais anúncios no ar, pause um ou troque de plano.</span>
          <Link href="/minha-conta/plano" className="inline-flex min-h-12 items-center underline underline-offset-4">
            Ver planos
          </Link>
        </Aviso>
      )}

      <nav aria-label="Situação dos anúncios" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {ABAS.map((a) => (
            <li key={a.chave}>
              <Chip href={`/minha-conta/anuncios?aba=${a.chave}`} ativo={a.chave === aba.chave} scroll={false}>
                {a.nome}
                <span className="ml-1 opacity-80">({contagem[a.chave]})</span>
              </Chip>
            </li>
          ))}
        </ul>
      </nav>

      {lista.length === 0 ? (
        <Vazio titulo={`Nenhum anúncio em "${aba.nome}"`} texto="Quando tiver, ele aparece aqui.">
          <Botao href="/anunciar" larguraTotal icone={<Plus />}>
            Criar anúncio
          </Botao>
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((a) => (
            <li key={a.id}>
              <LinhaAnuncio anuncio={a} destaque={ultimoDestaque.get(a.id)} />
            </li>
          ))}
        </ul>
      )}
    </PaginaConta>
  );
}

function LinhaAnuncio({ anuncio: a, destaque: d }: { anuncio: MeuAnuncio; destaque?: ResultadoDestaque }) {
  const titulo = a.titulo?.trim() || "Anúncio sem título";
  const rotulo = ROTULO[a.status];
  const capa = a.fotos[0];
  const publico = a.status === "ativo" || a.status === "vendido";
  const pago = !!a.pago_ate && new Date(a.pago_ate).getTime() > Date.now();
  const destaque = !!a.destaque_ate && new Date(a.destaque_ate).getTime() > Date.now();
  const quando = tempoRelativo(a.status === "rascunho" ? a.atualizado_em : a.publicado_em ?? a.criado_em);

  const foto = (
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-campo bg-borda sm:w-28">
      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element -- img simples: leve no 3G e funciona com qualquer host do Storage
        <img src={capa} alt="" width={112} height={112} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-texto-suave">
          <ImageOff className="size-6" aria-hidden />
        </span>
      )}
    </div>
  );

  return (
    <article className="flex flex-col gap-3 rounded-card bg-cartao p-3 shadow-1">
      <div className="flex gap-3">
        {publico ? (
          <Link href={linkAnuncio(a.id, a.titulo)} aria-hidden tabIndex={-1}>
            {foto}
          </Link>
        ) : (
          foto
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${rotulo.cor}`}>{rotulo.texto}</span>
            {destaque && <span className="rounded-full bg-patrocinado-fundo px-2 py-0.5 text-[13px] font-bold text-beringela">Destaque</span>}
            {pago && <span className="rounded-full bg-laranja-claro px-2 py-0.5 text-[13px] font-bold text-laranja-escuro">Avulso pago</span>}
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-5">
            {publico ? (
              <Link href={linkAnuncio(a.id, a.titulo)} className="hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
                {titulo}
              </Link>
            ) : (
              titulo
            )}
          </h2>
          <p className="text-lg font-bold leading-6">{preco(a.preco_centavos)}</p>
          {quando && <p className="text-[13px] text-texto-suave">{a.status === "rascunho" ? `Salvo ${quando}` : quando}</p>}
        </div>
      </div>

      {a.status === "em_analise" && a.motivo_analise && (
        <p className="rounded-card bg-aviso-fundo p-2 text-sm font-semibold text-aviso">Motivo: {a.motivo_analise}</p>
      )}
      {a.status === "congelado" && (
        <p className="rounded-card bg-perigo-fundo p-2 text-sm font-semibold text-perigo">Este anúncio foi bloqueado pela equipe. Fale com o suporte.</p>
      )}

      {a.status !== "rascunho" && (
        <dl className="grid grid-cols-3 gap-2 rounded-card bg-fundo p-2 text-center">
          <Numero icone={<Eye />} rotulo="visualizações" valor={a.visualizacoes} />
          <Numero icone={<MessageCircle />} rotulo="cliques no WhatsApp" valor={a.cliques_whatsapp} />
          <Numero icone={<Heart />} rotulo="favoritos" valor={a.total_favoritos} />
        </dl>
      )}

      {d && (
        <p className="flex items-start gap-2 rounded-card bg-laranja-claro p-2 text-sm">
          <BarChart3 className="mt-0.5 size-4 shrink-0 text-laranja-escuro" aria-hidden />
          <span>
            {d.status === "ativo" ? `${d.tipo_nome}: seu destaque` : `Seu último destaque (${d.tipo_nome})`} teve {fraseResultado(d)}.
          </span>
        </p>
      )}

      <AcoesAnuncio id={a.id} status={a.status} titulo={titulo} />
    </article>
  );
}

function Numero({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="order-2 text-[13px] leading-4 text-texto-suave">{rotulo}</dt>
      <dd className="order-1 flex items-center gap-1 text-base font-bold">
        <span className="inline-flex text-laranja-escuro [&>svg]:size-4" aria-hidden>
          {icone}
        </span>
        {inteiro(valor)}
      </dd>
    </div>
  );
}
