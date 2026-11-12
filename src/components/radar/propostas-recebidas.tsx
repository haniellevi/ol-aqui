"use client";

import { formatarNome } from "@/lib/formatar-nome";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Inbox, MessageCircle, Star, Store } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { escolherProposta } from "@/app/radar/actions";
import { linkAnuncio, linkLoja, preco, tempoRelativo } from "@/lib/formato";
import type { PropostaRecebida } from "@/lib/tipos-radar";
import { Badge } from "@/components/ui/badge";

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
  const trava = useRef(false);
  const [linkContato, setLinkContato] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, iniciar] = useTransition();
  const foto = p.foto_url ?? p.anuncio_capa;

  function chamar() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    // Abre a aba já no toque (o Safari do iPhone bloqueia janelas abertas depois de esperar o servidor).
    const aba = window.open("", "_blank");
    if (aba) aba.opener = null;
    iniciar(async () => {
      try {
        const r = await escolherProposta(p.id);
        if (!r.ok) {
          aba?.close();
          setErro(r.erro);
          return;
        }
        setLinkContato(r.linkWhatsapp);
        if (aba) {
          aba.location.href = r.linkWhatsapp;
          router.refresh(); // mostra "Você escolheu" nesta proposta
        } else router.refresh();
      } catch {
        aba?.close();
        setErro("Não foi possível abrir o contato. Tente novamente.");
      } finally { trava.current = false; }
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4 shadow-1">
      <header className="flex flex-wrap items-center gap-3">
        {p.loja_logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo da loja no Storage
          <img src={p.loja_logo} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full bg-borda object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-selecao text-beringela" aria-hidden>
            <Store className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {p.loja_slug ? (
            <Link href={linkLoja(p.loja_slug)} className="text-base font-semibold break-words underline-offset-4 hover:underline">
              {formatarNome(p.loja_nome)}
            </Link>
          ) : (
            <span className="text-base font-semibold break-words">{formatarNome(p.loja_nome)}</span>
          )}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-legenda text-texto-suave">
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
          <Badge variant="success">
            <Star className="size-3.5" aria-hidden />
            Você escolheu
          </Badge>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element -- foto da proposta no Storage
          <img src={foto} alt={formatarNome(p.anuncio_titulo) || "Foto da oferta"} width={96} height={96} className="size-24 shrink-0 rounded-campo bg-borda object-cover" />
        )}
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xl font-bold break-words text-beringela">{p.preco_centavos != null ? preco(p.preco_centavos) : "Preço a combinar"}</span>
          {p.mensagem && <p className="text-base leading-6 break-words whitespace-pre-line text-texto">{p.mensagem}</p>}
          {p.anuncio_id && p.anuncio_titulo && (
            <Link href={linkAnuncio(p.anuncio_id, p.anuncio_titulo, p.anuncio_slug)} className="min-h-10 content-center text-base leading-6 font-semibold text-laranja-escuro underline underline-offset-4">
              Ver anúncio: {formatarNome(p.anuncio_titulo)}
            </Link>
          )}
        </div>
      </div>

      {podeEscolher && (
        <Botao variante="whatsapp" larguraTotal icone={<MessageCircle />} onClick={chamar} carregando={abrindo} textoCarregando="Abrindo o WhatsApp...">
          Chamar no WhatsApp
        </Botao>
      )}
      {podeEscolher && linkContato && <Botao href={linkContato} target="_blank" rel="noopener noreferrer" variante="secundario" larguraTotal>Continuar no WhatsApp</Botao>}
      {erro && (
        <p role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
    </article>
  );
}
