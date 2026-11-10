"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImagePlus, MessageCircle, Pencil, Send, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { criarUrlFotoProposta, enviarProposta } from "@/app/radar/actions";
import { enviarFoto, reduzirFoto } from "@/lib/fotos";
import { textoPrecoProposta as textoPreco } from "./util";
import { validarProposta } from "./validacao";
import { preco } from "@/lib/formato";
import type { AnuncioParaProposta, MinhaPropostaNoPedido } from "@/lib/tipos-radar";
import { Alert } from "@/components/ui/alert";

type Props = {
  pedidoId: string;
  modoPrazo: boolean;
  podeEditar: boolean;
  /** Modo "Podem me chamar" com proposta minha ativa: botão para abrir o WhatsApp do comprador de novo. */
  podeChamar: boolean;
  abrirLogo: boolean;
  anuncios: AnuncioParaProposta[];
  mensagemMax: number;
  minha: MinhaPropostaNoPedido | null;
  /** Propostas disponíveis (null = sem limite ou já propus). */
  restantes: number | null;
};

// Folha "Propor": escolher um anúncio no ar ou mandar uma foto, preço e mensagem curta.
export function FolhaPropor({ pedidoId, modoPrazo, podeEditar, podeChamar, abrirLogo, anuncios, mensagemMax, minha, restantes }: Props) {
  const router = useRouter();
  const [aberta, setAberta] = useState(abrirLogo && podeEditar);
  const [anuncioId, setAnuncioId] = useState<string | null>(minha?.anuncio_id ?? null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(minha?.foto_url ?? null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [valor, setValor] = useState(textoPreco(minha?.preco_centavos ?? null));
  const [mensagem, setMensagem] = useState(minha?.mensagem ?? "");
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const [chamando, iniciarChamar] = useTransition();
  const [erroChamar, setErroChamar] = useState<string | null>(null);
  const trava = useRef(false);
  const fotoEmCurso = useRef(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [linkContato, setLinkContato] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberta) {
      dialogo.current?.showModal();
      fechar.current?.focus();
    } else dialogo.current?.close();
  }, [aberta]);

  useEffect(() => {
    if (!erro) return;
    const campo = erro.campo === "preco_centavos" ? "preco" : erro.campo;
    const alvo = campo ? formulario.current?.elements.namedItem(campo) : null;
    if (alvo instanceof HTMLElement) alvo.focus();
    else formulario.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [erro]);

  const ocupado = enviando || enviandoFoto || chamando;

  function escolherAnuncio(a: AnuncioParaProposta) {
    if (trava.current || fotoEmCurso.current) return;
    setErro(null);
    const novo = anuncioId === a.id ? null : a.id;
    setAnuncioId(novo);
    if (novo) {
      setFotoUrl(null);
      if (!valor && a.preco_centavos != null) setValor(textoPreco(a.preco_centavos));
    }
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || trava.current || fotoEmCurso.current) return;
    fotoEmCurso.current = true;
    setErro(null);
    setEnviandoFoto(true);
    try {
      const reduzida = await reduzirFoto(f);
      const envio = await criarUrlFotoProposta(pedidoId, reduzida.formato);
      if (!envio.ok) throw new Error(envio.erro);
      if (!(await enviarFoto(reduzida.blob, envio.urlEnvio))) throw new Error("Não deu para enviar a foto. Tente de novo.");
      setFotoUrl(envio.urlPublica);
      setAnuncioId(null);
    } catch (falha) {
      setErro({ texto: falha instanceof Error && falha.message ? falha.message : "Não deu para usar esta foto. Tente outra.", campo: "foto" });
    } finally {
      fotoEmCurso.current = false;
      setEnviandoFoto(false);
    }
  }

  async function enviar() {
    if (trava.current || fotoEmCurso.current) return;
    if (erro?.campo === "foto") return;
    const invalida = validarProposta({ pedidoId, anuncioId, fotoUrl, preco: valor, mensagem });
    if (invalida) return setErro({ texto: invalida.erro, campo: invalida.campo });
    setErro(null);
    if (modoPrazo && !valor.trim()) return setErro({ texto: "Diga o preço da sua oferta.", campo: "preco" });
    if (modoPrazo && !anuncioId && !fotoUrl) return setErro({ texto: "Escolha um anúncio ou mande uma foto.", campo: "foto" });
    trava.current = true;
    // No modo WhatsApp a conversa abre numa aba nova: abrimos já no toque (o iPhone bloqueia depois).
    const aba = modoPrazo || minha ? null : window.open("", "_blank");
    if (aba) aba.opener = null;
    iniciar(async () => {
      try {
        const r = await enviarProposta({ pedidoId, anuncioId, fotoUrl, preco: valor, mensagem });
        if (!r.ok) {
          aba?.close();
          setErro({ texto: r.erro, campo: r.campo });
          return;
        }
        if (r.modo === "whatsapp_direto") {
          setLinkContato(r.linkWhatsapp);
          if (aba) aba.location.href = r.linkWhatsapp;
          setSucesso(r.editada ? "Proposta atualizada." : "Pronto! Continue a conversa no WhatsApp.");
        } else {
          setSucesso(r.editada ? "Proposta atualizada." : r.mensagem);
        }
        setAberta(false);
        router.refresh();
      } catch {
        aba?.close();
        setErro({ texto: "Não conseguimos confirmar o envio. Tente novamente." });
      } finally { trava.current = false; }
    });
  }

  // Abre de novo a conversa com o comprador (o banco confere tudo de novo e não muda a proposta).
  function chamarDeNovo() {
    if (trava.current || fotoEmCurso.current) return;
    trava.current = true;
    setErroChamar(null);
    const aba = window.open("", "_blank");
    if (aba) aba.opener = null;
    iniciarChamar(async () => {
      try {
        const r = await enviarProposta({ pedidoId });
        if (!r.ok || r.modo !== "whatsapp_direto") {
          aba?.close();
          setErroChamar(r.ok ? "Não deu para abrir o WhatsApp. Tente de novo." : r.erro);
          return;
        }
        setLinkContato(r.linkWhatsapp);
        if (aba) aba.location.href = r.linkWhatsapp;
      } catch {
        aba?.close();
        setErroChamar("Não foi possível abrir o contato. Tente novamente.");
      } finally { trava.current = false; }
    });
  }

  const erroCampo = (c: string) => (erro?.campo === c ? erro.texto : null);
  const erroGeral = erro && !["foto", "preco", "preco_centavos", "mensagem"].includes(erro.campo ?? "") ? erro.texto : null;

  return (
    <>
      {sucesso && (
        <Alert variant="success" role="status" className="flex items-center gap-2">
          <Check className="size-5 shrink-0" aria-hidden />
          {sucesso}
        </Alert>
      )}
      {podeChamar && linkContato && <Botao href={linkContato} target="_blank" rel="noopener noreferrer" variante="whatsapp" larguraTotal>Continuar no WhatsApp</Botao>}
      {podeChamar && (
        <div className="flex flex-col gap-2">
          <Botao
            larguraTotal
            variante="whatsapp"
            icone={<MessageCircle />}
            onClick={chamarDeNovo}
            disabled={ocupado} carregando={chamando}
            textoCarregando="Abrindo o WhatsApp..."
          >
            Chamar no WhatsApp de novo
          </Botao>
          {erroChamar && (
            <p role="alert" tabIndex={-1} className="text-center text-sm font-semibold text-perigo">
              {erroChamar}
            </p>
          )}
        </div>
      )}
      {podeEditar && (
        <div className="flex flex-col gap-2">
          <Botao larguraTotal variante={minha ? "secundario" : "primario"} disabled={ocupado} onClick={() => { setErro(null); setAberta(true); }} icone={minha ? <Pencil /> : <Send />}>
            {minha ? "Mudar minha proposta" : "Propor Produto"}
          </Botao>
          {!minha && restantes != null && (
            <p className="text-center text-sm text-texto-suave">
              Você tem {restantes} {restantes === 1 ? "proposta disponível" : "propostas disponíveis"}.
            </p>
          )}
        </div>
      )}

      <dialog ref={dialogo} aria-labelledby="titulo-propor"
        onCancel={(e) => { if (trava.current || fotoEmCurso.current) e.preventDefault(); }}
        onClose={() => setAberta(false)}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-card bg-cartao p-4 text-texto shadow-2 backdrop:bg-beringela/50">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="titulo-propor" className="text-lg font-bold">
                {minha ? "Mudar minha proposta" : "Sua proposta"}
              </h2>
              <button
                ref={fechar}
                type="button"
                disabled={ocupado} onClick={() => setAberta(false)}
                className="grid size-10 place-items-center rounded-full hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                aria-label="Fechar"
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>

            <form ref={formulario} action={enviar} noValidate>
              <fieldset disabled={ocupado} className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-2 max-w-full text-base font-semibold">
                  O que você oferece? {!modoPrazo && <span className="font-normal text-texto-suave">(opcional)</span>}
                </legend>
                {anuncios.length > 0 && (
                  <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                    {anuncios.map((a) => {
                      const ativo = anuncioId === a.id;
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => escolherAnuncio(a)}
                            aria-pressed={ativo}
                            className={`flex min-h-10 w-full items-center gap-3 rounded-campo border p-2 text-left focus-visible:outline-3 focus-visible:outline-laranja-escuro ${
                              ativo ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao hover:bg-fundo"
                            }`}
                          >
                            {a.capa ? (
                              // eslint-disable-next-line @next/next/no-img-element -- capa do anúncio no Storage
                              <img src={a.capa} alt="" width={48} height={48} className="size-12 shrink-0 rounded-campo bg-borda object-cover" />
                            ) : (
                              <span className="grid size-10 shrink-0 place-items-center rounded-campo bg-fundo" aria-hidden>
                                <Camera className="size-5 text-texto-suave" />
                              </span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-base font-semibold">{a.titulo}</span>
                              {a.preco_centavos != null && <span className="text-legenda text-texto-suave">{preco(a.preco_centavos)}</span>}
                            </span>
                            {ativo && <Check className="size-5 shrink-0 text-laranja-escuro" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {fotoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- foto enviada agora
                    <img src={fotoUrl} alt="Foto da oferta" width={64} height={64} className="size-16 shrink-0 rounded-campo bg-borda object-cover" />
                  )}
                  <Botao
                    variante="secundario"
                    className="min-w-0 flex-1 whitespace-normal"
                    icone={<ImagePlus />}
                    onClick={() => arquivo.current?.click()}
                    disabled={ocupado}
                    carregando={enviandoFoto}
                    textoCarregando="Enviando foto..."
                  >
                    {fotoUrl ? "Trocar a foto" : anuncios.length > 0 ? "Ou mande uma foto" : "Mandar uma foto"}
                  </Botao>
                  <input ref={arquivo} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={aoEscolherFoto} />
                </div>
                {erroCampo("foto") && (
                  <p role="alert" tabIndex={-1} className="text-sm font-semibold text-perigo">
                    {erroCampo("foto")}
                  </p>
                )}
              </fieldset>

              <Campo
                rotulo="Preço da oferta"
                name="preco"
                prefixo="R$"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                opcional={!modoPrazo}
                erro={erroCampo("preco") ?? erroCampo("preco_centavos")}
              />

              <Campo
                rotulo="Mensagem para o comprador"
                name="mensagem"
                multilinha
                opcional
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value.slice(0, mensagemMax))}
                maxLength={mensagemMax}
                placeholder="Ex.: Tenho pronta entrega e faço entrega na cidade."
                dica={`${mensagem.length}/${mensagemMax}`}
                erro={erroCampo("mensagem")}
              />

              {erroGeral && (
                <Alert variant="destructive" role="alert" tabIndex={-1}>
                  {erroGeral}
                </Alert>
              )}

              <Botao
                type="submit"
                larguraTotal
                variante={modoPrazo ? "primario" : "whatsapp"}
                carregando={enviando}
                disabled={ocupado}
                textoCarregando="Enviando..."
                icone={<Send />}
              >
                {minha ? "Salvar mudanças" : modoPrazo ? "Mandar proposta" : "Propor e chamar no WhatsApp"}
              </Botao>
              </fieldset>
            </form>
      </dialog>
    </>
  );
}
