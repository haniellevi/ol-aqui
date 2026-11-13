"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Hourglass, Megaphone, MessageCircle } from "lucide-react";
import { Campo } from "@/components/ui/campo";
import { Seletor } from "@/components/conta/seletor";
import { Chip } from "@/components/ui/chip";
import { Botao } from "@/components/ui/botao";
import { Alert } from "@/components/ui/alert";
import { criarPedido } from "@/app/radar/actions";
import { parecidosParaPedido, perguntasParaPedido } from "@/app/radar/ia-actions";
import type { ParecidoIA, PerguntaIA } from "@/lib/radar-ia/tipos";
import { linkMeuPedidoRadar } from "@/lib/rotas";
import { centavosDoTexto } from "@/lib/formato";
import { useCampoTelefone } from "@/components/ui/use-campo-telefone";
import type { ModoContato, RegrasRadar, Visibilidade } from "@/lib/tipos-radar";
import type { EntradaPedido } from "./validacao";
import { dataHoraCurta, FOCO_LINK, faixaPreco, rotuloPrazo } from "./util";
import {
  NOMES_PASSOS_PEDIDO,
  TEXTO_VISIBILIDADE,
  TOTAL_PASSOS_PEDIDO,
  cidadesParaEnvio,
  erroDoPasso,
  juntarFala,
  passoDoCampo,
  podePublicar,
  textoArea,
  type NumeroPasso,
} from "./passos-pedido";
import { BotaoFalar } from "./botao-falar";
import { EscolherArea } from "./escolher-area";
import { EscolherVisibilidade } from "./escolher-visibilidade";
import { CartaoEscolha } from "./cartao-escolha";
import { PerguntasIA } from "./ia/perguntas-ia";
import { ParecidosIA } from "./ia/parecidos-ia";
import { juntarResposta, proximaEtapaIA, respostaAindaVale, type EtapaIA } from "./ia/fluxo-ia";

type Props = {
  textoInicial: string;
  categoriaInicial?: string | null;
  precoMinInicial?: string;
  precoMaxInicial?: string;
  /** "Pedir de novo": detalhes e quem vê do pedido antigo. */
  detalhesInicial?: string;
  visibilidadeInicial?: Visibilidade;
  categorias: { id: string; nome: string; filhas: { id: string; nome: string }[] }[];
  /** Cidades ativas da região do cadastro. */
  cidades: { id: string; nome: string }[];
  /** Cidades já marcadas (ex.: a cidade da busca). Vazio = toda a região. */
  cidadesIniciais?: string[];
  regras: RegrasRadar;
  /** Celular ainda não confirmado e o painel não exige o código: pede o WhatsApp aqui. */
  pedirWhatsapp?: boolean;
  whatsappInicial?: string;
};

// Uma pergunta por tela (Modo fácil, docs/designs/radar-v2.md).
const PERGUNTAS: Record<NumeroPasso, string> = {
  1: "O que você está procurando?",
  2: "Onde?",
  3: "Quem pode ver?",
  4: "Como as lojas falam com você?",
};

// Erros que aparecem embaixo do próprio campo; o resto vai para o aviso geral.
const CAMPOS_COM_ERRO = ["titulo", "detalhes", "categoria", "preco", "preco_min_centavos", "preco_max_centavos", "cidade", "cidades", "visibilidade", "prazo", "whatsapp"];
const TITULO_PARECIDOS = "Achamos isso na região. Quer ver?";
const ROTULO_GRUPO = "text-facil font-semibold text-texto";
const TEXTO_ERRO = "text-facil font-semibold text-perigo";

export function FormPedido({ textoInicial, categoriaInicial = null, precoMinInicial = "", precoMaxInicial = "", detalhesInicial = "", visibilidadeInicial = "lojas", categorias, cidades, cidadesIniciais = [], regras, pedirWhatsapp = false, whatsappInicial = "" }: Props) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const pergunta = useRef<HTMLHeadingElement>(null);
  const trocouPasso = useRef(false);
  /** Quando o passo 4 apareceu: o toque duplo em "Continuar" não pode publicar sem a pessoa ver o resumo. */
  const chegouNoPasso4 = useRef<number | null>(null);
  const trava = useRef(false);
  const chaveEnvio = useRef<string | null>(null);
  const [passo, setPasso] = useState<NumeroPasso>(1);
  const [titulo, setTitulo] = useState(textoInicial);
  const [detalhes, setDetalhes] = useState(detalhesInicial.slice(0, 1000));
  const [categoriaId, setCategoriaId] = useState<string | null>(categoriaInicial);
  const [precoMin, setPrecoMin] = useState(precoMinInicial);
  const [precoMax, setPrecoMax] = useState(precoMaxInicial);
  const [area, setArea] = useState<string[]>(cidadesIniciais);
  const [visibilidade, setVisibilidade] = useState<Visibilidade>(visibilidadeInicial);
  const whatsapp = useCampoTelefone(whatsappInicial, { obrigatorio: pedirWhatsapp });
  const [modo, setModo] = useState<ModoContato>("whatsapp_direto");
  const [prazo, setPrazo] = useState<number | null>(regras.prazosHoras[1] ?? regras.prazosHoras[0] ?? null);
  const [erro, setErro] = useState<{ texto: string; campo?: string; celular?: boolean } | null>(null);
  const [enviando, iniciar] = useTransition();
  // IA do Radar (fase 3): perguntas para pedido vago e anúncios parecidos, entre o passo 1 e o 2.
  // Sem IA (desligada, teto, demora, erro) as ações devolvem null e o pedido segue direto para "Onde?".
  const [etapaIA, setEtapaIA] = useState<EtapaIA>(null);
  const [perguntasIA, setPerguntasIA] = useState<PerguntaIA[]>([]);
  const [parecidosIA, setParecidosIA] = useState<ParecidoIA[]>([]);
  const [pensando, setPensando] = useState(false);
  const pedidoIA = useRef(0);
  const tituloComIA = useRef<string | null>(null);
  // A data final depende da hora do aparelho: calculada só no navegador (evita diferença com o servidor).
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => setAgora(Date.now()), []);

  const temPrazos = regras.prazosHoras.length > 0;
  const fimPrazo = agora && prazo ? dataHoraCurta(new Date(agora + prazo * 3600_000)) : null;
  const idsValidos = cidades.map((c) => c.id);

  // Ao trocar de passo, o foco vai para a pergunta (leitor de tela lê a tela nova).
  useEffect(() => {
    if (!trocouPasso.current) return;
    trocouPasso.current = false;
    pergunta.current?.focus();
  }, [passo, etapaIA]);

  // Com erro, o foco vai para o campo do erro (ou para o aviso).
  useEffect(() => {
    if (!erro) return;
    const campos: Record<string, string> = { preco_min_centavos: "preco_min", preco_max_centavos: "preco_max", preco: "preco_max" };
    const nome = campos[erro.campo ?? ""] ?? erro.campo;
    const alvo = nome ? formulario.current?.elements.namedItem(nome) : null;
    if (alvo instanceof HTMLElement) alvo.focus();
    else formulario.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [erro]);

  function irPara(n: NumeroPasso) {
    trocouPasso.current = true;
    chegouNoPasso4.current = n === TOTAL_PASSOS_PEDIDO ? Date.now() : null;
    setPasso(n);
  }

  function entrada(): EntradaPedido {
    return {
      chaveEnvio: (chaveEnvio.current ??= crypto.randomUUID()),
      titulo,
      detalhes,
      categoriaId,
      precoMin,
      precoMax,
      cidadesIds: cidadesParaEnvio(area),
      visibilidade,
      modo,
      prazoHoras: prazo,
      whatsapp: pedirWhatsapp ? whatsapp.campo.value : undefined,
    };
  }

  function mostrarErro(texto: string, campo?: string, celular?: boolean) {
    const destino = campo && CAMPOS_COM_ERRO.includes(campo) ? passoDoCampo(campo) : passo;
    if (destino !== passo) {
      chegouNoPasso4.current = null;
      setPasso(destino);
    }
    setErro({ texto, campo, celular });
  }

  function continuar() {
    setErro(null);
    const invalida = erroDoPasso(passo, entrada(), idsValidos);
    if (invalida) return mostrarErro(invalida.erro, invalida.campo);
    if (passo === 1) return perguntarIA();
    if (passo < TOTAL_PASSOS_PEDIDO) irPara((passo + 1) as NumeroPasso);
  }

  /** Depois do passo 1: a IA olha o pedido uma vez por título (voltar e continuar de novo não gasta outra vez). */
  function perguntarIA() {
    if (pensando) return;
    const t = titulo.trim();
    if (tituloComIA.current === t) return irPara(2);
    const n = ++pedidoIA.current;
    setPensando(true);
    const seguro = <T,>(p: Promise<T | null>) => p.catch(() => null);
    Promise.all([seguro(perguntasParaPedido(titulo, detalhes)), seguro(parecidosParaPedido(titulo, detalhes))]).then(([p, a]) => {
      if (!respostaAindaVale(n, pedidoIA.current)) return;
      setPensando(false);
      tituloComIA.current = t;
      const perguntas = p ?? [];
      const parecidos = a ?? [];
      setPerguntasIA(perguntas);
      setParecidosIA(parecidos);
      const proxima = proximaEtapaIA(null, perguntas, parecidos);
      if (proxima) {
        trocouPasso.current = true;
        setEtapaIA(proxima);
      } else irPara(2);
    });
  }

  function avancarIA() {
    const proxima = proximaEtapaIA(etapaIA, perguntasIA, parecidosIA);
    trocouPasso.current = true;
    if (proxima) return setEtapaIA(proxima);
    setEtapaIA(null);
    irPara(2);
  }

  function responderIA(opcao: string) {
    if (etapaIA?.tipo !== "pergunta") return;
    const p = perguntasIA[etapaIA.indice];
    if (p) setDetalhes((d) => juntarResposta(d, p.rotulo, opcao));
    avancarIA();
  }

  function voltar() {
    setErro(null);
    if (etapaIA) {
      trocouPasso.current = true;
      setEtapaIA(null);
      return;
    }
    if (passo > 1) irPara((passo - 1) as NumeroPasso);
  }

  function enviar() {
    if (trava.current || !podePublicar(chegouNoPasso4.current, Date.now())) return;
    setErro(null);
    const dados = entrada();
    const invalida = erroDoPasso(4, dados, idsValidos);
    if (invalida) return mostrarErro(invalida.erro, invalida.campo);
    if (modo === "propostas_prazo" && !regras.prazosHoras.includes(prazo ?? 0)) return mostrarErro("Escolha um prazo da lista.", "prazo");
    if (pedirWhatsapp && !whatsapp.valido) return mostrarErro("Digite seu WhatsApp com DDD, por exemplo (89) 99999-0000.", "whatsapp");
    trava.current = true;
    iniciar(async () => {
      try {
        const r = await criarPedido(dados);
        if (!r.ok) {
          mostrarErro(r.erro, r.campo, r.precisaCelular);
          return;
        }
        router.push(`${linkMeuPedidoRadar(r.id)}?novo=1`);
      } catch {
        setErro({ texto: "Não conseguimos confirmar o envio. Seus dados continuam aqui; tente novamente." });
      } finally {
        trava.current = false;
      }
    });
  }

  function aoEnviarFormulario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (etapaIA) return;
    if (passo < TOTAL_PASSOS_PEDIDO) continuar();
    else enviar();
  }

  const erroDe = (...campos: string[]) => (erro && campos.includes(erro.campo ?? "") ? erro.texto : null);
  const erroGeral = erro && !CAMPOS_COM_ERRO.includes(erro.campo ?? "") ? erro : null;
  const precoTexto = faixaPreco(centavosDoTexto(precoMin), centavosDoTexto(precoMax));

  return (
    <form ref={formulario} onSubmit={aoEnviarFormulario} noValidate>
      <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-6">
        <IndicadorPasso passo={passo} />
        <h2 ref={pergunta} id="pergunta-passo" tabIndex={-1} className="text-3xl font-semibold text-beringela outline-none">
          {etapaIA?.tipo === "pergunta" ? perguntasIA[etapaIA.indice]?.pergunta : etapaIA?.tipo === "parecidos" ? TITULO_PARECIDOS : PERGUNTAS[passo]}
        </h2>

        {etapaIA?.tipo === "pergunta" && perguntasIA[etapaIA.indice] && (
          <PerguntasIA pergunta={perguntasIA[etapaIA.indice]} onResponder={responderIA} onPular={avancarIA} />
        )}
        {etapaIA?.tipo === "parecidos" && <ParecidosIA parecidos={parecidosIA} onContinuar={avancarIA} />}

        {passo === 1 && !etapaIA && (
          <div className="flex flex-col gap-6">
            <Campo
              tamanho="grande"
              rotulo="Em poucas palavras"
              name="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Geladeira frost free usada"
              erro={erroDe("titulo")}
              autoComplete="off"
            />
            <BotaoFalar
              onTexto={(fala) => {
                const r = juntarFala(titulo, detalhes, fala);
                setTitulo(r.titulo);
                setDetalhes(r.detalhes);
              }}
            />
            <Campo
              tamanho="grande"
              rotulo="Detalhes"
              name="detalhes"
              multilinha
              opcional
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              maxLength={1000}
              placeholder="Cor, tamanho, marca, se aceita usado..."
              erro={erroDe("detalhes")}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className={`${ROTULO_GRUPO} mb-2`}>
                Quanto quer pagar? <span className="font-normal text-texto-suave">(opcional)</span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <Campo tamanho="grande" rotulo="De" name="preco_min" prefixo="R$" inputMode="decimal" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="0" erro={erroDe("preco_min_centavos")} />
                <Campo tamanho="grande" rotulo="Até" name="preco_max" prefixo="R$" inputMode="decimal" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="0" erro={erroDe("preco_max_centavos", "preco")} />
              </div>
            </fieldset>
            {categorias.length > 0 && (
              <Seletor
                tamanho="grande"
                rotulo="Categoria (opcional)"
                name="categoria"
                value={categoriaId ?? ""}
                onChange={(e) => setCategoriaId(e.target.value || null)}
                erro={erroDe("categoria")}
                dica="Escolha a opção mais específica para ajudar vendedores da área a encontrar seu pedido."
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <optgroup key={c.id} label={c.nome}>
                    <option value={c.id}>{c.nome}{c.filhas.length ? " (geral)" : ""}</option>
                    {c.filhas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </optgroup>
                ))}
              </Seletor>
            )}
          </div>
        )}

        {passo === 2 && (
          <div role="radiogroup" aria-labelledby="pergunta-passo" className="flex flex-col gap-2">
            <EscolherArea cidades={cidades} valor={area} onChange={setArea} />
            {erroDe("cidades", "cidade") && <p role="alert" tabIndex={-1} className={TEXTO_ERRO}>{erroDe("cidades", "cidade")}</p>}
          </div>
        )}

        {passo === 3 && (
          <div role="radiogroup" aria-labelledby="pergunta-passo" className="flex flex-col gap-2">
            <EscolherVisibilidade valor={visibilidade} onChange={setVisibilidade} />
            {erroDe("visibilidade") && <p role="alert" tabIndex={-1} className={TEXTO_ERRO}>{erroDe("visibilidade")}</p>}
          </div>
        )}

        {passo === 4 && (
          <div className="flex flex-col gap-6">
            <div role="radiogroup" aria-labelledby="pergunta-passo" className="flex flex-col gap-3">
              <CartaoEscolha
                nome="modo"
                valor="whatsapp_direto"
                marcado={modo === "whatsapp_direto"}
                onEscolher={() => setModo("whatsapp_direto")}
                icone={<MessageCircle />}
                titulo="Podem me chamar no WhatsApp"
                ajuda="As lojas mandam mensagem direto para o seu celular."
              />
              {temPrazos && (
                <CartaoEscolha
                  nome="modo"
                  valor="propostas_prazo"
                  marcado={modo === "propostas_prazo"}
                  onEscolher={() => setModo("propostas_prazo")}
                  icone={<Hourglass />}
                  titulo={`Quero receber propostas aqui${fimPrazo && prazo ? ` até ${fimPrazo}` : ""}`}
                  ajuda="Você compara preço e foto e só chama quem quiser. Seu número fica escondido."
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-facil font-semibold text-beringela">Receber propostas por</span>
                    <div role="group" aria-label="Receber propostas por" className="flex flex-wrap gap-2">
                      {regras.prazosHoras.map((h) => (
                        <Chip key={h} ativo={prazo === h} onClick={() => setPrazo(h)} tamanho="grande">
                          {rotuloPrazo(h)}
                        </Chip>
                      ))}
                    </div>
                    {erroDe("prazo") && <p role="alert" tabIndex={-1} className={TEXTO_ERRO}>{erroDe("prazo")}</p>}
                  </div>
                </CartaoEscolha>
              )}
            </div>

            {pedirWhatsapp && (
              <Campo
              tamanho="grande"
                rotulo="Seu WhatsApp"
                name="whatsapp"
                {...whatsapp.campo}
                erro={whatsapp.erro ?? erroDe("whatsapp")}
                dica={modo === "whatsapp_direto" ? "Com DDD. As lojas que enviarem uma proposta poderão ver este número." : "Com DDD. Seu número fica oculto; você escolhe com qual loja conversar."}
              />
            )}

            <section aria-labelledby="titulo-resumo" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
              <h3 id="titulo-resumo" className="text-facil font-bold text-beringela">Seu pedido</h3>
              <dl className="flex flex-col gap-3 text-facil">
                <LinhaResumo rotulo="O que" valor={titulo.trim()} passo={1} irPara={irPara} />
                <LinhaResumo rotulo="Quanto" valor={precoTexto} passo={1} irPara={irPara} />
                <LinhaResumo rotulo="Onde" valor={textoArea(area, cidades)} passo={2} irPara={irPara} />
                <LinhaResumo rotulo="Quem vê" valor={TEXTO_VISIBILIDADE[visibilidade].titulo} passo={3} irPara={irPara} />
              </dl>
            </section>
          </div>
        )}

        {erroGeral && (
          <Alert variant="destructive" role="alert" tabIndex={-1} className="flex flex-col gap-2 text-facil">
            <span>{erroGeral.texto}</span>
            {erroGeral.celular && (
              <Link href="/confirmar-celular?destino=%2Fradar%2Fpedir" className={`min-h-12 content-center underline underline-offset-4 ${FOCO_LINK}`}>
                Confirmar meu celular
              </Link>
            )}
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <div className={`grid gap-3 ${passo > 1 && !etapaIA ? "grid-cols-[auto_1fr]" : "grid-cols-1"}`}>
            {(passo > 1 || etapaIA) && (
              <Botao variante="secundario" icone={<ArrowLeft />} onClick={voltar} tamanho="grande">
                Voltar
              </Botao>
            )}
            {etapaIA ? null : passo < TOTAL_PASSOS_PEDIDO ? (
              <Botao key="continuar" type="submit" icone={<ArrowRight />} tamanho="grande" className="w-full" carregando={pensando} textoCarregando="Um momento...">
                Continuar
              </Botao>
            ) : (
              <Botao key="publicar" type="submit" carregando={enviando} textoCarregando="Publicando..." icone={<Megaphone />} tamanho="grande" className="w-full">
                Publicar pedido
              </Botao>
            )}
          </div>
          {passo === TOTAL_PASSOS_PEDIDO && regras.pedidosAbertosMax != null && (
            <p className="text-center text-facil text-texto-suave">Você pode ter até {regras.pedidosAbertosMax} pedidos no ar ao mesmo tempo.</p>
          )}
        </div>
      </fieldset>
    </form>
  );
}

/** "Passo N de 4 · Nome" com as barrinhas, como no assistente do anúncio (cabecalho-passo.tsx). */
function IndicadorPasso({ passo }: { passo: NumeroPasso }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-facil font-semibold text-texto-suave">
        Passo {passo} de {TOTAL_PASSOS_PEDIDO} · {NOMES_PASSOS_PEDIDO[passo - 1]}
      </p>
      <ol className="flex gap-1" aria-hidden>
        {NOMES_PASSOS_PEDIDO.map((nome, i) => (
          <li key={nome} className={`h-1.5 flex-1 rounded-full ${i < passo ? "bg-laranja" : "bg-borda"}`} />
        ))}
      </ol>
    </div>
  );
}

function LinhaResumo({ rotulo, valor, passo, irPara }: { rotulo: string; valor: string; passo: NumeroPasso; irPara: (n: NumeroPasso) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <dt className="text-texto-suave">{rotulo}</dt>
        <dd className="font-semibold break-words text-texto">{valor || "—"}</dd>
      </div>
      <Botao variante="texto" onClick={() => irPara(passo)} tamanho="grande">
        Alterar<span className="sr-only"> {rotulo.toLowerCase()}</span>
      </Botao>
    </div>
  );
}
