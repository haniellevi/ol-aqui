import { formatarNome } from "@/lib/formatar-nome";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, Eye, MessageCircle, Sparkles } from "lucide-react";
import { anuncioDaLoja } from "@/lib/dados/anuncios";
import { contaDaLoja } from "@/lib/dados/conta";
import { ehUuid, linkAnuncio, urlAbsoluta } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { BotaoNovoRascunho } from "@/components/anunciar/botao-novo-rascunho";
import { urlPasso } from "@/components/anunciar/passos";
import { linkDestacar } from "@/lib/rotas";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Situação do anúncio" };

type Params = Promise<{ id?: string | string[]; status?: string | string[] }>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// T23 · "Seu anúncio está no ar!" (ou "em análise", quando o filtro automático segurou).
export default async function PaginaPronto({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const id = um(sp.id);
  if (!ehUuid(id)) notFound();
  const anuncio = await anuncioDaLoja(id);
  if (!anuncio) notFound();
  // P5c: produto de loja em montagem fica pronto (rascunho) até o dono aceitar a loja.
  if (anuncio.status === "rascunho" && anuncio.pronto_em) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-2.5 py-5 text-center md:gap-5 md:px-4 md:py-8">
        <span className="grid size-12 place-items-center md:size-16 rounded-full bg-aviso-fundo text-aviso" aria-hidden>
          <Clock className="size-6 md:size-8" />
        </span>
        <h1 className="text-xl font-semibold text-beringela">Produto pronto</h1>
        <p className="max-w-sm text-sm text-texto-suave md:text-base">
          A loja ainda está em montagem. Este produto vai ao ar quando o dono aceitar a loja, depois da conferência de sempre.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Botao href="/minha-conta/anuncios" larguraTotal>
            Ver produtos da loja
          </Botao>
          <BotaoNovoRascunho variante="secundario" texto="Cadastrar outro" />
        </div>
      </main>
    );
  }
  // ainda não publicado (ex.: abriu o endereço direto): volta para o Revisar
  if (anuncio.status !== "ativo" && anuncio.status !== "em_analise") redirect(urlPasso("revisar", anuncio.id, anuncio.status !== "rascunho"));

  // P5b: Destacar é pago e fica com o dono da loja.
  const ajudante = (await contaDaLoja(false, anuncio.vitrine_id))?.ajudante === true;
  const emAnalise = anuncio.status === "em_analise"; // o banco decide (?status=analise só deixa o link legível)

  if (emAnalise) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-2.5 py-5 text-center md:gap-5 md:px-4 md:py-8">
        <span className="grid size-12 place-items-center md:size-16 rounded-full bg-aviso-fundo text-aviso" aria-hidden>
          <Clock className="size-6 md:size-8" />
        </span>
        <h1 className="text-xl font-semibold text-beringela">Seu anúncio está em análise</h1>
        <p className="max-w-sm text-sm text-texto-suave md:text-base">
          A equipe precisa conferir este anúncio antes de ele aparecer. Você pode acompanhar a situação em Meus anúncios.
        </p>
        {anuncio.motivo_analise && (
          <Alert variant="warning" role="note" className="w-full max-w-sm">
            <strong>Motivo:</strong> {anuncio.motivo_analise}
          </Alert>
        )}
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Botao href="/minha-conta/anuncios" larguraTotal>
            Ver meus anúncios
          </Botao>
          <Botao href={urlPasso("revisar", anuncio.id, true)} variante="secundario" larguraTotal>
            Revisar anúncio
          </Botao>
          <BotaoNovoRascunho variante="secundario" texto="Anunciar outro" />
        </div>
      </main>
    );
  }

  const titulo = formatarNome(anuncio.titulo) || "meu anúncio";
  const url = urlAbsoluta(linkAnuncio(anuncio.id, anuncio.titulo, anuncio.slug));
  const compartilhar = `https://wa.me/?text=${encodeURIComponent(`Olha o que estou vendendo no Mercado da Região: *${titulo}* ${url}`)}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-2.5 py-5 text-center md:gap-5 md:px-4 md:py-8">
      <span className="grid size-12 place-items-center md:size-16 rounded-full bg-sucesso-fundo text-verde-escuro" aria-hidden>
        <CheckCircle2 className="size-6 md:size-8" />
      </span>
      <h1 className="text-xl font-semibold text-beringela">Seu anúncio está no ar!</h1>
      <p className="max-w-sm text-sm text-texto-suave md:text-base">
        Seu anúncio já pode ser visto e compartilhado.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Botao href={linkAnuncio(anuncio.id, anuncio.titulo, anuncio.slug)} larguraTotal icone={<Eye />}>
          Ver anúncio
        </Botao>
        <Botao href={compartilhar} variante="secundario" larguraTotal icone={<MessageCircle />} target="_blank" rel="noopener noreferrer">
          Compartilhar no WhatsApp
        </Botao>
        <BotaoNovoRascunho variante="secundario" texto="Anunciar outro" />
        {!ajudante && (
          <Botao href={linkDestacar(anuncio.id)} variante="texto" larguraTotal icone={<Sparkles />}>
            Destacar anúncio
          </Botao>
        )}
      </div>
    </main>
  );
}
