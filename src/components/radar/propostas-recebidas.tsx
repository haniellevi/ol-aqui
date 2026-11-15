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
import { FOCO_LINK } from "./util";
import { AtualizarRadar } from "./atualizar-radar";
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

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="titulo-propostas">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 id="titulo-propostas" className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-lg font-semibold text-beringela">
          Ofertas recebidas
          <span className="text-sm font-normal text-texto-suave">
            {propostas.length === 1 ? "1 proposta" : `${propostas.length} propostas`}
          </span>
        </h2>
        <AtualizarRadar tamanho="toque" className="px-2" />
      </header>
      {lista.length === 0 ? (
        <Vazio
          className="gap-2 p-3 [&_[data-slot=empty-icon]]:hidden"
          icone={<Inbox />}
          titulo="Nenhuma proposta ainda"
          texto={modoPrazo ? "Você recebe um aviso quando chegar uma oferta." : "As lojas que se interessarem vão te chamar no WhatsApp."}
        >
          <Botao href="/busca" variante="secundario" tamanho="toque">
            Procurar nos anúncios
          </Botao>
        </Vazio>
      ) : (
        <>
          {lista.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Ordenar propostas">
              <Chip tamanho="toque" ativo={ordem === "preco"} onClick={() => setOrdem("preco")}>
                Menor preço
              </Chip>
              <Chip tamanho="toque" ativo={ordem === "novas"} onClick={() => setOrdem("novas")}>
                Mais novas
              </Chip>
            </div>
          )}
          <ul className="flex flex-col gap-2.5">
            {lista.map((p) => (
              <li key={p.id}>
                <CartaoProposta p={p} podeEscolher={podeEscolher} />
              </li>
            ))}
          </ul>
        </>
      )}
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
    <article className="flex min-w-0 flex-col gap-2 rounded-card border border-borda bg-cartao p-3 sm:p-4">
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {p.loja_logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo da loja no Storage
          <img src={p.loja_logo} alt="" width={32} height={32} className="size-8 shrink-0 rounded-full bg-borda object-cover" />
        ) : (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-selecao text-beringela" aria-hidden>
            <Store className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {p.loja_slug ? (
            <Link href={linkLoja(p.loja_slug)} className={`inline-flex min-h-11 max-w-full items-center text-lg font-semibold text-beringela underline-offset-4 hover:underline md:min-h-9 ${FOCO_LINK}`}>
              <span className="min-w-0 [overflow-wrap:anywhere]">{formatarNome(p.loja_nome)}</span>
            </Link>
          ) : (
            <span className="text-lg font-semibold [overflow-wrap:anywhere]">{formatarNome(p.loja_nome)}</span>
          )}
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-texto-suave">
            {p.loja_selo && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-verde-escuro">
                <BadgeCheck className="size-4 shrink-0" aria-hidden />
                Loja verificada
              </span>
            )}
            <span>{tempoRelativo(p.criado_em)}</span>
          </p>
        </div>
        {p.escolhida && (
          <Badge variant="success">
            <Star className="size-3.5" aria-hidden />
            Você escolheu
          </Badge>
        )}
      </header>

      <div className="flex items-start gap-3">
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element -- foto da proposta no Storage
          <img src={foto} alt={formatarNome(p.anuncio_titulo) || "Foto da oferta"} width={64} height={64} className="size-16 shrink-0 rounded-campo bg-borda object-cover" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-2xl font-bold text-beringela [overflow-wrap:anywhere]">{p.preco_centavos != null ? preco(p.preco_centavos) : "Preço a combinar"}</p>
          {p.mensagem && <p className="text-lg whitespace-pre-line text-texto [overflow-wrap:anywhere]">{p.mensagem}</p>}
        </div>
      </div>

      {(podeEscolher || (p.anuncio_id && p.anuncio_titulo)) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {podeEscolher && (
            <Botao variante="whatsapp" tamanho="toque" icone={<MessageCircle />} onClick={chamar} carregando={abrindo} textoCarregando="Abrindo o WhatsApp...">
              Chamar no WhatsApp
            </Botao>
          )}
          {p.anuncio_id && p.anuncio_titulo && (
            <Botao href={linkAnuncio(p.anuncio_id, p.anuncio_titulo, p.anuncio_slug)} aria-label={`Ver anúncio: ${formatarNome(p.anuncio_titulo)}`} variante="secundario" tamanho="toque">
              Ver anúncio
            </Botao>
          )}
          {podeEscolher && linkContato && (
            <Botao href={linkContato} target="_blank" rel="noopener noreferrer" variante="secundario" tamanho="toque">Continuar no WhatsApp</Botao>
          )}
        </div>
      )}
      {erro && <p role="alert" className="text-lg font-semibold text-perigo">{erro}</p>}
    </article>
  );
}
