"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, Send } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/ui/confirmar";
import { CartaoMensagem } from "@/components/conversas/cartao-mensagem";
import { EVENTO_CONVERSAS } from "@/components/conversas/icone-conversas";
import { MENSAGEM_MAX, validarMensagem } from "@/components/conversas/validacao";
import { enviarMensagem, marcarLida, mensagensDepois, mostrarMeuWhatsapp } from "@/app/(conta)/conversas/actions";
import type { MensagemConversa, PapelConversa } from "@/lib/tipos-conversas";

const INTERVALO_MS = 10_000;

function juntar(atuais: MensagemConversa[], novas: MensagemConversa[]): MensagemConversa[] {
  if (novas.length === 0) return atuais;
  const vistos = new Set(atuais.map((m) => m.id));
  return [...atuais, ...novas.filter((m) => !vistos.has(m.id))];
}

// Conversa aberta: mensagens, envio e (cliente) "Mostrar meu WhatsApp" / (loja) "Chamar no WhatsApp".
// Atualiza sozinha a cada 10 s com a aba visível e marca como lida ao abrir e ao chegar mensagem.
export function ConversaAberta({ conversaId, papel, mensagensIniciais, bloqueada, whatsappLiberado, whatsappHref, nomeOutro }: {
  conversaId: string;
  papel: PapelConversa;
  mensagensIniciais: MensagemConversa[];
  bloqueada: boolean;
  whatsappLiberado: boolean;
  /** Link wa.me montado no servidor (só para a loja, depois que o cliente mostrou o número). */
  whatsappHref: string | null;
  nomeOutro: string;
}) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [mostrando, iniciarMostrar] = useTransition();
  const fim = useRef<HTMLDivElement>(null);
  const ultimaRef = useRef<string | null>(mensagensIniciais.at(-1)?.criado_em ?? null);

  useEffect(() => { ultimaRef.current = mensagens.at(-1)?.criado_em ?? null; }, [mensagens]);

  const marcar = useCallback(() => {
    void marcarLida(conversaId).then((r) => { if (r.ok) window.dispatchEvent(new Event(EVENTO_CONVERSAS)); }).catch(() => undefined);
  }, [conversaId]);

  const buscarNovas = useCallback(async () => {
    const r = await mensagensDepois(conversaId, ultimaRef.current);
    if (!r.ok || r.dados.length === 0) return;
    setMensagens((atuais) => juntar(atuais, r.dados));
    if (r.dados.some((m) => m.lado !== papel)) marcar();
  }, [conversaId, papel, marcar]);

  useEffect(() => { marcar(); }, [marcar]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens.length]);
  useEffect(() => {
    let emCurso = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || emCurso) return;
      emCurso = true;
      try { await buscarNovas(); } catch { /* tenta de novo no próximo intervalo */ } finally { emCurso = false; }
    };
    const id = window.setInterval(tick, INTERVALO_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [buscarNovas]);

  function enviar() {
    const invalida = validarMensagem(texto);
    if (invalida) { setErro(invalida.mensagem); return; }
    setErro(null);
    iniciarEnvio(async () => {
      try {
        const r = await enviarMensagem(conversaId, texto);
        if (!r.ok) { setErro(r.erro.mensagem); return; }
        setTexto("");
        await buscarNovas();
      } catch { setErro("Não foi possível enviar. Tente novamente."); }
    });
  }

  async function mostrarWhatsapp() {
    const ok = await confirmar({ titulo: `Mostrar seu WhatsApp para ${nomeOutro}?`, texto: "A loja vai ver seu número. Não dá para esconder depois.", acao: "Mostrar meu WhatsApp" });
    if (!ok) return;
    iniciarMostrar(async () => {
      try {
        const r = await mostrarMeuWhatsapp(conversaId);
        if (!r.ok) { setErro(r.erro.mensagem); return; }
        await buscarNovas();
        router.refresh();
      } catch { setErro("Não foi possível mostrar seu WhatsApp. Tente novamente."); }
    });
  }

  return <div className="flex flex-col gap-4">
    <ol className="flex flex-col gap-3" aria-label="Mensagens" aria-live="polite">
      {mensagens.map((m) => <CartaoMensagem key={m.id} m={m} meuLado={papel} />)}
    </ol>
    <div ref={fim} />

    {bloqueada ? <p className="rounded-card bg-fundo p-4 text-facil text-texto-suave">Conversa bloqueada.</p> : <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="mensagem-conversa" className="text-facil font-semibold">Sua mensagem</label>
        <Textarea id="mensagem-conversa" value={texto} maxLength={MENSAGEM_MAX} rows={3} className="text-facil"
          aria-invalid={erro ? true : undefined} aria-describedby={erro ? "erro-conversa" : undefined}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } }} />
        {erro && <p id="erro-conversa" role="alert" className="text-sm font-semibold text-perigo">{erro}</p>}
      </div>
      <Botao type="button" tamanho="grande" larguraTotal onClick={enviar} carregando={enviando} textoCarregando="Enviando..." icone={<Send />}>Enviar</Botao>
      {papel === "cliente" && !whatsappLiberado && <Botao type="button" variante="secundario" tamanho="grande" larguraTotal onClick={() => void mostrarWhatsapp()} carregando={mostrando} textoCarregando="Mostrando..." icone={<Phone />}>Mostrar meu WhatsApp</Botao>}
      {papel === "cliente" && whatsappLiberado && <p className="text-base text-texto-suave">Você mostrou seu WhatsApp para esta loja.</p>}
      {papel === "loja" && whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Chamar o cliente no WhatsApp (abre em nova aba)"
        className={classesBotao("whatsapp", true, "", "grande")}>
        <MessageCircle className="size-5" aria-hidden /> Chamar no WhatsApp
      </a>}
      {papel === "loja" && !whatsappHref && <p className="text-base text-texto-suave">O WhatsApp do cliente aparece aqui se ele decidir mostrar.</p>}
    </div>}
  </div>;
}
