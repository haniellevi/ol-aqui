"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, MessageCircle, Plus, Store, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { criarLoja, verificarSlug, type EstadoLoja } from "@/app/(conta)/quero-vender/actions";
import { linkLoja, slugDoTitulo, urlAbsoluta } from "@/lib/formato";
import { AvisoErro } from "./aviso-erro";
import { aoEnviar } from "./enviar";

// T15 · Dados da loja: nome, link (com conferência na hora se está livre), WhatsApp e cidade.
// Depois mostra "Sua vitrine: olaki.com.br/loja/..." com Compartilhar e "Criar primeiro anúncio".

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

/** "89999990000" → "(89) 99999-0000" enquanto digita. */
function mascaraFone(t: string): string {
  let d = t.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

export function FormLoja({
  cidades,
  cidadeInicial,
  whatsappInicial,
  nomeInicial,
  avisoTeste,
}: {
  cidades: { nome: string; uf: string }[];
  cidadeInicial: string;
  whatsappInicial: string;
  nomeInicial: string;
  /** Ex.: "O teste grátis de 30 dias começa na hora." (null = não mostrar). */
  avisoTeste: string | null;
}) {
  const [estado, acao, enviando] = useActionState<EstadoLoja, FormData>(criarLoja, null);
  const [nome, setNome] = useState(nomeInicial);
  const [slug, setSlug] = useState(nomeInicial ? limparSlug(slugDoTitulo(nomeInicial)) : "");
  const [slugEditado, setSlugEditado] = useState(false);
  const [situacao, setSituacao] = useState<Situacao>("vazio");
  const [fone, setFone] = useState(mascaraFone(whatsappInicial));
  const [cidade, setCidade] = useState(cidadeInicial);
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
    const compartilhar = `https://wa.me/?text=${encodeURIComponent(`Conheça minha loja no OLAKI: *${feito.nome}* ${url}`)}`;
    return (
      <section aria-labelledby="titulo-pronta" className="flex flex-col items-center gap-4 text-center" aria-live="polite">
        <span className="grid size-20 place-items-center rounded-full bg-laranja-claro text-verde-escuro" aria-hidden>
          <CheckCircle2 className="size-12" />
        </span>
        <h1 id="titulo-pronta" className="text-2xl font-semibold">
          Sua loja está pronta!
        </h1>
        <p className="text-base">
          Sua vitrine: <strong className="break-all">{enderecoCurto}</strong>
        </p>
        {feito.teste_expira_em && new Date(feito.teste_expira_em).getTime() > Date.now() && (
          <p className="text-base text-texto-suave">Teste grátis até {dataCurta.format(new Date(feito.teste_expira_em))}.</p>
        )}
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Botao href="/anunciar" larguraTotal icone={<Plus />}>
            Criar primeiro anúncio
          </Botao>
          <Botao href={compartilhar} variante="whatsapp" larguraTotal icone={<MessageCircle />} target="_blank" rel="noopener noreferrer">
            Compartilhar no WhatsApp
          </Botao>
          <Botao href={linkLoja(feito.slug)} variante="secundario" larguraTotal icone={<Store />}>
            Ver minha vitrine
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
    livre: { texto: "Endereço livre!", cor: "text-verde-escuro" },
    ocupado: { texto: "Esse endereço já está em uso. Escolha outro.", cor: "text-perigo" },
    invalido: { texto: "Use de 3 a 60 letras, números ou hífen.", cor: "text-perigo" },
    falhou: { texto: "Não deu para conferir agora. Você pode continuar.", cor: "text-texto-suave" },
  };
  const status = textoSlug[situacao];

  return (
    <form onSubmit={aoEnviar(acao)} className="flex flex-col gap-5" noValidate>
      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <Campo
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
      />

      <div className="flex flex-col gap-1.5">
        <Campo
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
              Seu link: <strong className="break-all text-texto">olaki.com.br/loja/{slug || "nome-da-loja"}</strong>
            </>
          }
        />
        <p className={`flex min-h-6 items-center gap-1.5 text-sm font-semibold ${status?.cor ?? ""}`} aria-live="polite">
          {situacao === "conferindo" && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          {situacao === "livre" && <CheckCircle2 className="size-4" aria-hidden />}
          {(situacao === "ocupado" || situacao === "invalido") && <XCircle className="size-4" aria-hidden />}
          {status?.texto}
        </p>
        {sugestao && sugestao !== slug && SLUG_OK.test(sugestao) && (
          <Botao
            variante="secundario"
            onClick={() => {
              setSlugEditado(true);
              setSlug(sugestao);
            }}
          >
            Usar {sugestao}
          </Botao>
        )}
      </div>

      <Campo
        rotulo="WhatsApp da loja"
        name="whatsapp"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={fone}
        onChange={(e) => setFone(mascaraFone(e.target.value))}
        placeholder="(89) 99999-0000"
        erro={erroDe("whatsapp")}
        dica="É nele que os clientes vão chamar. Com DDD."
      />

      {cidades.length ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-cidade" className="text-base font-semibold">
            Cidade da loja
          </label>
          <div className="relative">
            <select
              id="campo-cidade"
              name="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              aria-invalid={erroDe("cidade") ? true : undefined}
              aria-describedby={erroDe("cidade") ? "campo-cidade-erro" : undefined}
              className={`h-12 w-full appearance-none rounded-campo border-2 bg-cartao pl-3 pr-10 text-base focus:outline-none focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30 ${erroDe("cidade") ? "border-perigo" : "border-borda"}`}
            >
              <option value="">Escolha a cidade</option>
              {cidades.map((c) => (
                <option key={c.nome} value={c.nome}>
                  {c.nome} – {c.uf}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          </div>
          {erroDe("cidade") && (
            <p id="campo-cidade-erro" role="alert" className="text-sm font-semibold text-perigo">
              {erroDe("cidade")}
            </p>
          )}
        </div>
      ) : (
        <Campo rotulo="Cidade da loja" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} erro={erroDe("cidade")} />
      )}

      {avisoTeste && <p className="rounded-card bg-laranja-claro p-3 text-base">{avisoTeste}</p>}

      <Botao type="submit" larguraTotal carregando={enviando} textoCarregando="Criando sua loja..." disabled={situacao === "ocupado"}>
        Criar minha loja
      </Botao>
    </form>
  );
}
