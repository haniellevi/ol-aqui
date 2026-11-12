import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, Eye, MessageCircle, Sparkles } from "lucide-react";
import { meuAnuncio } from "@/lib/dados/anuncios";
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
  const anuncio = await meuAnuncio(id);
  if (!anuncio) notFound();
  // ainda não publicado (ex.: abriu o endereço direto): volta para o Revisar
  if (anuncio.status !== "ativo" && anuncio.status !== "em_analise") redirect(urlPasso("revisar", anuncio.id, anuncio.status !== "rascunho"));

  const emAnalise = anuncio.status === "em_analise"; // o banco decide (?status=analise só deixa o link legível)

  if (emAnalise) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-8 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-aviso-fundo text-aviso" aria-hidden>
          <Clock className="size-10" />
        </span>
        <h1 className="text-titulo font-semibold text-beringela">Seu anúncio está em análise</h1>
        <p className="max-w-sm text-base text-texto-suave">
          A equipe precisa conferir este anúncio antes de ele aparecer. Você pode acompanhar a situação em Meus anúncios.
        </p>
        {anuncio.motivo_analise && (
          <Alert variant="warning" role="note" className="w-full max-w-sm">
            <strong>Motivo:</strong> {anuncio.motivo_analise}
          </Alert>
        )}
        <div className="flex w-full max-w-sm flex-col gap-3">
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

  const titulo = anuncio.titulo ?? "meu anúncio";
  const url = urlAbsoluta(linkAnuncio(anuncio.id, anuncio.titulo, anuncio.slug));
  const compartilhar = `https://wa.me/?text=${encodeURIComponent(`Olha o que estou vendendo no Mercado da Região: *${titulo}* ${url}`)}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-8 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-sucesso-fundo text-verde-escuro" aria-hidden>
        <CheckCircle2 className="size-10" />
      </span>
      <h1 className="text-titulo font-semibold text-beringela">Seu anúncio está no ar!</h1>
      <p className="max-w-sm text-base text-texto-suave">
        Mande para seus contatos e grupos do WhatsApp. Quem vê o anúncio fala com você direto no WhatsApp.
      </p>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Botao href={compartilhar} variante="whatsapp" larguraTotal icone={<MessageCircle />} target="_blank" rel="noopener noreferrer">
          Compartilhar no WhatsApp
        </Botao>
        <Botao href={linkAnuncio(anuncio.id, anuncio.titulo, anuncio.slug)} variante="secundario" larguraTotal icone={<Eye />}>
          Ver anúncio
        </Botao>
        <BotaoNovoRascunho variante="secundario" texto="Anunciar outro" />
        <div className="flex flex-col gap-1 rounded-card bg-cartao p-3 shadow-1">
          <Botao href={linkDestacar(anuncio.id)} variante="secundario" larguraTotal icone={<Sparkles />} aria-describedby="destacar-dica">
            Destacar
          </Botao>
          <p id="destacar-dica" className="text-sm text-texto-suave">
            Quer que mais gente veja? Destacar põe seu anúncio na frente.
          </p>
        </div>
      </div>
    </main>
  );
}
