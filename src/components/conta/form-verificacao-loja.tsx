"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { Alert } from "@/components/ui/alert";
import { mascaraDocumento } from "@/lib/cpf-cnpj";
import { LINK_VERIFICACAO_VENDEDOR } from "@/lib/verificacao-vendedor";
import {
  ACEITA_ARQUIVO,
  AVISO_IA,
  NOMES_PASSOS,
  PERGUNTAS,
  TOTAL_PASSOS,
  criarTrava,
  enviarVerificacaoLoja,
  erroArquivo,
  erroDoPasso,
  podeEnviar,
  resumo,
  type DadosVerificacaoLoja,
  type NumeroPasso,
} from "./passos-verificacao-loja";

type CampoArquivoLoja = "comprovante" | "fachada";

// Uma pergunta por tela (Modo fácil, docs/designs/verificacao-lojas-checklist-ui.md).
export function FormVerificacaoLoja() {
  const router = useRouter();
  const pergunta = useRef<HTMLHeadingElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const trocouPasso = useRef(false);
  const chegouNoPasso4 = useRef<number | null>(null);
  const trava = useRef(criarTrava());
  const [passo, setPasso] = useState<NumeroPasso>(1);
  const [dados, setDados] = useState<DadosVerificacaoLoja>({ cnpj: "", comprovante: null, fachada: null });
  const [semCnpj, setSemCnpj] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Ao trocar de passo, o foco vai para a pergunta (o leitor de tela lê a tela nova).
  useEffect(() => {
    if (!trocouPasso.current) return;
    trocouPasso.current = false;
    pergunta.current?.focus();
  }, [passo]);

  // Com erro, o foco vai para o campo com problema ou para o aviso.
  useEffect(() => {
    if (!erro) return;
    const alvo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    alvo?.focus();
  }, [erro]);

  function irPara(n: NumeroPasso) {
    trocouPasso.current = true;
    chegouNoPasso4.current = n === TOTAL_PASSOS ? Date.now() : null;
    setErro(null);
    setPasso(n);
  }

  function continuar() {
    const invalido = erroDoPasso(passo, dados);
    if (invalido) return setErro(invalido);
    irPara((passo + 1) as NumeroPasso);
  }

  async function enviar() {
    if (enviando || enviado || !podeEnviar(chegouNoPasso4.current, Date.now())) return;
    setErro(null);
    const invalido = erroDoPasso(4, dados);
    if (invalido) {
      // Algo mudou para inválido: volta ao passo certo.
      const ruim = ([1, 2, 3] as const).find((n) => erroDoPasso(n, dados));
      if (ruim) irPara(ruim);
      return setErro(invalido);
    }
    setEnviando(true);
    try {
      const r = await enviarVerificacaoLoja(dados, trava.current);
      if (r.tipo === "ignorado") return;
      if (r.tipo === "erro") {
        setErro(r.mensagem);
        if (r.atualizar) router.refresh();
        return;
      }
      setEnviado(true);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  function aoEnviarFormulario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passo < TOTAL_PASSOS) continuar();
    else void enviar();
  }

  function escolher(campo: CampoArquivoLoja, arquivo: File) {
    const problema = erroArquivo(arquivo);
    if (problema) return setErro(problema);
    setErro(null);
    setDados((d) => ({ ...d, [campo]: arquivo }));
  }

  return (
    <form ref={formulario} onSubmit={aoEnviarFormulario} noValidate>
      <fieldset disabled={enviando || enviado} className="flex min-w-0 flex-col gap-6">
        <IndicadorPasso passo={passo} />
        <h2 ref={pergunta} tabIndex={-1} className="text-3xl font-semibold text-beringela outline-none">
          {PERGUNTAS[passo]}
        </h2>

        <PassoVerificacaoLoja
          passo={passo}
          dados={dados}
          erro={erro}
          semCnpj={semCnpj}
          aoMudar={(cnpj) => setDados((d) => ({ ...d, cnpj }))}
          aoEscolher={escolher}
          aoRemover={(campo) => setDados((d) => ({ ...d, [campo]: null }))}
          aoAlternarSemCnpj={() => setSemCnpj((v) => !v)}
          irPara={irPara}
        />

        {passo === TOTAL_PASSOS && erro && (
          <Alert variant="destructive" role="alert" tabIndex={-1} className="text-facil">
            {erro}
          </Alert>
        )}
        {enviado && <p role="status" className="text-facil font-semibold text-verde-escuro">Documentos enviados para conferência.</p>}

        <div className={`grid gap-3 ${passo > 1 ? "grid-cols-[auto_1fr]" : "grid-cols-1"}`}>
          {passo > 1 && (
            <Botao variante="secundario" icone={<ArrowLeft />} onClick={() => irPara((passo - 1) as NumeroPasso)} tamanho="grande">
              Voltar
            </Botao>
          )}
          {passo < TOTAL_PASSOS ? (
            <Botao key="continuar" type="submit" icone={<ArrowRight />} tamanho="grande" className="w-full">
              Continuar
            </Botao>
          ) : (
            <Botao key="enviar" type="submit" carregando={enviando} textoCarregando="Enviando..." disabled={enviado} icone={<Send />} tamanho="grande" className="w-full">
              Enviar para conferência
            </Botao>
          )}
        </div>
      </fieldset>
    </form>
  );
}

type PropsPasso = {
  passo: NumeroPasso;
  dados: DadosVerificacaoLoja;
  /** Mensagem de erro do passo atual (aparece embaixo do campo). */
  erro: string | null;
  semCnpj: boolean;
  aoMudar: (cnpj: string) => void;
  aoEscolher: (campo: CampoArquivoLoja, arquivo: File) => void;
  aoRemover: (campo: CampoArquivoLoja) => void;
  aoAlternarSemCnpj: () => void;
  irPara: (n: NumeroPasso) => void;
};

/** O conteúdo de cada passo, sem estado próprio (serve também para os testes). */
export function PassoVerificacaoLoja({ passo, dados, erro, semCnpj, aoMudar, aoEscolher, aoRemover, aoAlternarSemCnpj, irPara }: PropsPasso) {
  if (passo === 1) {
    return (
      <div className="flex flex-col gap-4">
        <Campo
          tamanho="grande"
          rotulo="CNPJ da loja"
          name="cnpj"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="00.000.000/0000-00"
          value={mascaraDocumento(dados.cnpj)}
          onChange={(e) => aoMudar(e.target.value)}
          erro={erro}
          dica="Digite só os números. Os pontos e a barra entram sozinhos."
        />
        <Botao variante="texto" tamanho="grande" className="w-fit" aria-expanded={semCnpj} onClick={aoAlternarSemCnpj}>
          Não tenho CNPJ
        </Botao>
        {semCnpj && (
          <div className="flex flex-col gap-3 rounded-card bg-cartao p-4 text-facil shadow-1">
            <p>O selo de loja pede CNPJ. Quem vende como pessoa física tem a própria verificação.</p>
            <Botao href={LINK_VERIFICACAO_VENDEDOR} variante="secundario" tamanho="grande" larguraTotal>
              Verificar como pessoa física
            </Botao>
          </div>
        )}
      </div>
    );
  }

  if (passo === 2) {
    return (
      <CampoArquivo
        tamanho="grande"
        rotulo="Comprovante de endereço"
        name="comprovante"
        accept={ACEITA_ARQUIVO}
        required
        textoBotao="Escolher comprovante"
        textoTrocar="Trocar comprovante"
        textoRemover="Tirar comprovante"
        nome={dados.comprovante?.name ?? null}
        onEscolher={(a) => aoEscolher("comprovante", a)}
        onRemover={() => aoRemover("comprovante")}
        erro={erro}
        dica="Conta de luz, água ou internet, no nome da empresa ou de um sócio. PDF, JPG ou PNG, até 2 MB."
      />
    );
  }

  if (passo === 3) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-facil text-texto-suave">Esse passo é opcional.</p>
        <CampoArquivo
          tamanho="grande"
          rotulo="Foto da frente da loja"
          name="fachada"
          accept={ACEITA_ARQUIVO}
          textoBotao="Escolher foto"
          textoTrocar="Trocar foto"
          textoRemover="Tirar foto"
          nome={dados.fachada?.name ?? null}
          onEscolher={(a) => aoEscolher("fachada", a)}
          onRemover={() => aoRemover("fachada")}
          erro={erro}
          dica="Uma foto em que se vê a fachada e o nome da loja. PDF, JPG ou PNG, até 2 MB."
        />
        <Botao variante="secundario" tamanho="grande" className="w-fit" onClick={() => { aoRemover("fachada"); irPara(4); }}>
          Pular
        </Botao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="titulo-resumo" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h3 id="titulo-resumo" className="text-facil font-bold text-beringela">Sua verificação</h3>
        <dl className="flex flex-col gap-3 text-facil">
          {resumo(dados).map((l) => (
            <div key={l.rotulo} className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <dt className="text-texto-suave">{l.rotulo}</dt>
                <dd className="font-semibold break-words text-texto">{l.valor || "—"}</dd>
              </div>
              <Botao variante="texto" tamanho="grande" onClick={() => irPara(l.passo)}>
                Alterar<span className="sr-only"> {l.rotulo.toLowerCase()}</span>
              </Botao>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-facil text-texto">{AVISO_IA}</p>
    </div>
  );
}

/** "Passo N de 4 · Nome" com as barrinhas, como o assistente do Radar. */
function IndicadorPasso({ passo }: { passo: NumeroPasso }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-facil font-semibold text-texto-suave">
        Passo {passo} de {TOTAL_PASSOS} · {NOMES_PASSOS[passo - 1]}
      </p>
      <ol className="flex gap-1" aria-hidden>
        {NOMES_PASSOS.map((nome, i) => (
          <li key={nome} className={`h-1.5 flex-1 rounded-full ${i < passo ? "bg-laranja" : "bg-borda"}`} />
        ))}
      </ol>
    </div>
  );
}
