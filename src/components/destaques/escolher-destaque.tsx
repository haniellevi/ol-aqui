"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, CreditCard, ExternalLink, Gift, Loader2, QrCode, Sparkles, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Campo } from "@/components/ui/campo";
import { Aviso } from "@/components/conta/aviso";
import { preco } from "@/lib/formato";
import { documentoValido, mascaraDocumento } from "@/lib/cpf-cnpj";
import { linkDestacar, linkDestacarLoja } from "@/lib/rotas";
import {
  comprarDestaque,
  pagarPedidoDestaque,
  usarCreditoDestaque,
  verificarPedidoDestaque,
} from "@/app/(conta)/destacar/actions";
import type { Cobranca, FormaPagamento, OpcaoDestaque, PedidoDestaque, RespostaPagamento } from "@/lib/tipos-destaques";
import { Alert } from "@/components/ui/alert";

// Tela "Destacar": escolher o tipo → pagar (Pix ou cartão) ou usar crédito grátis → esperar → pronto.
// Um botão principal por etapa, todos com "carregando" e sem toque duplo.

const CADA_SEGUNDOS = 5; // a tela pergunta a situação do pagamento a cada 5 s
const ASAAS_A_CADA = 3; // e confere direto no Asaas a cada 3 perguntas (15 s)
const ESPERA_MAX_MIN = 30; // depois disso para de perguntar sozinha (botão "Já paguei")

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" });
const ate = (iso: string | null) => (iso ? dataCurta.format(new Date(iso)) : "");

type Etapa = "escolher" | "aguardando" | "sucesso" | "cancelado";

export type EscolherDestaqueProps = {
  opcoes: OpcaoDestaque[];
  anuncioId: string | null;
  /** O Asaas está ligado (ASAAS_API_KEY na Vercel). Sem ele só créditos grátis. */
  pagamentoLigado: boolean;
  /** Ainda não tem cliente no Asaas: pede CPF/CNPJ antes de pagar. */
  precisaDocumento: boolean;
  /** Pedido em andamento (?d=...). */
  pedidoInicial?: PedidoDestaque | null;
  /** Para onde vai depois de pronto. */
  voltar: { href: string; texto: string };
};

export function EscolherDestaque({ opcoes, anuncioId, pagamentoLigado, precisaDocumento, pedidoInicial, voltar }: EscolherDestaqueProps) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [etapa, setEtapa] = useState<Etapa>(() =>
    pedidoInicial?.status === "ativo" ? "sucesso" : pedidoInicial?.status === "aguardando_pagamento" && pedidoInicial.tem_cobranca ? "aguardando" : "escolher",
  );
  const [escolhido, setEscolhido] = useState<string | null>(() => pedidoInicial?.tipo ?? opcoes.find((o) => o.disponivel)?.slug ?? null);
  const [forma, setForma] = useState<FormaPagamento>(pedidoInicial?.pagamento_forma === "cartao" ? "cartao" : "pix");
  const [pedirDoc, setPedirDoc] = useState(precisaDocumento);
  const [documento, setDocumento] = useState("");
  const [erroDoc, setErroDoc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoDestaque | null>(pedidoInicial ?? null);
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [emCurso, setEmCurso] = useState<"credito" | "pagar" | "trocar" | "conferir" | null>(null);
  const pedidoId = pedido?.status === "aguardando_pagamento" ? pedido.id : null;

  const opcao = opcoes.find((o) => o.slug === escolhido) ?? null;
  // endereço desta tela, com ou sem o pedido (?d=...) para a pessoa poder voltar ao pagamento
  const enderecoTela = useCallback(
    (id: string | null) => (anuncioId ? linkDestacar(anuncioId, id) : linkDestacarLoja(id)),
    [anuncioId],
  );
  const temCredito = !!opcao && opcao.disponivel && opcao.creditos_restantes > 0;
  const gratis = !!opcao && opcao.disponivel && !temCredito && opcao.preco_centavos === 0;
  const podePagar = !!opcao && opcao.disponivel && pagamentoLigado && opcao.preco_centavos > 0;

  function receber(r: RespostaPagamento) {
    if (r.etapa === "precisa_documento") {
      setPedirDoc(true);
      setErroDoc("Para pagar, digite seu CPF ou CNPJ.");
      return;
    }
    setPedido(r.pedido);
    if (r.etapa === "ativo") {
      setEtapa("sucesso");
      router.refresh();
    } else {
      setCobranca(r.cobranca);
      setEtapa("aguardando");
      router.replace(enderecoTela(r.pedido.id), { scroll: false });
    }
  }

  function usarCredito() {
    if (!opcao) return;
    setErro(null);
    setEmCurso("credito");
    iniciar(async () => {
      const r = await usarCreditoDestaque(opcao.slug, anuncioId, !gratis);
      if (r.ok) {
        setPedido(r.dados);
        setEtapa("sucesso");
        router.refresh();
      } else setErro(r.erro.mensagem);
      setEmCurso(null);
    });
  }

  function pagar(formaEscolhida: FormaPagamento = forma, acao: "pagar" | "trocar" = "pagar") {
    if (!opcao && !pedidoId) return;
    setErro(null);
    setErroDoc(null);
    if (pedirDoc && !documentoValido(documento)) {
      setErroDoc("CPF ou CNPJ inválido. Confira os números.");
      return;
    }
    setEmCurso(acao);
    iniciar(async () => {
      const doc = pedirDoc ? documento : null;
      // pedido em andamento só vale para o mesmo tipo (se a pessoa trocou de cartão, é um pedido novo)
      const usarPedido = pedidoId && (etapa === "aguardando" || !opcao || pedido?.tipo === opcao.slug) ? pedidoId : null;
      const r = usarPedido
        ? await pagarPedidoDestaque(usarPedido, formaEscolhida, doc)
        : await comprarDestaque(opcao!.slug, anuncioId, formaEscolhida, doc);
      if (r.ok) {
        setForma(formaEscolhida);
        receber(r.dados);
      } else setErro(r.erro.mensagem);
      setEmCurso(null);
    });
  }

  // Voltou pelo link (?d=...) com cobrança já criada: busca o Pix/link de novo (reaproveita a mesma cobrança)
  const buscouCobranca = useRef(false);
  useEffect(() => {
    if (buscouCobranca.current || etapa !== "aguardando" || cobranca || !pedidoInicial) return;
    buscouCobranca.current = true;
    const f: FormaPagamento = pedidoInicial.pagamento_forma === "cartao" ? "cartao" : "pix";
    pagarPedidoDestaque(pedidoInicial.id, f, null).then((r) => {
      if (r.ok) receber(r.dados);
      else setErro(r.erro.mensagem);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só uma vez, ao abrir
  }, [etapa]);

  // Espera do pagamento: pergunta a cada 5 s, por até 30 min
  const [esgotou, setEsgotou] = useState(false);
  const conferir = useCallback(
    async (perguntarAoAsaas: boolean) => {
      if (!pedidoId) return;
      const r = await verificarPedidoDestaque(pedidoId, perguntarAoAsaas);
      if (!r.ok) return;
      setPedido(r.dados);
      if (r.dados.status === "ativo") {
        setEtapa("sucesso");
        router.refresh();
      } else if (r.dados.status === "cancelado" || r.dados.status === "encerrado") {
        setEtapa("cancelado");
      }
    },
    [pedidoId, router],
  );
  useEffect(() => {
    if (etapa !== "aguardando" || !pedidoId || esgotou) return;
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
  }, [etapa, pedidoId, esgotou, conferir]);

  function conferirAgora() {
    setEmCurso("conferir");
    iniciar(async () => {
      await conferir(true);
      setEsgotou(false);
      setEmCurso(null);
    });
  }

  function recomecar() {
    setPedido(null);
    setCobranca(null);
    setErro(null);
    setEtapa("escolher");
    router.replace(enderecoTela(null), { scroll: false });
    router.refresh();
  }

  /* ------------------------------ Pronto ------------------------------ */
  if (etapa === "sucesso") {
    const subir = pedido?.tipo === "subir";
    // home/loja comprado com outro ainda valendo: o novo começa quando o atual acaba
    const comecaDepois = !!pedido?.inicio && new Date(pedido.inicio).getTime() > Date.now() + 60_000;
    return (
      <section className="flex flex-col items-center gap-4 rounded-card bg-cartao p-6 text-center shadow-1" aria-live="polite">
        <span className="grid size-20 place-items-center rounded-full bg-sucesso-fundo text-verde-escuro" aria-hidden>
          <CheckCircle2 className="size-10" />
        </span>
        <h2 className="text-xl font-semibold">{comecaDepois ? "Pronto! Seu destaque está garantido." : "Pronto! Seu destaque está ativo."}</h2>
        <p className="max-w-sm text-base text-texto-suave">
          {subir
            ? "Seu anúncio voltou para o topo dos mais recentes."
            : comecaDepois && pedido?.fim
              ? `${pedido.tipo_nome}: começa em ${ate(pedido.inicio)}, quando o destaque de agora acabar, e vai até ${ate(pedido.fim)}. Ele aparece com a etiqueta "Patrocinado".`
              : pedido?.fim
                ? `${pedido.tipo_nome} até ${ate(pedido.fim)}. Ele aparece com a etiqueta "Patrocinado".`
                : 'Ele aparece com a etiqueta "Patrocinado".'}
        </p>
        <p className="max-w-sm text-sm text-texto-suave">
          {anuncioId
            ? "Em Meus anúncios você vê quantas pessoas viram e chamaram no WhatsApp."
            : "Em Minha loja você vê quantas pessoas viram e chamaram no WhatsApp."}
        </p>
        <Botao href={voltar.href} larguraTotal className="max-w-sm">
          {voltar.texto}
        </Botao>
      </section>
    );
  }

  /* ---------------------------- Cancelado ----------------------------- */
  if (etapa === "cancelado") {
    // dinheiro chegou mas o destaque não pôde ser ligado: a equipe devolve (não oferece comprar de novo)
    const pagoSemDestaque = pedido?.pagamento_status === "pago";
    return (
      <section className="flex flex-col items-center gap-4 rounded-card bg-cartao p-6 text-center shadow-1" aria-live="polite">
        <span className="grid size-20 place-items-center rounded-full bg-perigo-fundo text-perigo" aria-hidden>
          <XCircle className="size-10" />
        </span>
        {pagoSemDestaque ? (
          <>
            <h2 className="text-xl font-semibold">Recebemos seu pagamento, mas o destaque não pôde ser ligado</h2>
            <p className="max-w-sm text-base text-texto-suave">
              A equipe Mercado da Região vai devolver o seu dinheiro. Se tiver dúvida, fale com a gente.
            </p>
            <Botao href={voltar.href} larguraTotal className="max-w-sm">
              {voltar.texto}
            </Botao>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Este pedido foi cancelado</h2>
            <p className="max-w-sm text-base text-texto-suave">
              O prazo para pagar acabou ou o pedido foi cancelado. Se você ainda tem o Pix antigo, não pague: ele não vale mais.
            </p>
            <Botao larguraTotal className="max-w-sm" onClick={recomecar}>
              Escolher de novo
            </Botao>
          </>
        )}
      </section>
    );
  }

  /* ---------------------------- Aguardando ---------------------------- */
  if (etapa === "aguardando") {
    return (
      <section className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
        <Alert variant="warning" role="status" aria-live="polite" className="flex items-center gap-2">
          <Loader2 className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          <p className="text-base font-semibold">
            Aguardando pagamento{pedido ? ` de ${preco(pedido.preco_centavos)}` : ""}...
          </p>
        </Alert>

        {!cobranca ? (
          <p className="flex items-center gap-2 text-base text-texto-suave">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            Carregando o pagamento...
          </p>
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

        {esgotou && (
          <Aviso tipo="atencao">
            <span>Ainda não recebemos o pagamento. Se você já pagou, espere uns minutos e toque em &quot;Já paguei&quot;.</span>
          </Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

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
              disabled={pendente}
              onClick={() => pagar(cobranca.forma === "pix" ? "cartao" : "pix", "trocar")}
            >
              {cobranca.forma === "pix" ? "Prefiro pagar no cartão" : "Prefiro pagar com Pix"}
            </Botao>
          )}
        </div>
      </section>
    );
  }

  /* ----------------------------- Escolher ----------------------------- */
  if (!opcoes.length) {
    return (
      <Aviso tipo="info">
        <span>Nenhum destaque disponível agora. Tente de novo mais tarde.</span>
      </Aviso>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Escolha o destaque</legend>
        {opcoes.map((o) => (
          <CartaoOpcao
            key={o.slug}
            opcao={o}
            pagamentoLigado={pagamentoLigado}
            ativo={o.slug === escolhido}
            onEscolher={() => {
              setEscolhido(o.slug);
              setErro(null);
            }}
          />
        ))}
      </fieldset>

      {opcao && opcao.disponivel && (
        <section aria-labelledby="titulo-confirmar" className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1">
          <h2 id="titulo-confirmar" className="text-lg font-semibold">
            {temCredito || gratis ? "Usar destaque grátis" : "Como você quer pagar?"}
          </h2>

          {temCredito ? (
            <>
              <p className="text-base">
                Você usa 1 dos seus {opcao.creditos_restantes} &quot;{opcao.nome}&quot; grátis deste mês. Nada é cobrado.
              </p>
              <Botao larguraTotal icone={<Gift />} carregando={emCurso === "credito"} textoCarregando="Ativando..." disabled={pendente} onClick={usarCredito}>
                Usar meu destaque grátis
              </Botao>
            </>
          ) : gratis ? (
            <>
              <p className="text-base">Este destaque está grátis agora. Nada é cobrado.</p>
              <Botao larguraTotal icone={<Gift />} carregando={emCurso === "credito"} textoCarregando="Ativando..." disabled={pendente} onClick={usarCredito}>
                Ativar grátis
              </Botao>
            </>
          ) : podePagar ? (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Forma de pagamento">
                <Chip ativo={forma === "pix"} icone={<QrCode />} onClick={() => setForma("pix")}>
                  Pix
                </Chip>
                <Chip ativo={forma === "cartao"} icone={<CreditCard />} onClick={() => setForma("cartao")}>
                  Cartão
                </Chip>
              </div>
              {pedirDoc && (
                <Campo
                  rotulo="Seu CPF ou CNPJ"
                  name="documento"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={documento}
                  onChange={(e) => {
                    setDocumento(mascaraDocumento(e.target.value));
                    setErroDoc(null);
                  }}
                  erro={erroDoc}
                  dica="O banco pede para gerar o pagamento. O Mercado da Região não guarda esse número."
                />
              )}
              <Botao
                larguraTotal
                icone={forma === "pix" ? <QrCode /> : <CreditCard />}
                carregando={emCurso === "pagar"}
                textoCarregando={forma === "pix" ? "Gerando o Pix..." : "Abrindo o pagamento..."}
                disabled={pendente}
                onClick={() => pagar()}
              >
                {`Pagar ${preco(opcao.preco_centavos)} ${forma === "pix" ? "com Pix" : "no cartão"}`}
              </Botao>
              {opcao.vagas_por_regiao !== null && (
                <p className="text-sm text-texto-suave">Guardamos sua vaga por alguns minutos enquanto você paga.</p>
              )}
            </>
          ) : (
            <p className="text-base text-texto-suave">Pagamento em breve. Por enquanto, só os destaques grátis do seu plano.</p>
          )}

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </section>
      )}

      <p className="flex items-start gap-2 text-sm text-texto-suave">
        <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
        Todo destaque pago aparece com a etiqueta &quot;Patrocinado&quot;, para todo mundo saber.
      </p>
    </div>
  );
}

function CartaoOpcao({
  opcao: o,
  ativo,
  pagamentoLigado,
  onEscolher,
}: {
  opcao: OpcaoDestaque;
  ativo: boolean;
  pagamentoLigado: boolean;
  onEscolher: () => void;
}) {
  const semPagamento = o.disponivel && o.creditos_restantes === 0 && o.preco_centavos > 0 && !pagamentoLigado;
  const bloqueado = !o.disponivel || semPagamento;
  const prazo = o.slug === "subir" ? "Sobe uma vez" : o.dias ? `Por ${o.dias} ${o.dias === 1 ? "dia" : "dias"}` : "";
  const motivo = !o.disponivel ? o.motivo : semPagamento ? "Pagamento em breve." : null;
  return (
    <label
      className={`relative flex min-h-10 cursor-pointer gap-3 rounded-card border-2 p-4 transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro ${
        ativo ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao"
      } ${bloqueado ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <input type="radio" name="tipo-destaque" value={o.slug} checked={ativo} disabled={bloqueado} onChange={onEscolher} className="sr-only" />
      <span
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${ativo ? "border-laranja-escuro bg-laranja-escuro text-white" : "border-borda bg-cartao"}`}
        aria-hidden
      >
        {ativo && <CheckCircle2 className="size-4" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-lg font-semibold leading-6">{o.nome}</span>
          <span className="text-lg font-bold leading-6">{o.creditos_restantes > 0 ? "Grátis" : o.preco_centavos === 0 ? "Grátis" : preco(o.preco_centavos)}</span>
        </span>
        {prazo && <span className="text-sm font-semibold text-texto-suave">{prazo}</span>}
        {o.descricao && <span className="text-base">{o.descricao}</span>}
        {o.creditos_restantes > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-verde-escuro">
            <Gift className="size-4" aria-hidden />
            Você tem {o.creditos_restantes} {o.nome} grátis este mês
          </span>
        )}
        {o.vagas_livres !== null && o.disponivel && (
          <span className="text-sm text-texto-suave">
            {o.vagas_livres === 1 ? "Resta 1 vaga na sua região" : `Restam ${o.vagas_livres} vagas na sua região`}
          </span>
        )}
        {motivo && <span className="text-sm font-semibold text-aviso">{motivo}</span>}
      </span>
    </label>
  );
}

export function PagarPix({ cobranca }: { cobranca: Extract<Cobranca, { forma: "pix" }> }) {
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);
  async function copiar() {
    if (!cobranca.copiaECola) return;
    setErroCopia(false);
    try {
      await navigator.clipboard.writeText(cobranca.copiaECola);
    } catch {
      // celular antigo: seleciona o texto para a pessoa copiar na mão
      const caixa = document.getElementById("pix-copia-e-cola") as HTMLTextAreaElement | null;
      caixa?.select();
      try {
        if (!document.execCommand?.("copy")) { setErroCopia(true); return; }
      } catch { setErroCopia(true); return; }
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 4000);
  }

  if (!cobranca.copiaECola && !cobranca.qrCodeBase64) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base">Toque no botão para ver o Pix na página segura de pagamento.</p>
        {cobranca.link && (
          <Botao href={cobranca.link} target="_blank" rel="noopener noreferrer" larguraTotal icone={<ExternalLink />}>
            Ver o Pix
          </Botao>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <ol className="w-full list-decimal space-y-1 pl-5 text-base">
        <li>Toque em &quot;Copiar código Pix&quot;.</li>
        <li>Abra o app do seu banco e escolha Pix &gt; Copia e cola.</li>
        <li>Cole o código e confirme. A tela muda sozinha.</li>
      </ol>
      {cobranca.qrCodeBase64 && (
        // eslint-disable-next-line @next/next/no-img-element -- QR em base64 vindo do Asaas
        <img
          src={`data:image/png;base64,${cobranca.qrCodeBase64}`}
          alt="QR Code do Pix"
          width={220}
          height={220}
          className="size-56 rounded-card border border-borda bg-white p-2"
        />
      )}
      {cobranca.copiaECola && (
        <>
          <label htmlFor="pix-copia-e-cola" className="sr-only">
            Código Pix copia e cola
          </label>
          <textarea
            id="pix-copia-e-cola"
            readOnly
            value={cobranca.copiaECola}
            rows={3}
            className="w-full resize-none break-all rounded-campo border-2 border-borda bg-fundo p-3 font-mono text-legenda leading-5"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Botao larguraTotal icone={copiado ? <CheckCircle2 /> : <Copy />} onClick={copiar}>
            {copiado ? "Código copiado!" : "Copiar código Pix"}
          </Botao>
          {erroCopia && <p role="status" className="text-sm text-perigo">Não foi possível copiar automaticamente. Selecione e copie o código acima.</p>}
        </>
      )}
    </div>
  );
}
