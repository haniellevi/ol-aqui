"use client";

import { LojaPronta } from "./loja-pronta";
import { useState } from "react";
import type { EstadoLoja } from "@/app/(conta)/quero-vender/actions";
import { dadosLojaIa, type CamposRascunho, type FonteLoja, type RascunhoLoja, type RespostaLojaIa } from "@/lib/loja-ia/tipos";
import { Campo } from "@/components/ui/campo";
import { Seletor } from "@/components/conta/seletor";
import { Botao } from "@/components/ui/botao";
import { AvisoErro } from "./aviso-erro";

type NomeCampo = keyof CamposRascunho;
type Valores = Record<NomeCampo, string>;
type Edicoes = Partial<Record<NomeCampo, string | null>>;
type Props = {
  assistente?: string;
  rascunho: RascunhoLoja;
  cidades: { nome: string; uf: string }[];
  whatsappInicial: string;
  avisoTeste: string | null;
  salvar: (id: string, revisao: number, edicoes: Edicoes) => Promise<RespostaLojaIa<RascunhoLoja>>;
  retentar: (id: string, fonte: FonteLoja) => Promise<RespostaLojaIa<RascunhoLoja>>;
  confirmar: (id: string, revisao: number, form: FormData) => Promise<EstadoLoja>;
  imagens: Record<string, string>;
  linkMaps: string;
  revogarWhatsapp?: (id: string) => Promise<RespostaLojaIa<RascunhoLoja>>;
  gerarCapa?: (id: string) => Promise<RespostaLojaIa<{ id: string; url: string }>>;
};
const campos: NomeCampo[] = ["nome", "cidade", "slug", "categoria", "sobre", "whatsapp", "endereco", "site", "instagram", "logo", "capa"];
const nomesForm: Record<NomeCampo, string> = { nome: "nome_loja", cidade: "cidade", slug: "slug", categoria: "categoria_loja", sobre: "sobre", whatsapp: "whatsapp", endereco: "endereco", site: "site", instagram: "instagram", logo: "logo", capa: "capa" };
const rotulos: Record<NomeCampo, string> = { nome: "Nome da loja", cidade: "Cidade da loja", slug: "Link da sua loja", categoria: "Categoria da loja", sobre: "Descrição da loja", whatsapp: "WhatsApp da loja", endereco: "Endereço", site: "Site", instagram: "Instagram", logo: "Logo", capa: "Capa" };

export function valoresIniciais(r: RascunhoLoja, whatsappInicial: string): Valores {
  return Object.fromEntries(campos.map(c => [c, r.campos[c]?.valor ?? (c === "whatsapp" && !r.campos[c]?.editado ? whatsappInicial : "")])) as Valores;
}
export function edicoesPendentes(antes: Valores, agora: Valores): Edicoes {
  return Object.fromEntries(campos.filter(c => antes[c] !== agora[c]).map(c => [c, agora[c] === "" ? null : agora[c]])) as Edicoes;
}
export function formularioRevisao(valores: Valores): FormData {
  const form = new FormData();
  for (const campo of campos) form.set(nomesForm[campo], valores[campo]);
  return form;
}

export function LojaIaConcluida({ slug, assistente }: { slug: string; assistente?: string }) {
  return <LojaPronta slug={slug} assistente={assistente} />;
}

export function RevisaoLojaIa({ assistente, rascunho: inicial, cidades, whatsappInicial, avisoTeste, salvar, retentar, confirmar, imagens, linkMaps, gerarCapa, revogarWhatsapp }: Props) {
  const [rascunho, setRascunho] = useState(inicial);
  const [valores, setValores] = useState(() => valoresIniciais(inicial, whatsappInicial));
  const [base, setBase] = useState(() => valoresIniciais(inicial, whatsappInicial));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState<EstadoLoja>(null);
  const [imagensDisponiveis, setImagensDisponiveis] = useState(imagens);

  function atualizar(campo: NomeCampo, valor: string) { setValores(anteriores => ({ ...anteriores, [campo]: valor })); }
  function receber(r: RascunhoLoja) {
    setRascunho(r);
    const novos = valoresIniciais(r, whatsappInicial);
    setValores(novos); setBase(novos);
  }
  async function salvarPendentes(): Promise<RascunhoLoja> {
    const edicoes = edicoesPendentes(base, valores);
    if (!Object.keys(edicoes).length) return rascunho;
    const salvo = dadosLojaIa(await salvar(rascunho.id, rascunho.revisao, edicoes));
    receber(salvo);
    return salvo;
  }
  async function executar(acao: "salvar" | "confirmar" | "gerarCapa" | "atualizar" | "revogarWhatsapp" | FonteLoja) {
    if (ocupado) return;
    setOcupado(true); setErro(""); setEstado(null);
    try {
      if (acao === "revogarWhatsapp") {
        if (revogarWhatsapp) {
          const edicoes = edicoesPendentes(base, valores);
          const revogado = dadosLojaIa(await revogarWhatsapp(rascunho.id));
          receber(revogado);
          setValores(atuais => ({ ...atuais, ...Object.fromEntries(Object.entries(edicoes).map(([chave, valor]) => [chave, valor ?? ""])) }));
        }
        return;
      }
      const salvo = await salvarPendentes();
      if (acao === "gerarCapa") {
        if (!gerarCapa) throw new Error("Geração de capa indisponível.");
        const imagem = dadosLojaIa(await gerarCapa(salvo.id));
        setImagensDisponiveis(atuais => ({ ...atuais, [imagem.id]: imagem.url }));
        atualizar("capa", imagem.id);
        receber(dadosLojaIa(await salvar(salvo.id, salvo.revisao, { capa: imagem.id })));
      } else if (acao === "atualizar") {
        window.location.reload();
      } else if (acao === "confirmar") {
        const resultado = await confirmar(salvo.id, salvo.revisao, formularioRevisao(valores));
        setEstado(resultado);
        if (resultado?.erro?.mensagem) setErro(resultado.erro.mensagem);
      } else if (acao !== "salvar") receber(dadosLojaIa(await retentar(salvo.id, acao)));
    } catch (e) { setErro(e instanceof Error && e.message ? e.message : "Não foi possível concluir. Tente novamente."); }
    finally { setOcupado(false); }
  }
  if (estado?.feito) return <LojaIaConcluida slug={estado.feito.slug} assistente={assistente} />;
  const erroCampo = (campo: NomeCampo) => estado?.campos?.[nomesForm[campo]];
  function detalhes(campo: NomeCampo) {
    const dado = rascunho.campos[campo];
    if (!dado) return null;
    const origem = dado.origem;
    const sugestao = dado.sugestao;
    return <div className="flex flex-col gap-1 text-sm text-texto-suave">
      {origem && <p>Origem: {origem.url && /^https:\/\//i.test(origem.url) ? <a href={origem.url} target="_blank" rel="noreferrer" className="text-laranja-escuro underline">{origem.rotulo}</a> : origem.rotulo}</p>}
      {sugestao && <div>
        <p>Nova sugestão ({sugestao.origem.rotulo}){campo !== "logo" && campo !== "capa" && `: ${sugestao.valor}`}</p>
        {(campo === "logo" || campo === "capa") && imagensDisponiveis[sugestao.valor] &&
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagensDisponiveis[sugestao.valor]} alt={`Sugestão de ${rotulos[campo].toLowerCase()} da loja`} className="h-24 max-w-full object-contain" />}
        <Botao variante="texto" tamanho="pequeno" type="button" onClick={() => atualizar(campo, sugestao.valor)}>Usar sugestão</Botao>
      </div>}
    </div>;
  }
  const fontes = Object.entries(rascunho.fontes) as [FonteLoja, unknown][];
  return <section className="flex flex-col gap-3" aria-busy={ocupado}>
    <header>
      <h1 className="text-titulo font-semibold text-beringela">Revise sua loja</h1>
      <p className="mt-1 text-sm text-texto-suave">Confira os dados e escolha o que deseja publicar.</p>
    </header>
    <AvisoErro mensagem={erro} />
    {revogarWhatsapp && (rascunho.entrada.consultarWhatsapp || rascunho.entrada.avisarWhatsapp) && <Botao type="button" tamanho="toque" variante="secundario" disabled={ocupado} onClick={() => void executar("revogarWhatsapp")}>Retirar autorização do WhatsApp</Botao>}
    <fieldset disabled={ocupado} className="flex min-w-0 flex-col gap-3 rounded-card border border-borda bg-cartao p-3 sm:p-4">
      {campos.filter(c => c !== "logo" && c !== "capa").map(campo => <div key={campo} className="flex flex-col gap-2">
        {campo === "cidade" && cidades.length ? <Seletor tamanho="toque" rotulo="Cidade da loja" id="revisao-cidade" name="cidade" value={valores.cidade} onChange={e => atualizar("cidade", e.target.value)} erro={erroCampo("cidade")}><option value="">Escolha a cidade</option>{cidades.map(c => <option key={`${c.nome}-${c.uf}`} value={c.nome}>{c.nome} - {c.uf}</option>)}</Seletor> : campo === "sobre" ? <Campo tamanho="toque" multilinha rotulo={rotulos[campo]} name={nomesForm[campo]} value={valores[campo]} onChange={e => atualizar(campo, e.target.value)} maxLength={1500} rows={4} erro={erroCampo(campo)} opcional /> : <Campo tamanho="toque" rotulo={rotulos[campo]} name={nomesForm[campo]} value={valores[campo]} onChange={e => atualizar(campo, e.target.value)} erro={erroCampo(campo)} opcional={!['nome','cidade','slug','whatsapp'].includes(campo)} />}
        {detalhes(campo)}
      </div>)}
      {(["logo", "capa"] as const).map(campo => <div key={campo} className="flex flex-col gap-2">
        <Seletor tamanho="toque" rotulo={rotulos[campo]} id={`revisao-${campo}`} name={campo} value={valores[campo]} onChange={e => atualizar(campo, e.target.value)}>
          <option value="">Nenhuma imagem</option>
          {Object.keys(imagensDisponiveis).map((id, i) => {
            const logo = rascunho.campos.logo;
            const doWhatsapp = (logo.origem?.fonte === "whatsapp" && logo.valor === id) || (logo.sugestao?.origem.fonte === "whatsapp" && logo.sugestao.valor === id);
            return <option key={id} value={id}>{doWhatsapp ? "Foto do WhatsApp Business" : `Imagem ${i + 1}`}</option>;
          })}
        </Seletor>
        {valores[campo] && imagensDisponiveis[valores[campo]] && <a href={imagensDisponiveis[valores[campo]]} target="_blank" rel="noreferrer" className="w-fit rounded-lg border border-borda p-2 focus-visible:outline-2 focus-visible:outline-offset-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagensDisponiveis[valores[campo]]} alt={`Prévia ${campo === "logo" ? "do logo" : "da capa"} da loja`} className="h-32 max-w-full object-contain" />
        </a>}
        {detalhes(campo)}
        {campo === "capa" && gerarCapa && <Botao type="button" tamanho="toque" variante="secundario" onClick={() => void executar("gerarCapa")}>Criar modelo de capa da Lia</Botao>}
        {erroCampo(campo) && <p role="alert" className="text-sm text-perigo">{erroCampo(campo)}</p>}
      </div>)}
      <Botao href={linkMaps} target="_blank" rel="noreferrer" variante="texto" tamanho="toque" className="self-start">Conferir no Google Maps</Botao>
      {fontes.map(([fonte, resultado]) => {
        if (!resultado || typeof resultado !== "object" || !("estado" in resultado) || !["indisponivel", "pendente"].includes(String(resultado.estado))) return null;
        const pendente = resultado.estado === "pendente";
        const motivo = "motivo" in resultado && typeof resultado.motivo === "string" ? resultado.motivo : "Fonte indisponível.";
        return <div key={fonte} className="rounded-card bg-fundo p-3"><p>{fonte}: {pendente ? "Consulta em andamento." : motivo}</p><Botao type="button" tamanho="toque" variante="secundario" disabled={pendente} onClick={() => void executar(fonte)}>Tentar novamente</Botao></div>;
      })}
      {(rascunho.estado === "processando" || fontes.some(([, resultado]) => resultado && typeof resultado === "object" && "estado" in resultado && resultado.estado === "pendente")) && <Botao type="button" tamanho="toque" variante="secundario" onClick={() => void executar("atualizar")}>Atualizar andamento</Botao>}
      {avisoTeste && <p className="rounded-campo bg-selecao px-3 py-2 text-sm text-beringela">{avisoTeste}</p>}
      <div className="flex flex-wrap gap-2 [&>*]:grow"><Botao type="button" tamanho="toque" variante="secundario" onClick={() => void executar("salvar")}>Salvar alterações</Botao><Botao type="button" tamanho="toque" onClick={() => void executar("confirmar")}>Criar minha loja</Botao></div>
    </fieldset>
  </section>;
}
