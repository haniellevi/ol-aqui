import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { preco } from "@/lib/formato";
import { dataHoraCurta } from "@/components/radar/util";
import type { MensagemConversa, PapelConversa } from "@/lib/tipos-conversas";

export const ALERTA_GOLPE = "Nunca pague adiantado sem ver o produto.";
export const AVISO_ACOMPANHA = "O Mercado da Região acompanha esta conversa para sua segurança e para saber se você já resolveu.";

const LINK = "font-semibold text-laranja-escuro underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-laranja-escuro";

function Hora({ iso }: { iso: string }) {
  return <time dateTime={iso} className="text-legenda text-texto-suave">{dataHoraCurta(iso)}</time>;
}

// Uma mensagem da conversa: balão de texto, cartão de anúncio ou de proposta, ou aviso do sistema.
// `meuLado` decide o alinhamento (minhas à direita). O link do pedido só aparece para o cliente.
export function CartaoMensagem({ m, meuLado, autorNome }: { m: MensagemConversa; meuLado: PapelConversa | null; autorNome?: string | null }) {
  if (m.tipo === "sistema" || m.lado === "sistema") {
    return <li className="flex flex-col items-center gap-0.5 py-1 text-center text-sm text-texto-suave">
      <span>{m.texto}</span><Hora iso={m.criado_em} />
    </li>;
  }
  const meu = meuLado !== null && m.lado === meuLado;
  const quem = autorNome ?? (meu ? "Você" : m.lado === "loja" ? "Loja" : "Cliente");
  const alinhamento = meu ? "items-end" : "items-start";

  if (m.tipo === "anuncio" || m.tipo === "proposta") {
    const proposta = m.tipo === "proposta";
    return <li className={`flex flex-col gap-1 ${alinhamento}`}>
      <span className="sr-only">{quem}:</span>
      <div className="flex w-full max-w-md flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <p className="text-sm font-semibold text-texto-suave">{proposta ? "Proposta da loja" : "Anúncio"}</p>
        {proposta && m.pedido_titulo && <p className="text-facil font-semibold text-beringela">Para: {m.pedido_titulo}</p>}
        {m.anuncio_id && <div className="flex items-center gap-3">
          {m.anuncio_foto
            // eslint-disable-next-line @next/next/no-img-element -- foto do Storage com tamanho fixo e pequeno
            ? <img src={m.anuncio_foto} alt="" width={64} height={64} className="size-16 shrink-0 rounded-campo object-cover" />
            : null}
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-facil">{m.anuncio_titulo ?? "Anúncio fora do ar"}</span>
            {m.anuncio_titulo && <span className="text-base font-semibold">{preco(m.anuncio_preco_centavos)}</span>}
          </div>
        </div>}
        {proposta && m.proposta_preco_centavos != null && <p className="text-facil">Preço da proposta: <strong>{preco(m.proposta_preco_centavos)}</strong></p>}
        {proposta && m.texto && <p className="whitespace-pre-line break-words text-facil">{m.texto}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-base">
          {m.anuncio_link && <Link href={m.anuncio_link} className={LINK}>Ver anúncio</Link>}
          {proposta && m.pedido_id && meuLado === "cliente" && <Link href={`/radar/pedido/${m.pedido_id}`} className={LINK}>Ver meu pedido</Link>}
        </div>
      </div>
      <Hora iso={m.criado_em} />
    </li>;
  }

  return <li className={`flex flex-col gap-1 ${alinhamento}`}>
    <div className={`max-w-[85%] rounded-card px-4 py-3 text-facil ${meu ? "bg-selecao" : "border border-borda bg-cartao"}`}>
      <span className="sr-only">{quem}: </span>
      {autorNome && <span className="mb-1 block text-sm font-semibold text-texto-suave">{autorNome}</span>}
      <p className="whitespace-pre-line break-words">{m.texto}</p>
    </div>
    {m.alerta_golpe && <p className="flex max-w-[85%] items-center gap-2 text-sm font-semibold text-aviso">
      <AlertTriangle className="size-4 shrink-0" aria-hidden /> {ALERTA_GOLPE}
    </p>}
    <Hora iso={m.criado_em} />
  </li>;
}
