"use client";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Campo } from "@/components/ui/campo";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "./aviso";
import { useCampoTelefone } from "@/components/ui/use-campo-telefone";
import { solicitarCodigo, confirmarCodigo, type EstadoCodigo } from "@/app/confirmar-celular/actions";

type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
function DesafioSeguranca({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const elemento = useRef<HTMLDivElement>(null);
  const [pronto, setPronto] = useState(false), [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!pronto || !elemento.current || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(elemento.current, { sitekey: siteKey, action: "confirmar-whatsapp", size: "compact", language: "pt-br", callback: onToken,
      "expired-callback": () => onToken(""), "error-callback": () => { onToken(""); setFalhou(true); } });
    return () => { api.remove(id); };
  }, [pronto, siteKey, onToken]);
  return <div className="flex flex-col items-center gap-2">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setPronto(true)} onError={() => setFalhou(true)} />
    <div ref={elemento} aria-label="Verificação de segurança" />
    {falhou && <p role="alert" className="text-sm text-perigo">Não foi possível carregar a verificação de segurança. Atualize a página para tentar novamente.</p>}
  </div>;
}

export function ConfirmarWhatsapp({ siteKey, destino, numero = "" }: { siteKey: string; destino: string; numero?: string }) {
  const trava = useRef(false), campoCodigo = useRef<HTMLInputElement>(null);
  const fone = useCampoTelefone(numero, { obrigatorio: true });
  const [codigo, setCodigo] = useState(""), [desafio, setDesafio] = useState("");
  const [token, setToken] = useState(""), [captcha, setCaptcha] = useState(0), [restante, setRestante] = useState(0);
  const [estado, setEstado] = useState<EstadoCodigo>({}), [pendente, iniciar] = useTransition();
  const receberToken = useCallback((t: string) => setToken(t), []);
  useEffect(() => { if (!restante) return; const t = setTimeout(() => setRestante(r => Math.max(0, r - 1)), 1000); return () => clearTimeout(t); }, [restante]);
  useEffect(() => { if (desafio && !pendente) campoCodigo.current?.focus(); }, [desafio, pendente]);
  function enviar() {
    if (!fone.valido) { fone.marcarVisitado(); return; }
    if (trava.current || !token || restante) return;
    trava.current = true; setEstado({});
    iniciar(async () => {
      try {
        const r = await solicitarCodigo(fone.campo.value, token); setEstado(r);
        if (r.desafio) { setDesafio(r.desafio); setCodigo(""); }
        if (r.aguardar) setRestante(r.aguardar);
      } catch { setEstado({ erro: "A conexão falhou. Aguarde um minuto antes de solicitar novamente." }); setRestante(60); }
      finally { setToken(""); setCaptcha(c => c + 1); trava.current = false; }
    });
  }
  function confirmar() {
    if (trava.current) return;
    trava.current = true; setEstado({});
    iniciar(async () => {
      try { setEstado(await confirmarCodigo(desafio, codigo)); }
      catch { setEstado({ erro: "A conexão falhou. Confira o código e tente novamente." }); }
      finally { trava.current = false; }
    });
  }
  if (estado.confirmado) return <section className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1" aria-live="polite">
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <CheckCircle2 className="size-5 shrink-0 text-verde-escuro" aria-hidden /> WhatsApp confirmado
    </h2>
    <Botao href={destino} tamanho="toque" larguraTotal>Continuar</Botao>
  </section>;
  return <section className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
    {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    {estado.aviso && <p role="status" className="rounded-campo bg-fundo p-2 text-sm">{estado.aviso}</p>}
    {desafio && <form onSubmit={e => { e.preventDefault(); confirmar(); }} className="flex flex-col gap-3">
      <Campo ref={campoCodigo} rotulo="Código recebido" tamanho="toque" name="codigo" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={codigo} disabled={pendente || estado.encerrado}
        onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} dica="O código mais recente vale por 5 minutos. Após três erros, peça outro." />
      <Botao type="submit" tamanho="toque" larguraTotal carregando={pendente} textoCarregando="Conferindo..." disabled={codigo.length !== 6 || estado.encerrado}>Confirmar WhatsApp</Botao>
    </form>}
    <form onSubmit={e => { e.preventDefault(); enviar(); }} className={`flex flex-col gap-3${desafio ? " border-t border-borda pt-3" : ""}`}>
      <Campo rotulo="Seu WhatsApp com DDD" tamanho="toque" name="whatsapp" {...fone.campo} disabled={pendente || !!desafio} erro={fone.erro}
        dica={desafio ? undefined : "Digite o DDD e o celular com 9 dígitos. O +55 já está incluído."} />
      {!desafio && <p className="text-sm text-texto-suave">Você vai receber um código de seis dígitos, válido por 5 minutos e de uso único.</p>}
      <DesafioSeguranca key={captcha} siteKey={siteKey} onToken={receberToken} />
      <Botao type="submit" tamanho="toque" larguraTotal variante={desafio ? "secundario" : "primario"} disabled={!fone.valido || !token || restante > 0 || pendente}>
        {restante ? `Novo envio em ${restante}s` : pendente ? "Aguarde..." : desafio ? "Solicitar novo código" : "Enviar código no WhatsApp"}
      </Botao>
      {desafio && <Botao type="button" variante="texto" tamanho="toque" disabled={pendente} onClick={() => { setDesafio(""); setCodigo(""); setEstado({}); }}>Corrigir número</Botao>}
    </form>
    <p className="text-sm text-texto-suave">Nunca compartilhe o código, nem com quem se diz do Mercado da Região.</p>
  </section>;
}
