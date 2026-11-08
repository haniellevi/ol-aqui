"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Inbox, MessageCircle, Star, Store } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { escolherProposta } from "@/app/radar/actions";
import { linkAnuncio, linkLoja, preco, tempoRelativo } from "@/lib/formato";
import type { PropostaRecebida } from "@/lib/tipos-radar";

type Ordem = "preco" | "novas";

// Propostas que o comprador recebeu: compara preço, foto e loja; o WhatsApp só sai do servidor ao escolher.
export function PropostasRecebidas({
  propostas,
  podeEscolher,
  modoPrazo,
}: {
  propostas: PropostaRecebida[];
  podeEscolher: boolean;
  modoPrazo: boolean;
}) {
  const [ordem, setOrdem] = useState<Ordem>("preco");
  const lista = useMemo(() => {
    const l = [...propostas];
    if (ordem === "novas") l.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    else l.sort((a, b) => (a.preco_centavos ?? Number.MAX_SAFE_INTEGER) - (b.preco_centavos ?? Number.MAX_SAFE_INTEGER));
    return l;
  }, [propostas, ordem]);

  if (propostas.length === 0) {
    return (
      <Vazio
        icone={<Inbox />}
        titulo="Nenhuma proposta ainda"
        texto={modoPrazo ? "Quando uma loja mandar oferta, ela aparece aqui e avisamos você." : "As lojas que se interessarem vão te chamar no WhatsApp."}
      >
        <Botao href="/busca" variante="secundario" larguraTotal>
          Procurar nos anúncios
        </Botao>
      </Vazio>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-propostas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-propostas" className="text-lg font-bold">
          {propostas.length === 1 ? "1 proposta" : `${propostas.length} propostas`}
        </h2>
        {propostas.length > 1 && (
          <div className="flex gap-2">
            <Chip ativo={ordem === "preco"} onClick={() => setOrdem("preco")}>
              Menor preço
            </Chip>
            <Chip ativo={ordem === "novas"} onClick={() => setOrdem("novas")}>
              Mais novas
            </Chip>
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {lista.map((p) => (
          <li key={p.id}>
            <CartaoProposta p={p} podeEscolher={podeEscolher} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CartaoProposta({ p, podeEscolher }: { p: PropostaRecebida; podeEscolher: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, iniciar] = useTransition();
  const foto = p.foto_url ?? p.anuncio_capa;

  function chamar() {
    setErro(null);
    // Abre a aba já no toque (o Safari do iPhone bloqueia janelas abertas depois de esperar o servidor).
    const aba = window.open("", "_blank");
    iniciar(async () => {
      const r = await escolherProposta(p.id);
      if (!r.ok) {
        aba?.close();
        setErro(r.erro);
        return;
      }
      if (aba) {
        aba.location.href = r.linkWhatsapp;
        router.refresh(); // mostra "Você chamou" nesta proposta
      } else window.location.href = r.linkWhatsapp;
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4 shadow-1">
      <header className="flex items-center gap-3">
        {p.loja_logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo da loja no Storage
          <img src={p.loja_logo} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full bg-borda object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-laranja-claro text-beringela" aria-hidden>
            <Store className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {p.loja_slug ? (
            <Link href={linkLoja(p.loja_slug)} className="truncate text-base font-semibold underline-offset-4 hover:underline">
              {p.loja_nome}
            </Link>
          ) : (
            <span className="truncate text-base font-semibold">{p.loja_nome}</span>
          )}
          <span className="flex items-center gap-2 text-[13px] text-texto-suave">
            {p.loja_selo && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-verde-escuro">
                <BadgeCheck className="size-4" aria-hidden />
                Loja verificada
              </span>
            )}
            <span>{tempoRelativo(p.criado_em)}</span>
          </span>
        </div>
        {p.escolhida && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sucesso-fundo px-2 py-0.5 text-[13px] font-semibold text-verde-escuro">
            <Star className="size-3.5" aria-hidden />
            Você chamou
          </span>
        )}
      </header>

      <div className="flex gap-3">
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element -- foto da proposta no Storage
          <img src={foto} alt={p.anuncio_titulo ?? "Foto da oferta"} width={96} height={96} className="size-24 shrink-0 rounded-campo bg-borda object-cover" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xl font-bold text-beringela">{p.preco_centavos != null ? preco(p.preco_centavos) : "Preço a combinar"}</span>
          {p.mensagem && <p className="whitespace-pre-line text-[15px] text-texto">{p.mensagem}</p>}
          {p.anuncio_id && p.anuncio_titulo && (
            <Link href={linkAnuncio(p.anuncio_id, p.anuncio_titulo)} className="min-h-12 content-center text-[15px] font-semibold text-laranja-escuro underline underline-offset-4">
              Ver anúncio: {p.anuncio_titulo}
            </Link>
          )}
        </div>
      </div>

      {podeEscolher && (
        <Botao variante="whatsapp" larguraTotal icone={<MessageCircle />} onClick={chamar} carregando={abrindo} textoCarregando="Abrindo o WhatsApp...">
          Chamar no WhatsApp
        </Botao>
      )}
      {erro && (
        <p role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
    </article>
  );
}
