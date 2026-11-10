"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, QrCode, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Campo } from "@/components/ui/campo";
import { Aviso } from "@/components/conta/aviso";
import { PagarPix } from "@/components/destaques/escolher-destaque";
import { preco } from "@/lib/formato";
import { documentoValido, mascaraDocumento } from "@/lib/cpf-cnpj";
import { pagarCobranca, verificarCobranca } from "@/app/(conta)/pagar/actions";
import type { ResultadoCobranca } from "@/app/(conta)/pagar/actions";
import type { Cobranca, FormaPagamento, MeuPagamento, RespostaCobranca } from "@/lib/tipos-cobranca";

// Pagamento de plano ou de anúncio avulso: Pix ou cartão → espera (a tela pergunta sozinha) → pronto.
// O mesmo jeito da tela de destaques: um botão principal por etapa, todos com "carregando".

const CADA_SEGUNDOS = 5; // pergunta a situação a cada 5 s
const ASAAS_A_CADA = 3; // e confere direto no Asaas a cada 3 perguntas
const ESPERA_MAX_MIN = 30; // depois para de perguntar sozinha (botão "Já paguei")

type Etapa = "escolher" | "aguardando" | "sucesso" | "cancelado";

export type FluxoCobrancaProps = {
  /** Valor que vai ser cobrado (mostrado no botão). */
  valorCentavos: number;
  /** Ainda não tem cliente no Asaas: pede CPF/CNPJ antes de pagar. */
  precisaDocumento: boolean;
  /** Pagamento em andamento (?p=...). */
  pagamentoInicial?: MeuPagamento | null;
  /** Cria o pedido no banco e a cobrança no Asaas. */
  pedir: (forma: FormaPagamento, documento: string | null) => Promise<ResultadoCobranca>;
  /** Avisa o pagamento em andamento (para pôr ?p= no endereço) ou null ao recomeçar. */
  aoOcupar?: (ocupado: boolean) => void;
  aoMudarPagamento?: (id: string | null) => void;
  /** Chamado quando o pagamento é confirmado. */
  aoPagar?: (p: MeuPagamento) => void;
  /** O que mostrar depois de pago. */
  sucesso: (p: MeuPagamento) => ReactNode;
  /** Botão desligado (ex.: nada escolhido). */
  desligado?: boolean;
  /** Texto curto embaixo do botão (ex.: como o plano vai entrar). */
  nota?: ReactNode;
  /** Erro vindo do banco: o pai pode mostrar um link (ex.: "Corrigir agora"). */
  aoErrar?: (erro: { mensagem: string; campo?: string }) => ReactNode | null;
};

export function FluxoCobranca({
  valorCentavos,
  precisaDocumento,
  pagamentoInicial,
  pedir,
  aoMudarPagamento,
  aoOcupar,
  aoPagar,
  sucesso,
  desligado,
  nota,
  aoErrar,
}: FluxoCobrancaProps) {
  const [pendente, iniciar] = useTransition();
  const bloqueio = useRef(false);
  const versao = useRef(0);
  const callbacks = useRef({ aoPagar, aoMudarPagamento, aoOcupar });
  callbacks.current = { aoPagar, aoMudarPagamento, aoOcupar };
  const [idSalvo, setIdSalvo] = useState(pagamentoInicial?.id ?? null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>(() =>
    pagamentoInicial?.status === "pago"
      ? "sucesso"
      : pagamentoInicial?.status === "pendente" && pagamentoInicial.tem_cobranca
        ? "aguardando"
        : pagamentoInicial && pagamentoInicial.status !== "pendente"
          ? "cancelado"
          : "escolher",
  );
  const [forma, setForma] = useState<FormaPagamento>(pagamentoInicial?.forma === "cartao" ? "cartao" : "pix");
  const [pedirDoc, setPedirDoc] = useState(precisaDocumento);
  const [documento, setDocumento] = useState("");
  const [erroDoc, setErroDoc] = useState<string | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; campo?: string } | null>(null);
  const [pagamento, setPagamento] = useState<MeuPagamento | null>(pagamentoInicial ?? null);
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [emCurso, setEmCurso] = useState<"pagar" | "trocar" | "conferir" | null>(null);
  const pagamentoId = pagamento?.status === "pendente" ? pagamento.id : idSalvo;

  const confirmar = useCallback(
    (p: MeuPagamento) => {
      setPagamento(p);
      setEtapa("sucesso");
      setErro(null);
      callbacks.current.aoPagar?.(p);
    },
    [],
  );

  function receber(r: RespostaCobranca) {
    if (r.etapa === "precisa_documento") {
      setIdSalvo(r.pagamentoId);
      setEtapa("escolher");
      setPedirDoc(true);
      setErroDoc("Para pagar, digite seu CPF ou CNPJ.");
      return;
    }
    if (r.etapa === "pago") return confirmar(r.pagamento);
    setIdSalvo(r.pagamento.id);
    setPagamento(r.pagamento);
    setCobranca(r.cobranca);
    setEtapa("aguardando");
    callbacks.current.aoMudarPagamento?.(r.pagamento.id);
  }

  function pagar(formaEscolhida: FormaPagamento = forma, acao: "pagar" | "trocar" = "pagar") {
    if (bloqueio.current || desligado) return;
    setErro(null);
    setErroDoc(null);
    if (pedirDoc && !documentoValido(documento)) {
      setErroDoc("CPF ou CNPJ inválido. Confira os números.");
      return;
    }
    bloqueio.current = true;
    callbacks.current.aoOcupar?.(true);
    setEmCurso(acao);
    const atual = versao.current;
    iniciar(async () => {
      try {
        const doc = pedirDoc ? documento : null;
        const r = pagamentoId ? await pagarCobranca(pagamentoId, formaEscolhida, doc) : await pedir(formaEscolhida, doc);
        if (atual !== versao.current) return;
        if (r.ok) { setForma(formaEscolhida); receber(r.dados); }
        else {
          if (r.pagamentoId) setIdSalvo(r.pagamentoId);
          setErro(r.erro);
        }
      } catch {
        setErro({ mensagem: "A conexão falhou. Consulte seu histórico antes de iniciar outro pedido; você pode retomar o pagamento por lá." });
      } finally {
        bloqueio.current = false;
        callbacks.current.aoOcupar?.(false);
        setEmCurso(null);
      }
    });
  }

  // Retoma a cobrança pelo id salvo. Uma falha oferece recuperação no próprio painel.
  useEffect(() => {
    if (etapa !== "aguardando" || cobranca || !pagamentoInicial || desligado) return;
    let cancelado = false;
    pagarCobranca(pagamentoInicial.id, pagamentoInicial.forma === "cartao" ? "cartao" : "pix", null)
      .then((r) => { if (!cancelado) { if (r.ok) receber(r.dados); else setErro(r.erro); } })
      .catch(() => { if (!cancelado) setErro({ mensagem: "Não foi possível carregar a cobrança. Tente novamente." }); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retomada apenas uma vez; as ações seguintes são explícitas
  }, []);

  // Espera: pergunta a cada 5 s, por até 30 min
  const [esgotou, setEsgotou] = useState(false);
  const conferir = useCallback(
    async (perguntarAoAsaas: boolean, manual = false) => {
      if (!pagamentoId) return;
      const atual = versao.current;
      try {
        const r = await verificarCobranca(pagamentoId, perguntarAoAsaas);
        if (atual !== versao.current) return;
        if (!r.ok) { setErro(r.erro); return; }
        setErro(null);
        if (r.dados.status === "pago") confirmar(r.dados);
        else if (r.dados.status !== "pendente") { setPagamento(r.dados); setEtapa("cancelado"); }
        else if (manual) setConsulta("O pagamento ainda aguarda confirmação. Você pode consultar novamente em instantes.");
      } catch {
        if (atual === versao.current) setErro({ mensagem: "Não foi possível conferir agora. Tente novamente em instantes." });
      }
    }, [pagamentoId, confirmar],
  );
  useEffect(() => {
    if (etapa !== "aguardando" || !pagamentoId || esgotou) return;
    let vez = 0;
    let parado = false;
    const inicio = Date.now();
    let relogio: ReturnType<typeof setTimeout>;
    const passo = async () => {
      if (parado) return;
      vez += 1;
      await conferir(vez % ASAAS_A_CADA === 0).catch(() => undefined);
      if (parado) return;
      if (Date.now() - inicio > ESPERA_MAX_MIN * 60_000) setEsgotou(true);
      else relogio = setTimeout(passo, CADA_SEGUNDOS * 1000);
    };
    relogio = setTimeout(passo, CADA_SEGUNDOS * 1000);
    return () => {
      parado = true;
      clearTimeout(relogio);
    };
  }, [etapa, pagamentoId, esgotou, conferir]);

  function conferirAgora() {
    if (bloqueio.current) return;
    bloqueio.current = true;
    setEmCurso("conferir");
    iniciar(async () => {
      try { await conferir(true, true); setEsgotou(false); }
      finally { bloqueio.current = false; setEmCurso(null); }
    });
  }

  function recomecar() {
    if (bloqueio.current) return;
    versao.current += 1;
    setPagamento(null);
    setIdSalvo(null);
    setCobranca(null);
    setErro(null);
    setConsulta(null);
    setEsgotou(false);
    setDocumento("");
    setEtapa("escolher");
    callbacks.current.aoMudarPagamento?.(null);
  }

  const linkErro = erro && aoErrar ? aoErrar(erro) : null;

  /* ------------------------------ Pronto ------------------------------ */
  if (etapa === "sucesso" && pagamento) {
    if (pagamento.devolver_motivo) {
      return (
        <CaixaResultado icone="erro" titulo="Recebemos seu pagamento, mas não deu para aplicar">
          <p className="max-w-sm text-base text-texto-suave">
            {pagamento.devolver_motivo} A equipe OLAKI vai devolver o seu dinheiro. Se tiver dúvida, fale com a gente.
          </p>
        </CaixaResultado>
      );
    }
    return <>{sucesso(pagamento)}</>;
  }

  /* ---------------------------- Cancelado ----------------------------- */
  if (etapa === "cancelado") {
    const devolvido = pagamento?.status === "estornado";
    return (
      <CaixaResultado icone="erro" titulo={devolvido ? "Este pagamento foi devolvido" : "Esta cobrança não vale mais"}>
        <p className="max-w-sm text-base text-texto-suave">
          {devolvido
            ? "O dinheiro voltou para você e o que ele dava foi desfeito. Se quiser, faça um pedido novo."
            : "O prazo para pagar acabou ou você escolheu outra opção. Faça um pedido novo para gerar outro Pix."}
        </p>
        <Botao larguraTotal className="max-w-sm" onClick={recomecar}>
          Fazer um pedido novo
        </Botao>
      </CaixaResultado>
    );
  }

  /* ---------------------------- Aguardando ---------------------------- */
  if (etapa === "aguardando") {
    return (
      <section className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <div className="flex items-center gap-2 rounded-card bg-aviso-fundo p-3 text-aviso" role="status" aria-live="polite">
          <Loader2 className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          <p className="text-base font-semibold">Aguardando pagamento{pagamento ? ` de ${preco(pagamento.valor_centavos)}` : ""}...</p>
        </div>

        {!cobranca ? (
          <div className="flex flex-col gap-2">
            <p className="text-base text-texto-suave">{erro ? "A cobrança ainda não foi carregada." : "Carregando o pagamento..."}</p>
            <Botao variante="secundario" disabled={pendente || desligado} carregando={emCurso === "trocar"} onClick={() => pagar(forma, "trocar")}>Recarregar cobrança</Botao>
          </div>
        ) : cobranca.forma === "pix" ? (
          <PagarPix cobranca={cobranca} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-base">Toque no botão para abrir a página segura do cartão. Depois de pagar, volte aqui: a tela muda sozinha.</p>
            <Botao href={cobranca.link} target="_blank" rel="noopener noreferrer" larguraTotal icone={<ExternalLink />}>
              Pagar no cartão
            </Botao>
          </div>
        )}

        {consulta && <p role="status" className="text-sm text-texto-suave">{consulta}</p>}
        {esgotou && (
          <Aviso tipo="atencao">
            <span>Ainda não recebemos o pagamento. Se você já pagou, espere uns minutos e toque em &quot;Já paguei&quot;.</span>
          </Aviso>
        )}
        {erro && (
          <Aviso tipo="erro">
            <span>{erro.mensagem}</span>
          </Aviso>
        )}

        <div className="flex flex-col gap-2 border-t border-borda pt-3">
          <Botao variante="secundario" larguraTotal carregando={emCurso === "conferir"} textoCarregando="Conferindo..." disabled={pendente} onClick={conferirAgora}>
            Já paguei
          </Botao>
          {cobranca && (
            <Botao
              variante="texto"
              larguraTotal
              icone={cobranca.forma === "pix" ? <CreditCard /> : <QrCode />}
              carregando={emCurso === "trocar"}
              textoCarregando="Trocando..."
              disabled={pendente || desligado}
              onClick={() => pagar(cobranca.forma === "pix" ? "cartao" : "pix", "trocar")}
            >
              {cobranca.forma === "pix" ? "Prefiro pagar no cartão" : "Prefiro pagar com Pix"}
            </Botao>
          )}
          <Botao variante="texto" larguraTotal disabled={pendente} onClick={recomecar}>
            Escolher outra opção
          </Botao>
        </div>
      </section>
    );
  }

  /* ----------------------------- Escolher ----------------------------- */
  return (
    <section aria-labelledby="titulo-pagar" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
      <h2 id="titulo-pagar" className="text-lg font-semibold">
        Como você quer pagar?
      </h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Forma de pagamento">
        <Chip disabled={pendente} ativo={forma === "pix"} icone={<QrCode />} onClick={() => setForma("pix")}>
          Pix
        </Chip>
        <Chip disabled={pendente} ativo={forma === "cartao"} icone={<CreditCard />} onClick={() => setForma("cartao")}>
          Cartão
        </Chip>
      </div>
      {pedirDoc && (
        <Campo
          rotulo="Seu CPF ou CNPJ"
          name="documento"
          disabled={pendente}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={documento}
          onChange={(e) => {
            setDocumento(mascaraDocumento(e.target.value));
            setErroDoc(null);
          }}
          erro={erroDoc}
          dica="O banco pede para gerar o pagamento. O OLAKI não guarda esse número."
        />
      )}
      <Botao
        larguraTotal
        icone={forma === "pix" ? <QrCode /> : <CreditCard />}
        carregando={emCurso === "pagar"}
        textoCarregando={forma === "pix" ? "Gerando o Pix..." : "Abrindo o pagamento..."}
        disabled={pendente || desligado}
        onClick={() => pagar()}
      >
        {`Pagar ${preco(pagamento?.valor_centavos ?? valorCentavos)} ${forma === "pix" ? "com Pix" : "no cartão"}`}
      </Botao>
      {nota && <div className="text-sm text-texto-suave">{nota}</div>}
      {erro && (
        <Aviso tipo="erro">
          <span>{erro.mensagem}</span>
          {linkErro}
        </Aviso>
      )}
    </section>
  );
}

/** Caixa de resultado (pronto, cancelado, devolver) com ícone grande. */
export function CaixaResultado({ icone, titulo, children }: { icone: "ok" | "erro"; titulo: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-card bg-cartao p-6 text-center shadow-1" aria-live="polite">
      <span
        className={`grid size-20 place-items-center rounded-full ${icone === "ok" ? "bg-sucesso-fundo text-verde-escuro" : "bg-perigo-fundo text-perigo"}`}
        aria-hidden
      >
        {icone === "ok" ? <CheckCircle2 className="size-10" /> : <XCircle className="size-10" />}
      </span>
      <h2 className="text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
