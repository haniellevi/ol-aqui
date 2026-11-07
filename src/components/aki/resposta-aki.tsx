"use client";

import { useState } from "react";
import { BadgeCheck, CircleCheck, ClipboardCheck, Loader2, Phone, Radar, Sparkles, Store, ThumbsDown, ThumbsUp } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { avaliarResposta, confirmarPedidoRadar } from "@/lib/aki/acoes";
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

function BotaoRadar({ acao }: { acao: Extract<AcaoAki, { tipo: "pedido_radar" }> }) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string; link?: { rotulo: string; href: string } } | null>(null);
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
        <p className="text-[13px] text-texto-suave">{acao.dados.cidade}</p>
      </div>
      <Botao
        variante="secundario"
        larguraTotal
        icone={<Radar />}
        carregando={enviando}
        textoCarregando="Enviando o pedido…"
        onClick={async () => {
          setEnviando(true);
          const r = await confirmarPedidoRadar(acao.dados).catch(() => null);
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

function Avaliacao({ mensagem, aoAvaliar }: { mensagem: Resposta; aoAvaliar: (nota: -1 | 1 | null) => void }) {
  const [salvando, setSalvando] = useState(false);
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [agradecido, setAgradecido] = useState(false);
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

  const estiloIcone = (ativo: boolean) =>
    `grid size-12 place-items-center rounded-campo border ${ativo ? "border-laranja-escuro bg-laranja-claro" : "border-transparent"} text-beringela disabled:opacity-50`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[13px] text-texto-suave">Ajudou?</span>
        <button type="button" aria-label="Ajudou" aria-pressed={mensagem.nota === 1} disabled={salvando} onClick={() => void marcar(1)} className={estiloIcone(mensagem.nota === 1)}>
          <ThumbsUp className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label="Não ajudou" aria-pressed={mensagem.nota === -1} disabled={salvando} onClick={() => void marcar(-1)} className={estiloIcone(mensagem.nota === -1)}>
          <ThumbsDown className="size-5" aria-hidden />
        </button>
        {salvando && <Loader2 className="size-4 animate-spin text-texto-suave motion-reduce:animate-none" aria-hidden />}
      </div>
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
            className="h-12 min-w-0 flex-1 rounded-campo border-2 border-borda px-3 text-base focus:outline-none focus-visible:border-laranja-escuro"
          />
          <Botao type="submit" variante="secundario" carregando={salvando} textoCarregando="…">
            Mandar
          </Botao>
        </form>
      )}
      {agradecido && <p className="text-[13px] text-verde-escuro">Obrigado! Isso ajuda o Aki a melhorar.</p>}
    </div>
  );
}

export function RespostaAki({
  mensagem,
  escrevendo,
  pensando,
  aoAvaliar,
}: {
  mensagem: Resposta;
  escrevendo: boolean;
  pensando: string | null;
  aoAvaliar: (nota: -1 | 1 | null) => void;
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
              ) : (
                <BotaoRadar key={`radar${i}`} acao={a} />
              ),
            )}
          </div>
        )}
        {!escrevendo && <Avaliacao mensagem={mensagem} aoAvaliar={aoAvaliar} />}
      </div>
    </div>
  );
}
