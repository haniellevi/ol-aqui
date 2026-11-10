"use client";

import { useState } from "react";
import { BadgeCheck, CircleCheck, ClipboardCheck, ImageOff, Loader2, Phone, Radar, Sparkles, Store, ThumbsDown, ThumbsUp } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { abrirAtendimentoCadastro, avaliarResposta, confirmarPedidoRadar } from "@/lib/aki/acoes";
import { preco } from "@/lib/formato";
import type { AcaoAki, MensagemAki } from "@/lib/aki/tipos";
import { MascoteAki } from "./mascote";

type Resposta = Extract<MensagemAki, { papel: "assistente" }>;

const ICONES = {
  revisar: <ClipboardCheck />,
  planos: <BadgeCheck />,
  destacar: <Sparkles />,
  radar: <Radar />,
  vender: <Store />,
  celular: <Phone />,
} as const;

function BotaoRadar({
  acao,
  mensagemId,
  indice,
}: {
  acao: Extract<AcaoAki, { tipo: "pedido_radar" }>;
  mensagemId: number | null;
  indice: number;
}) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string; link?: { rotulo: string; href: string } } | null>(
    acao.usada ? { ok: true, texto: "Pedido enviado ao Radar." } : null,
  );
  if (resultado?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-card bg-sucesso-fundo px-3 py-2 text-sm text-verde-escuro">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {resultado.texto}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="rounded-card border border-borda px-3 py-2 text-sm">
        <p className="font-semibold">{acao.dados.titulo}</p>
        {acao.dados.detalhes && <p className="text-texto-suave">{acao.dados.detalhes}</p>}
        <p className="text-legenda text-texto-suave">{acao.dados.cidade}</p>
      </div>
      <Botao
        variante="secundario"
        larguraTotal
        icone={<Radar />}
        carregando={enviando || !mensagemId}
        textoCarregando={mensagemId ? "Enviando o pedido…" : "Aguarde…"}
        onClick={async () => {
          if (!mensagemId || enviando) return;
          setEnviando(true);
          const r = await confirmarPedidoRadar(mensagemId, indice).catch(() => null);
          setEnviando(false);
          if (!r) setResultado({ ok: false, texto: "Sem conexão agora. Tente de novo." });
          else if (r.ok) setResultado({ ok: true, texto: r.mensagem });
          else setResultado({ ok: false, texto: r.erro, link: r.link });
        }}
      >
        {acao.rotulo}
      </Botao>
      {resultado && !resultado.ok && (
        <div role="alert" className="space-y-2 rounded-card bg-perigo-fundo px-3 py-2 text-sm text-perigo">
          <p>{resultado.texto}</p>
          {resultado.link && (
            <Botao href={resultado.link.href} variante="secundario" larguraTotal>
              {resultado.link.rotulo}
            </Botao>
          )}
        </div>
      )}
    </div>
  );
}

/** Card pronto do rascunho que o Aki guardou: a pessoa confere e toca em "Revisar e publicar". */
function CardRascunho({ acao }: { acao: Extract<AcaoAki, { tipo: "rascunho" }> }) {
  return (
    <div className="overflow-hidden rounded-card border border-borda bg-cartao">
      <div className="flex gap-3 p-2.5">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-campo bg-borda">
          {acao.capa ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto do rascunho no Storage (img simples, leve no 3G)
            <img src={acao.capa} alt={acao.titulo ? `Foto de ${acao.titulo}` : "Foto do anúncio"} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-texto-suave" aria-label="Sem foto">
              <ImageOff className="size-6" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-legenda font-semibold text-texto-suave">Rascunho guardado · ainda não publicado</p>
          <p className="text-lg font-bold leading-6">{preco(acao.preco_centavos)}</p>
          <p className="line-clamp-2 text-base leading-5">{acao.titulo ?? "Sem título ainda"}</p>
          <p className="text-legenda text-texto-suave">{acao.fotos === 1 ? "1 foto" : `${acao.fotos} fotos`}</p>
        </div>
      </div>
      <div className="border-t border-borda p-2.5">
        <Botao href={acao.href} variante="secundario" larguraTotal icone={<ClipboardCheck />}>
          Revisar e publicar
        </Botao>
      </div>
    </div>
  );
}

function Avaliacao({ mensagem, aoAvaliar, atendimentoHref }: {
  mensagem: Resposta; aoAvaliar: (nota: -1 | 1 | null) => void; atendimentoHref?: string;
}) {
  const [salvando, setSalvando] = useState(false);
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [agradecido, setAgradecido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = mensagem.id;
  if (!id) return null;

  async function marcar(nota: -1 | 1) {
    const nova = mensagem.nota === nota ? 0 : nota;
    setSalvando(true);
    const r = await avaliarResposta(id!, nova).catch(() => null);
    setSalvando(false);
    if (r?.ok) {
      aoAvaliar(nova === 0 ? null : nova);
      setComentando(nova === -1);
    }
  }

  async function pedirEquipe() {
    if (!id || !atendimentoHref || salvando) return;
    setErro(null);
    setSalvando(true);
    const resultado = await abrirAtendimentoCadastro(id).catch(() => null);
    if (resultado?.ok) {
      window.location.assign(atendimentoHref);
      return;
    }
    setSalvando(false);
    setErro(resultado?.erro ?? "Não foi possível abrir o atendimento. Tente novamente.");
  }

  const estiloIcone = (ativo: boolean) =>
    `grid size-10 place-items-center rounded-campo border ${ativo ? "border-laranja-escuro bg-selecao" : "border-transparent"} text-beringela disabled:opacity-50`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-legenda text-texto-suave">Ajudou?</span>
        <button type="button" aria-label="Ajudou" aria-pressed={mensagem.nota === 1} disabled={salvando} onClick={() => void marcar(1)} className={estiloIcone(mensagem.nota === 1)}>
          <ThumbsUp className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label="Não ajudou" aria-pressed={atendimentoHref ? undefined : mensagem.nota === -1} disabled={salvando}
          onClick={() => void (atendimentoHref ? pedirEquipe() : marcar(-1))} className={estiloIcone(mensagem.nota === -1)}>
          <ThumbsDown className="size-5" aria-hidden />
        </button>
        {salvando && <Loader2 className="size-4 animate-spin text-texto-suave motion-reduce:animate-none" aria-hidden />}
      </div>
      {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
      {comentando && !agradecido && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!comentario.trim()) return;
            setSalvando(true);
            const r = await avaliarResposta(id, -1, comentario.trim()).catch(() => null);
            setSalvando(false);
            if (r?.ok) setAgradecido(true);
          }}
        >
          <label htmlFor={`coment-${id}`} className="sr-only">
            O que faltou?
          </label>
          <input
            id={`coment-${id}`}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            placeholder="O que faltou? (opcional)"
            className="h-10 min-w-0 flex-1 rounded-campo border-2 border-borda px-3 text-base focus:outline-none focus-visible:border-laranja-escuro"
          />
          <Botao type="submit" variante="secundario" carregando={salvando} textoCarregando="…">
            Mandar
          </Botao>
        </form>
      )}
      {agradecido && <p className="text-legenda text-verde-escuro">Obrigado! Isso ajuda o Aki a melhorar.</p>}
    </div>
  );
}

export function RespostaAki({
  mensagem,
  escrevendo,
  pensando,
  aoAvaliar,
  atendimentoHref,
}: {
  mensagem: Resposta;
  escrevendo: boolean;
  pensando: string | null;
  aoAvaliar: (nota: -1 | 1 | null) => void;
  atendimentoHref?: string;
}) {
  const c = mensagem.conteudo;
  return (
    <div className="flex items-start gap-2">
      <MascoteAki tamanho={28} className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        {(c.texto || pensando) && (
          <div className="rounded-card rounded-tl-none bg-fundo px-3 py-2">
            {c.texto && <p className="whitespace-pre-wrap break-words text-base leading-6">{c.texto}</p>}
            {pensando && (
              <p className="flex items-center gap-2 text-sm text-texto-suave">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {pensando}
              </p>
            )}
          </div>
        )}
        {!!c.cartoes?.length && (
          <div className="grid grid-cols-2 gap-2">
            {c.cartoes.map((a) => (
              <CardAnuncio key={a.id} anuncio={a} />
            ))}
          </div>
        )}
        {!!c.acoes?.length && (
          <div className="flex flex-col gap-2">
            {c.acoes.map((a, i) =>
              a.tipo === "link" ? (
                <Botao key={`${a.href}${i}`} href={a.href} variante="secundario" larguraTotal icone={a.icone ? ICONES[a.icone] : undefined}>
                  {a.rotulo}
                </Botao>
              ) : a.tipo === "rascunho" ? (
                <CardRascunho key={`rascunho${a.id}`} acao={a} />
              ) : (
                <BotaoRadar key={`radar${i}`} acao={a} mensagemId={mensagem.id} indice={i} />
              ),
            )}
          </div>
        )}
        {!escrevendo && <Avaliacao mensagem={mensagem} aoAvaliar={aoAvaliar} atendimentoHref={atendimentoHref} />}
      </div>
    </div>
  );
}
