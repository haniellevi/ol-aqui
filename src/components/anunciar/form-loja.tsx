"use client";

import { linkAssistente } from "@/lib/assistente";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Plus, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CadastroLojaAki } from "@/components/aki/cadastro-loja-aki";
import { Campo } from "@/components/ui/campo";
import { Seletor } from "@/components/conta/seletor";
import { avisoComoVaiAparecer } from "@/lib/formatar-nome";
import { useCampoTelefone } from "@/components/ui/use-campo-telefone";
import { criarLoja, verificarSlug, type EstadoLoja } from "@/app/(conta)/quero-vender/actions";
import { linkLoja, slugDoTitulo, urlAbsoluta } from "@/lib/formato";
import { AvisoErro } from "./aviso-erro";
import { aoEnviar } from "./enviar";

// T15 · Dados da loja: nome, link (com conferência na hora se está livre), WhatsApp e cidade.
// Depois mostra "Sua vitrine: mercadodaregiao.com.br/loja/..." com Compartilhar e "Criar primeiro anúncio".

type Situacao = "vazio" | "conferindo" | "livre" | "ocupado" | "invalido" | "falhou";

const SLUG_OK = /^[a-z0-9-]{3,60}$/;

/** Digitação → endereço válido: minúsculas, sem acento, espaço vira hífen. */
function limparSlug(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
}

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

export function FormLoja({
  cidades,
  cidadeInicial,
  whatsappInicial,
  nomeInicial,
  manterAnuncios,
  avisoTeste,
  assistente,
}: {
  cidades: { nome: string; uf: string }[];
  cidadeInicial: string;
  whatsappInicial: string;
  nomeInicial: string;
  manterAnuncios: boolean;
  /** Ex.: "O teste grátis de 30 dias começa na hora." (null = não mostrar). */
  avisoTeste: string | null;
  assistente?: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoLoja, FormData>(criarLoja, null);
  const [nome, setNome] = useState(nomeInicial);
  const [slug, setSlug] = useState(nomeInicial ? limparSlug(slugDoTitulo(nomeInicial)) : "");
  const [slugEditado, setSlugEditado] = useState(false);
  const [situacao, setSituacao] = useState<Situacao>("vazio");
  const fone = useCampoTelefone(whatsappInicial, { aceitaFixo: true });
  const [cidade, setCidade] = useState(cidadeInicial);
  const [categoria, setCategoria] = useState("");
  const [sobre, setSobre] = useState("");
  const rodada = useRef(0);

  // Confere o endereço 0,4 s depois que a pessoa para de digitar.
  useEffect(() => {
    const minha = ++rodada.current;
    if (!slug) {
      setSituacao("vazio");
      return;
    }
    if (!SLUG_OK.test(slug)) {
      setSituacao("invalido");
      return;
    }
    setSituacao("conferindo");
    const t = setTimeout(async () => {
      try {
        const livre = await verificarSlug(slug);
        if (minha !== rodada.current) return;
        setSituacao(livre === null ? "invalido" : livre ? "livre" : "ocupado");
      } catch {
        if (minha === rodada.current) setSituacao("falhou");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  const feito = estado?.feito;
  if (feito) {
    const url = urlAbsoluta(linkLoja(feito.slug));
    const enderecoCurto = url.replace(/^https?:\/\//, "");
    const compartilhar = `https://wa.me/?text=${encodeURIComponent(`Conheça minha loja no Mercado da Região: *${feito.nome}* ${url}`)}`;
    return (
      <section aria-labelledby="titulo-pronta" className="flex flex-col items-start gap-3 rounded-card border border-borda bg-cartao p-4 sm:p-5" aria-live="polite">
        <span className="grid size-10 place-items-center rounded-campo bg-sucesso-fundo text-verde-escuro" aria-hidden>
          <CheckCircle2 className="size-5" />
        </span>
        <h1 id="titulo-pronta" className="text-titulo font-semibold text-beringela">
          Sua loja foi criada
        </h1>
        <a href={linkLoja(feito.slug)} className="inline-flex min-h-toque items-center break-all text-sm font-semibold text-laranja-escuro underline underline-offset-4">{enderecoCurto}</a>
        <p className="text-sm text-texto-suave">Acompanhe a conferência dos dados, links e contato em Minha loja.</p>
        {feito.teste_expira_em && new Date(feito.teste_expira_em).getTime() > Date.now() && (
          <p className="text-sm text-texto-suave">Teste grátis até {dataCurta.format(new Date(feito.teste_expira_em))}.</p>
        )}
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Botao href={assistente ? linkAssistente("loja", assistente) : "/anunciar"} tamanho="toque" icone={<Plus />}>
            Criar primeiro anúncio
          </Botao>
          <Botao href="/minha-conta/loja/banner" variante="secundario" tamanho="toque">
            Criar banner com a Lia
          </Botao>
          <Botao href={compartilhar} variante="secundario" tamanho="toque" icone={<MessageCircle />} target="_blank" rel="noopener noreferrer">
            Compartilhar no WhatsApp
          </Botao>
        </div>
      </section>
    );
  }

  const erroDe = (campo: string) => estado?.campos?.[campo];
  const sugestao = situacao === "ocupado" ? limparSlug(`${slug}-${slugDoTitulo(cidade)}`) : null;
  const textoSlug: Record<Situacao, { texto: string; cor: string } | null> = {
    vazio: null,
    conferindo: { texto: "Conferindo se está livre...", cor: "text-texto-suave" },
    livre: { texto: "Endereço livre", cor: "text-verde-escuro" },
    ocupado: { texto: "Esse endereço já está em uso. Escolha outro.", cor: "text-perigo" },
    invalido: { texto: "Use de 3 a 60 letras, números ou hífen.", cor: "text-perigo" },
    falhou: { texto: "Não deu para conferir agora. Você pode continuar.", cor: "text-texto-suave" },
  };
  const status = textoSlug[situacao];

  return (
    <form onSubmit={aoEnviar(acao)} className="flex flex-col gap-3" noValidate>
      <header>
        <h1 className="text-titulo leading-tight font-semibold text-beringela">Dados da loja</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {manterAnuncios ? "Seus anúncios continuam no ar." : "Crie uma vitrine com link próprio para divulgar."}
        </p>
      </header>
      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-borda bg-cartao px-3 pb-4 sm:px-4">
        <legend className="ml-1 px-1 text-sm font-semibold text-beringela">Vitrine</legend>
        <Campo
          tamanho="toque"
          rotulo="Nome da loja"
          name="nome_loja"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            if (!slugEditado) setSlug(e.target.value.trim() ? limparSlug(slugDoTitulo(e.target.value)) : "");
          }}
          maxLength={80}
          autoComplete="organization"
          placeholder="Ex.: João Moto Peças"
          erro={erroDe("nome_loja")}
          dica={avisoComoVaiAparecer(nome)}
        />

        <div className="flex flex-col gap-1">
          <Campo
            tamanho="toque"
            rotulo="Link da sua loja"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugEditado(true);
              setSlug(limparSlug(e.target.value));
            }}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            erro={erroDe("slug")}
            dica={
              <>
                Seu link: <strong className="break-all text-texto">{urlAbsoluta(linkLoja(slug || "nome-da-loja"))}</strong>
              </>
            }
          />
          <p className={`flex items-center gap-2 text-sm font-semibold ${status?.cor ?? ""}`} aria-live="polite">
            {situacao === "conferindo" && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
            {situacao === "livre" && <CheckCircle2 className="size-4" aria-hidden />}
            {(situacao === "ocupado" || situacao === "invalido") && <XCircle className="size-4" aria-hidden />}
            {status?.texto}
          </p>
          {sugestao && sugestao !== slug && SLUG_OK.test(sugestao) && (
            <Botao
              variante="secundario"
              tamanho="toque"
              onClick={() => {
                setSlugEditado(true);
                setSlug(sugestao);
              }}
            >
              Usar {sugestao}
            </Botao>
          )}
        </div>
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-borda bg-cartao px-3 pb-4 sm:px-4">
        <legend className="ml-1 px-1 text-sm font-semibold text-beringela">Local e contato</legend>
        <Campo
          tamanho="toque"
          rotulo="WhatsApp da loja"
          name="whatsapp"
          {...fone.campo}
          erro={fone.erro ?? erroDe("whatsapp")}
          dica="Inclua o DDD. Se usar outro número, os clientes verão o WhatsApp confirmado da conta até a equipe conferir o novo."
        />

        {cidades.length ? (
          <Seletor
            tamanho="toque"
            rotulo="Cidade da loja"
            id="campo-cidade"
            name="cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            erro={erroDe("cidade")}
          >
            <option value="">Escolha a cidade</option>
            {cidades.map((c) => (
              <option key={c.nome} value={c.nome}>
                {c.nome} – {c.uf}
              </option>
            ))}
          </Seletor>
        ) : (
          <Campo tamanho="toque" rotulo="Cidade da loja" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} erro={erroDe("cidade")} />
        )}
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-borda bg-cartao px-3 pb-4 sm:px-4">
        <legend className="ml-1 px-1 text-sm font-semibold text-beringela">Sobre a loja</legend>
        <CadastroLojaAki nome={nome} aplicar={(dados) => {
          setCategoria(dados.categoria);
          setSobre(dados.descricao);
        }} />
        <Campo tamanho="toque" rotulo="Categoria da loja" name="categoria_loja" maxLength={80} opcional
          value={categoria} onChange={(e) => setCategoria(e.target.value)} erro={erroDe("categoria_loja")} />
        <Campo multilinha rotulo="Descrição da loja" name="sobre" rows={4} maxLength={1500} opcional
          value={sobre} onChange={(e) => setSobre(e.target.value)} erro={erroDe("sobre")} />
      </fieldset>
      {avisoTeste && <p className="rounded-campo bg-selecao px-3 py-2 text-sm text-beringela">{avisoTeste}</p>}

      <Botao type="submit" tamanho="toque" className="w-full" carregando={enviando} textoCarregando="Criando sua loja..." disabled={situacao === "ocupado"}>
        Criar minha loja
      </Botao>
    </form>
  );
}
