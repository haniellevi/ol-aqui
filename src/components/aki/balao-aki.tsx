"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Camera, Info, Loader2, SendHorizontal, Trash2, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { enviarFoto, reduzirFoto } from "@/lib/fotos";
import { apagarFoto, criarUrlEnvioFoto } from "@/lib/dados/fotos";
import { adicionarFotoRascunho, apagarMinhasConversas } from "@/lib/aki/acoes";
import { DESCANSANDO, mensagemBloqueio } from "@/lib/aki/textos";
import type { EstadoAki, EventoAki, MensagemAki, PedidoAki } from "@/lib/aki/tipos";
import { LINK_ATENDIMENTO } from "@/lib/rotas";
import { MascoteAki } from "./mascote";
import {
  EVENTO_ABRIR_AKI,
  EVENTO_DICA_AKI,
  EVENTO_ESTADO_AKI,
  EVENTO_FOTO_AKI,
  lerDicaPendente,
  mostrarDicaAki,
  type DicaAki,
  type FotoGuardadaAki,
  type PedidoAbrirAki,
} from "./abrir";
import { RespostaAki } from "./resposta-aki";
import { classesCampo } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

// Balão flutuante do Merc + folha de conversa (DESIGN-SYSTEM.md: folha rounded-t-folha, shadow-2,
// 48px de toque, texto mínimo 13px, campo 16px, um botão laranja por tela = "Enviar").
// modo="pagina": a mesma conversa ocupando a tela toda (T39, /aki), sem o balão flutuante.
// Mesma API (/api/aki) e mesmas regras: nada muda no que o Merc pode fazer.

type FotoPronta = { base64: string; tipo: "image/webp" | "image/jpeg"; previa: string; blob: Blob; formato: "webp" | "jpg" };

/** Envia a foto ao Storage e põe no rascunho. Devolve null se deu certo, ou a frase do erro. */
async function guardarFotoNoAnuncio(foto: FotoPronta, anuncioId: string): Promise<string | null> {
  const envio = await criarUrlEnvioFoto(anuncioId, foto.formato).catch(() => null);
  if (!envio) return "Sem conexão agora. A foto não foi guardada no anúncio.";
  if (!envio.ok) return envio.erro.mensagem;
  if (!(await enviarFoto(foto.blob, envio.dados.urlEnvio))) return "A foto não foi guardada no anúncio. Coloque pelo passo Fotos.";
  const r = await adicionarFotoRascunho(anuncioId, envio.dados.urlPublica).catch(() => null);
  if (!r?.ok) {
    void apagarFoto(envio.dados.urlPublica).catch(() => undefined);
    return r && !r.ok ? r.erro : "A foto não foi guardada no anúncio. Coloque pelo passo Fotos.";
  }
  window.dispatchEvent(new CustomEvent<FotoGuardadaAki>(EVENTO_FOTO_AKI, { detail: { anuncioId, url: envio.dados.urlPublica } }));
  return null;
}

const API = "/api/aki";

function paraBase64(blob: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => erro(new Error("Não deu para ler a foto."));
    leitor.readAsDataURL(blob);
  });
}

export function BalaoAki({ modo = "balao", voltarDaAjuda, atendimentoHref, atendimentoAberto }: {
  modo?: "balao" | "pagina"; voltarDaAjuda?: string; atendimentoHref?: string; atendimentoAberto?: boolean;
} = {}) {
  const pagina = modo === "pagina";
  const caminho = usePathname() ?? "/";
  const [estado, setEstado] = useState<EstadoAki | null>(null);
  const [falhouEstado, setFalhouEstado] = useState(false);
  const [aberto, setAberto] = useState(pagina);
  const [carregando, setCarregando] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemAki[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<FotoPronta | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pensando, setPensando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [usarNoAnuncio, setUsarNoAnuncio] = useState(false);
  const [dica, setDica] = useState<DicaAki | null>(null);
  // mudou de tela (card, "Ver planos", "Revisar e publicar"...): a folha fecha para a pessoa ver a tela nova
  const [caminhoAtual, setCaminhoAtual] = useState(caminho);
  if (caminhoAtual !== caminho) {
    setCaminhoAtual(caminho);
    if (!pagina) setAberto(false);
    setConfirmarApagar(false);
  }
  const inputFoto = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const completoCarregado = useRef(false);

  // estado leve ao montar: o Merc existe nesta região? (desligado no painel = sem balão)
  // Na tela cheia a conversa abre direto (estado completo, logo abaixo).
  useEffect(() => {
    if (pagina) return;
    let vivo = true;
    fetch(API, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((e: EstadoAki | null) => {
        if (!vivo || !e) return;
        setEstado(e);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pagina]);

  useEffect(() => {
    const ligado = !!estado?.ligado;
    if (ligado) document.documentElement.dataset.aki = "ligado";
    else delete document.documentElement.dataset.aki;
    window.dispatchEvent(new Event(EVENTO_ESTADO_AKI));
  }, [estado?.ligado]);

  const carregarCompleto = useCallback(async () => {
    if (completoCarregado.current) return;
    setCarregando(true);
    try {
      const r = await fetch(`${API}?completo=1`, { cache: "no-store" });
      const e = (await r.json()) as EstadoAki;
      // falha no servidor (a rota responde motivo "erro") não é "Merc desligado": mostra "Tentar de novo"
      if (!r.ok || e.motivo === "erro") throw new Error("estado do Merc falhou");
      setEstado(e);
      setMensagens(e.mensagens ?? []);
      setConversaId(e.conversaId);
      setFalhouEstado(false);
      completoCarregado.current = true;
    } catch {
      setAviso("Sem conexão agora. Tente de novo.");
      setFalhouEstado(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  // tela cheia: carrega a conversa ao abrir a página
  useEffect(() => {
    if (pagina) void carregarCompleto();
  }, [pagina, carregarCompleto]);

  const podeAgora = !!estado?.pode;
  const abrir = useCallback(
    (pedido?: PedidoAbrirAki) => {
      setAberto(true);
      setDica(null);
      mostrarDicaAki(null);
      if (pedido?.texto) setTexto(pedido.texto);
      if (pedido?.rascunhoId) setRascunhoId(pedido.rascunhoId);
      // cadastro pela foto: a foto vai para o anúncio também (a pessoa pode desmarcar antes de enviar)
      if (pedido?.foto) setUsarNoAnuncio(!!pedido.rascunhoId);
      // seletor de foto só se o Merc pode responder; senão a folha abre mostrando o motivo
      if (pedido?.foto && podeAgora) inputFoto.current?.click(); // dentro do toque da pessoa
      void carregarCompleto();
    },
    [carregarCompleto, podeAgora],
  );

  useEffect(() => {
    const ouvir = (e: Event) => abrir((e as CustomEvent<PedidoAbrirAki>).detail);
    window.addEventListener(EVENTO_ABRIR_AKI, ouvir);
    return () => window.removeEventListener(EVENTO_ABRIR_AKI, ouvir);
  }, [abrir]);

  // convite ao lado do balão (busca sem resultado); a tela pode ter pedido antes de o balão ouvir
  useEffect(() => {
    setDica(lerDicaPendente());
    const ouvir = (e: Event) => setDica((e as CustomEvent<DicaAki | null>).detail);
    window.addEventListener(EVENTO_DICA_AKI, ouvir);
    return () => window.removeEventListener(EVENTO_DICA_AKI, ouvir);
  }, []);

  // folha aberta: Esc fecha e a página de trás não rola (na tela cheia não há o que fechar)
  useEffect(() => {
    if (!aberto || pagina) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [aberto, pagina]);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, pensando, aberto]);

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    setPreparandoFoto(true);
    setAviso(null);
    try {
      const reduzida = await reduzirFoto(arquivo, { ladoMaximo: estado?.fotoLadoMaximo ?? 1024, qualidade: 0.75 });
      const base64 = await paraBase64(reduzida.blob);
      setFoto({
        base64,
        tipo: reduzida.formato === "webp" ? "image/webp" : "image/jpeg",
        previa: URL.createObjectURL(reduzida.blob),
        blob: reduzida.blob,
        formato: reduzida.formato,
      });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Essa foto não abriu. Tente outra.");
    } finally {
      setPreparandoFoto(false);
      if (inputFoto.current) inputFoto.current.value = "";
    }
  }

  function tirarFoto() {
    if (foto) URL.revokeObjectURL(foto.previa);
    setFoto(null);
  }

  function fecharDica() {
    setDica(null);
    mostrarDicaAki(null);
  }

  async function enviar(textoEnviar?: string) {
    const t = (textoEnviar ?? texto).trim();
    if (enviando || (!t && !foto) || !estado?.pode) return;
    setEnviando(true);
    setAviso(null);
    setPensando("Pensando…");
    const agora = new Date().toISOString();
    const minha: MensagemAki = { id: null, papel: "usuario", conteudo: { texto: t, foto: !!foto }, criado_em: agora };
    const resposta: MensagemAki = { id: null, papel: "assistente", conteudo: { texto: "" }, criado_em: agora, nota: null };
    setMensagens((m) => [...m, minha, resposta]);
    setTexto("");
    const corpo: PedidoAki = { texto: t, conversaId, foto: foto ? { base64: foto.base64, tipo: foto.tipo } : null, rascunhoId, ajudaWhatsapp: !!voltarDaAjuda };
    const fotoAnuncio = foto && usarNoAnuncio && rascunhoId ? foto : null;
    tirarFoto();

    // primeiro guarda a foto no rascunho (a pessoa marcou "Usar esta foto no anúncio"):
    // assim o card do rascunho que o Merc mostra já vem com ela
    if (fotoAnuncio && rascunhoId) {
      setPensando("Guardando a foto no anúncio…");
      const falhou = await guardarFotoNoAnuncio(fotoAnuncio, rascunhoId);
      if (falhou) setAviso(falhou);
      setPensando("Pensando…");
    }

    const atualizar = (f: (r: Extract<MensagemAki, { papel: "assistente" }>) => Extract<MensagemAki, { papel: "assistente" }>) =>
      setMensagens((m) => {
        const copia = [...m];
        const i = copia.length - 1;
        const ultima = copia[i];
        if (ultima?.papel === "assistente") copia[i] = f(ultima);
        return copia;
      });

    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      if (!r.body) throw new Error("sem resposta");
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let resto = "";
      const tratar = (linha: string) => {
        if (!linha.trim()) return;
        let ev: EventoAki;
        try {
          ev = JSON.parse(linha);
        } catch {
          return;
        }
        switch (ev.tipo) {
          case "texto":
            setPensando(null);
            atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, texto: x.conteudo.texto + ev.texto } }));
            break;
          case "substituir":
            atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, texto: ev.texto } }));
            break;
          case "pensando":
            setPensando(ev.rotulo);
            break;
          case "cartoes":
            atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, cartoes: ev.cartoes } }));
            break;
          case "acoes":
            atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, acoes: ev.acoes } }));
            break;
          case "bloqueado":
            setEstado((e) => (e ? { ...e, pode: false, motivo: ev.motivo } : e));
            atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, texto: x.conteudo.texto || ev.mensagem } }));
            break;
          case "erro":
            atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, texto: x.conteudo.texto ? `${x.conteudo.texto}\n\n${ev.mensagem}` : ev.mensagem } }));
            break;
          case "fim":
            if (ev.conversaId) setConversaId(ev.conversaId);
            atualizar((x) => ({ ...x, id: ev.mensagemId }));
            setEstado((e) =>
              e
                ? {
                    ...e,
                    restantes: ev.restantes,
                    ...(ev.restantes === 0 ? { pode: false, motivo: "limite_diario" as const } : {}),
                  }
                : e,
            );
            break;
        }
      };
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        let i: number;
        while ((i = resto.indexOf("\n")) >= 0) {
          tratar(resto.slice(0, i));
          resto = resto.slice(i + 1);
        }
      }
      tratar(resto + dec.decode());
    } catch {
      atualizar((x) => ({ ...x, conteudo: { ...x.conteudo, texto: x.conteudo.texto || "A conexão caiu. Tente de novo." } }));
    } finally {
      setPensando(null);
      setEnviando(false);
      caixa.current?.focus();
    }
  }

  async function apagarConversa() {
    setApagando(true);
    const r = await apagarMinhasConversas().catch(() => null);
    setApagando(false);
    setConfirmarApagar(false);
    if (r?.ok) {
      setMensagens([]);
      setConversaId(null);
      setRascunhoId(null);
      setAviso(r.mensagem);
    } else {
      setAviso(r && !r.ok ? r.erro : "Não deu para apagar agora. Tente de novo.");
    }
  }

  if (!estado?.ligado) {
    if (!pagina) return null;
    // tela cheia: carregando, sem conexão ou Merc desligado nesta região (sempre com saída)
    const carregandoPagina = !estado && !falhouEstado;
    return (
      <section aria-labelledby="aki-titulo" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <MascoteAki tamanho={64} />
        <h1 id="aki-titulo" className="text-titulo font-semibold">
          {carregandoPagina ? "Abrindo o Merc…" : falhouEstado ? "Não deu para abrir o Merc" : "O Merc está descansando"}
        </h1>
        {carregandoPagina ? (
          <Loader2 className="size-6 animate-spin text-texto-suave motion-reduce:animate-none" aria-hidden />
        ) : (
          <>
            <p className="max-w-sm text-base text-texto-suave">{falhouEstado ? "Algo deu errado. Confira sua internet e tente de novo." : DESCANSANDO}</p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {atendimentoAberto && <Botao href={atendimentoHref} variante="secundario">Ver atendimento com a equipe</Botao>}
              {falhouEstado ? (
                <Botao
                  larguraTotal
                  carregando={carregando}
                  textoCarregando="Tentando…"
                  onClick={() => {
                    completoCarregado.current = false;
                    void carregarCompleto();
                  }}
                >
                  Tentar de novo
                </Botao>
              ) : (
                <Botao href={voltarDaAjuda ? "/ajuda" : "/busca"} larguraTotal>
                  {voltarDaAjuda ? "Abrir a Central de ajuda" : "Buscar no Mercado da Região"}
                </Botao>
              )}
              <Botao href={voltarDaAjuda ?? "/"} variante="secundario" larguraTotal>
                {voltarDaAjuda ? "Voltar à confirmação" : "Voltar ao início"}
              </Botao>
            </div>
          </>
        )}
      </section>
    );
  }

  // telas com barra fixa embaixo (passos do anúncio, página do anúncio): o balão sobe para não cobrir
  const elevado = caminho.startsWith("/anunciar/") || caminho.startsWith("/anuncio/");
  const semAtalhoMovel = caminho.startsWith(`${LINK_ATENDIMENTO}/`) || caminho.startsWith("/anunciar/") ? "max-md:hidden" : "";
  const posicao = elevado
    ? "bottom-[calc(8rem+env(safe-area-inset-bottom))] md:bottom-28"
    : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6";
  // o convite fica logo acima do balão (balão de 44px + folga)
  const posicaoDica = elevado
    ? "bottom-[calc(12rem+env(safe-area-inset-bottom))] md:bottom-44"
    : "bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-24";

  const podeEscrever = estado.logado && estado.pode;
  const motivoTexto = estado.logado && !estado.pode ? mensagemBloqueio(estado.motivo) : null;
  const vazio = mensagens.length === 0;

  return (
    <>
      <input
        ref={inputFoto}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void escolherFoto(e.target.files?.[0])}
        aria-hidden
        tabIndex={-1}
      />

      {!aberto && dica && (
        <div
          role="status"
          className={`fixed right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center rounded-card bg-cartao shadow-2 md:right-6 ${posicaoDica} ${semAtalhoMovel}`}
        >
          <button
            type="button"
            onClick={() => abrir(dica.pedido)}
            className="min-h-10 flex-1 py-2 pr-2 pl-4 text-left text-base font-semibold text-beringela focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
          >
            {dica.texto}
          </button>
          <button type="button" onClick={fecharDica} aria-label="Fechar o convite do Merc" className="grid size-10 shrink-0 place-items-center text-texto-suave">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}

      {!aberto && (
        <button
          type="button"
          onClick={() => abrir()}
          className={`fixed right-4 z-30 flex h-10 items-center gap-2 rounded-full bg-cartao pl-2 pr-4 text-sm font-semibold text-beringela shadow-2 active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro md:right-6 ${posicao} ${semAtalhoMovel}`}
          aria-haspopup="dialog"
        >
          <MascoteAki tamanho={30} />
          Merc
        </button>
      )}

      {aberto && (
        <div className={pagina ? "contents" : "fixed inset-0 z-50"} role="presentation">
          {!pagina && (
            <button type="button" aria-label="Fechar o Merc" className="absolute inset-0 bg-beringela/40" onClick={() => setAberto(false)} />
          )}
          <section
            role={pagina ? undefined : "dialog"}
            aria-modal={pagina ? undefined : true}
            aria-labelledby="aki-titulo"
            className={
              pagina
                ? "mx-auto flex h-dvh w-full max-w-2xl flex-col bg-cartao md:border-x md:border-borda"
                : "absolute inset-x-0 bottom-0 mx-auto flex h-[88dvh] max-w-lg flex-col rounded-t-folha bg-cartao shadow-2 md:bottom-6 md:right-6 md:left-auto md:h-[min(720px,85dvh)] md:w-[420px] md:rounded-folha"
            }
          >
            <header className={`flex items-center gap-2 border-b border-borda py-1 pr-1 ${pagina ? "pl-1" : "pl-4"}`}>
              {pagina && (
                <Link href={voltarDaAjuda ?? "/"} aria-label={voltarDaAjuda ? "Voltar à confirmação" : "Voltar ao início"} className="grid size-10 shrink-0 place-items-center text-beringela">
                  <ArrowLeft className="size-6" aria-hidden />
                </Link>
              )}
              <MascoteAki tamanho={32} />
              <div className="min-w-0 flex-1">
                {pagina ? (
                  <h1 id="aki-titulo" className="text-lg leading-6 font-semibold">
                    Merc
                  </h1>
                ) : (
                  <h2 id="aki-titulo" className="text-lg leading-6 font-semibold">
                    Merc
                  </h2>
                )}
                <p className="text-legenda leading-[18px] text-texto-suave">Ajudante do Mercado da Região</p>
              </div>
              {estado.logado && mensagens.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmarApagar(true)}
                  disabled={enviando}
                  title={enviando ? "Espere o Merc terminar de responder" : undefined}
                  className="flex h-10 items-center gap-1 px-3 text-legenda font-semibold text-perigo disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Apagar conversa
                </button>
              )}
              {!pagina && (
                <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="grid size-10 place-items-center text-beringela">
                  <X className="size-6" aria-hidden />
                </button>
              )}
            </header>

            {estado.avisoIa && (
              <p className="flex items-start gap-2 bg-selecao px-4 py-2 text-legenda leading-[18px] text-beringela">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {estado.avisoIa}
              </p>
            )}

            {voltarDaAjuda && (
              <div className="border-b border-borda bg-fundo px-4 py-3 text-sm text-texto-suave">
                <p>Conte ao Merc o que aconteceu com a confirmação do WhatsApp. Nunca envie o código pelo bate-papo.</p>
                <p>Ao tocar em <strong>Não ajudou</strong>, a equipe recebe sua pergunta e a resposta do Merc.</p>
                {atendimentoAberto && <Botao href={atendimentoHref} variante="texto">Ver atendimento com a equipe</Botao>}
              </div>
            )}

            {confirmarApagar && (
              <div role="alertdialog" aria-label="Apagar conversa" className="space-y-2 bg-perigo-fundo px-4 py-3">
                <p className="text-sm text-perigo">Apagar toda a sua conversa com o Merc? Não dá para desfazer.</p>
                <div className="flex gap-2">
                  <Botao variante="perigo" carregando={apagando} textoCarregando="Apagando…" disabled={enviando} onClick={() => void apagarConversa()}>
                    Apagar
                  </Botao>
                  <Botao variante="secundario" onClick={() => setConfirmarApagar(false)} disabled={apagando}>
                    Cancelar
                  </Botao>
                </div>
              </div>
            )}

            <div ref={lista} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {carregando && (
                <p className="flex items-center gap-2 text-sm text-texto-suave">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Abrindo a conversa…
                </p>
              )}

              {vazio && !carregando && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MascoteAki tamanho={28} className="mt-1 shrink-0" />
                    <p className="rounded-card rounded-tl-none bg-fundo px-3 py-2 text-base leading-6">
                      {estado.boasVindas ?? "Oi! Eu sou o Merc. Posso ajudar a achar coisas à venda e a anunciar."}
                    </p>
                  </div>
                  {!estado.logado && (
                    <Botao href={`/entrar?redirect_url=${encodeURIComponent(caminho)}`} larguraTotal>
                      Entrar para conversar
                    </Botao>
                  )}
                  {podeEscrever && estado.sugestoes.length > 0 && (
                    <div className="flex flex-wrap gap-2" aria-label="Sugestões">
                      {estado.sugestoes.map((s) => (
                        <Chip key={s} onClick={() => void enviar(s)} disabled={enviando} className="text-left whitespace-normal">
                          {s}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mensagens.map((m, i) =>
                m.papel === "usuario" ? (
                  <div key={`u${m.id ?? i}`} className="flex justify-end">
                    <p className="max-w-[85%] rounded-card rounded-br-none bg-selecao px-3 py-2 text-base leading-6 whitespace-pre-wrap">
                      {m.conteudo.foto && (
                        <span className="mb-1 flex items-center gap-1 text-legenda text-texto-suave">
                          <Camera className="size-4" aria-hidden /> Foto enviada
                        </span>
                      )}
                      {m.conteudo.texto}
                    </p>
                  </div>
                ) : (
                  <RespostaAki
                    key={`a${m.id ?? i}`}
                    mensagem={m}
                    escrevendo={enviando && i === mensagens.length - 1}
                    pensando={i === mensagens.length - 1 ? pensando : null}
                    atendimentoHref={atendimentoHref}
                    aoAvaliar={(nota) =>
                      setMensagens((lista) => lista.map((x) => (x === m && x.papel === "assistente" ? { ...x, nota } : x)))
                    }
                  />
                ),
              )}
            </div>

            <footer className="border-t border-borda px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {aviso && (
                <Alert variant="info" role="status" className="mb-2">
                  {aviso}
                </Alert>
              )}
              {estado.logado && motivoTexto && (
                <Alert variant="warning" role="status" className="mb-2">
                  {motivoTexto}
                </Alert>
              )}
              {podeEscrever && estado.restantes !== null && estado.restantes <= 5 && (
                <p className="mb-1 text-legenda text-texto-suave">
                  {estado.restantes === 1 ? "Falta 1 mensagem hoje." : `Faltam ${estado.restantes} mensagens hoje.`}
                </p>
              )}
              {foto && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- prévia local da foto (objectURL) */}
                  <img src={foto.previa} alt="Foto escolhida" className="size-16 rounded-campo object-cover" />
                  <span className="flex-1 text-sm text-texto-suave">
                    {usarNoAnuncio && rascunhoId
                      ? "A foto vai para o Merc e fica no seu anúncio."
                      : "A foto vai junto com a mensagem e não fica guardada."}
                  </span>
                  <button type="button" onClick={tirarFoto} aria-label="Tirar a foto" className="grid size-10 place-items-center text-perigo">
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
              )}
              {foto && rascunhoId && (
                <div className="mb-2">
                  <Chip ativo={usarNoAnuncio} onClick={() => setUsarNoAnuncio((v) => !v)}>
                    Usar esta foto no anúncio
                  </Chip>
                </div>
              )}
              {estado.logado ? (
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void enviar();
                  }}
                >
                  <button
                    type="button"
                    onClick={() => inputFoto.current?.click()}
                    disabled={!podeEscrever || enviando || preparandoFoto}
                    className="flex h-10 shrink-0 flex-col items-center justify-center rounded-campo border border-borda px-2 text-legenda leading-4 font-semibold text-beringela disabled:opacity-50"
                  >
                    {preparandoFoto ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <Camera className="size-5" aria-hidden />}
                    Foto
                  </button>
                  <label htmlFor="aki-texto" className="sr-only">
                    Mensagem para o Merc
                  </label>
                  <textarea
                    id="aki-texto"
                    ref={caixa}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void enviar();
                      }
                    }}
                    maxLength={estado.maxCaracteres}
                    rows={1}
                    disabled={!podeEscrever}
                    placeholder={podeEscrever ? "Escreva para o Merc" : DESCANSANDO}
                    className={`${classesCampo} max-h-32 min-h-10 flex-1 resize-none py-2 leading-6`}
                  />
                  <Botao
                    type="submit"
                    carregando={enviando}
                    textoCarregando="…"
                    disabled={!podeEscrever || (!texto.trim() && !foto)}
                    icone={<SendHorizontal />}
                    className="shrink-0 px-4"
                  >
                    Enviar
                  </Botao>
                </form>
              ) : (
                <p className="text-center text-legenda text-texto-suave">Entre na sua conta para conversar com o Merc.</p>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
