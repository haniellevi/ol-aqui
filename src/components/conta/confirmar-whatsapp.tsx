"use client";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { CheckCircle2, Smartphone } from "lucide-react";
import { Campo } from "@/components/ui/campo";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "./aviso";
import { mascaraCelular, whatsappDigitado } from "@/lib/formato";
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
  const [fone, setFone] = useState(() => mascaraCelular(numero)), [codigo, setCodigo] = useState(""), [desafio, setDesafio] = useState("");
  const [foneVisitado, setFoneVisitado] = useState(false);
  const [token, setToken] = useState(""), [captcha, setCaptcha] = useState(0), [restante, setRestante] = useState(0);
  const [estado, setEstado] = useState<EstadoCodigo>({}), [pendente, iniciar] = useTransition();
  const receberToken = useCallback((t: string) => setToken(t), []);
  const foneValido = /^\([1-9][0-9]\) 9[0-9]{4}-[0-9]{4}$/.test(fone) && !!whatsappDigitado(fone);
  const erroFone = foneVisitado && !foneValido ? "Digite o DDD e os 9 dígitos do celular. Ex.: (89) 99999-0000." : undefined;
  useEffect(() => { if (!restante) return; const t = setTimeout(() => setRestante(r => Math.max(0, r - 1)), 1000); return () => clearTimeout(t); }, [restante]);
  useEffect(() => { if (desafio && !pendente) campoCodigo.current?.focus(); }, [desafio, pendente]);
  function mudarFone(e: ChangeEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    let texto = campo.value, cursor = campo.selectionStart ?? texto.length;
    const tipo = (e.nativeEvent as InputEvent).inputType;
    // Ao apagar um separador, apaga o dígito vizinho para a máscara não prender o cursor.
    if (texto !== fone && mascaraCelular(texto) === fone && tipo?.startsWith("deleteContent")) {
      const passo = tipo === "deleteContentBackward" ? -1 : 1;
      let indice = passo < 0 ? cursor - 1 : cursor;
      while (indice >= 0 && indice < texto.length && /\D/.test(texto[indice])) indice += passo;
      if (indice >= 0 && indice < texto.length) {
        texto = texto.slice(0, indice) + texto.slice(indice + 1);
        if (indice < cursor) cursor--;
      }
    }
    const formatado = mascaraCelular(texto);
    const removidos = texto.replace(/\D/g, "").length - formatado.replace(/\D/g, "").length;
    let faltam = Math.max(0, texto.slice(0, cursor).replace(/\D/g, "").length - removidos), posicao = 0;
    while (posicao < formatado.length && faltam > 0) if (/\d/.test(formatado[posicao++])) faltam--;
    setFone(formatado);
    requestAnimationFrame(() => { if (document.activeElement === campo) campo.setSelectionRange(posicao, posicao); });
  }
  function enviar() {
    if (!foneValido) { setFoneVisitado(true); return; }
    if (trava.current || !token || restante) return;
    trava.current = true; setEstado({});
    iniciar(async () => {
      try {
        const r = await solicitarCodigo(fone, token); setEstado(r);
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
  if (estado.confirmado) return <section className="flex flex-col gap-5 rounded-card bg-cartao p-5 shadow-1" aria-live="polite">
    <CheckCircle2 className="size-10 text-verde-escuro" aria-hidden />
    <h2 className="text-xl font-bold">WhatsApp confirmado</h2><p>Seu contato foi confirmado. Você já pode continuar no OL-AKI.</p>
    <Botao href={destino} larguraTotal>Continuar</Botao>
  </section>;
  return <section className="flex flex-col gap-5 rounded-card bg-cartao p-5 shadow-1">
    <div className="flex items-center gap-2 font-bold text-laranja-escuro"><Smartphone aria-hidden className="size-5" />Confirmação pelo WhatsApp</div>
    <form onSubmit={e => { e.preventDefault(); enviar(); }} className="flex flex-col gap-4">
      <Campo rotulo="Seu WhatsApp com DDD" name="whatsapp" type="tel" autoComplete="tel-national" inputMode="numeric" required maxLength={30}
        placeholder="(89) 99999-0000" prefixo="+55" pattern="\([1-9][0-9]\) 9[0-9]{4}-[0-9]{4}" value={fone} disabled={pendente || !!desafio}
        onChange={mudarFone} onBlur={() => setFoneVisitado(true)} erro={erroFone}
        dica="Digite o DDD e o celular com 9 dígitos. O código do Brasil (+55) já está incluído." />
      <p className="text-sm text-texto-suave">Ao solicitar, você receberá uma mensagem com um código de seis números. Ele vale por cinco minutos e pode ser usado uma vez.</p>
      <DesafioSeguranca key={captcha} siteKey={siteKey} onToken={receberToken} />
      <Botao type="submit" larguraTotal variante={desafio ? "secundario" : "primario"} disabled={!foneValido || !token || restante > 0 || pendente}>
        {restante ? `Novo envio em ${restante}s` : pendente ? "Aguarde..." : desafio ? "Solicitar novo código" : "Enviar código no WhatsApp"}
      </Botao>
    </form>
    {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    {estado.aviso && <p role="status" className="rounded-campo bg-fundo p-3 text-sm">{estado.aviso}</p>}
    {desafio && <form onSubmit={e => { e.preventDefault(); confirmar(); }} className="flex flex-col gap-3 border-t border-borda pt-5">
      <Campo ref={campoCodigo} rotulo="Código recebido" name="codigo" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={codigo} disabled={pendente || estado.encerrado}
        onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} dica="Após três erros, será necessário pedir outro código. Um novo envio substitui o código anterior." />
      <Botao type="submit" larguraTotal carregando={pendente} textoCarregando="Conferindo..." disabled={codigo.length !== 6 || estado.encerrado}>Confirmar WhatsApp</Botao>
      <Botao type="button" variante="texto" disabled={pendente} onClick={() => { setDesafio(""); setCodigo(""); setEstado({}); }}>Corrigir número</Botao>
    </form>}
    <p className="text-sm leading-5 text-texto-suave">Solicite o código apenas para um número seu. Nunca compartilhe o código, nem com alguém que diga fazer parte do OL-AKI.</p>
  </section>;
}
