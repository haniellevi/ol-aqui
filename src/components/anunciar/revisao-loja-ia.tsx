"use client";

import { useState } from "react";
import type { EstadoLoja } from "@/app/(conta)/quero-vender/actions";
import type { CamposRascunho, FonteLoja, RascunhoLoja } from "@/lib/loja-ia/tipos";
import { Campo } from "@/components/ui/campo";
import { Botao } from "@/components/ui/botao";
import { classesCampo } from "@/components/ui/input";
import { AvisoErro } from "./aviso-erro";

type NomeCampo = keyof CamposRascunho;
type Valores = Record<NomeCampo, string>;
type Edicoes = Partial<Record<NomeCampo, string | null>>;
type Props = {
  rascunho: RascunhoLoja;
  cidades: { nome: string; uf: string }[];
  whatsappInicial: string;
  avisoTeste: string | null;
  salvar: (id: string, revisao: number, edicoes: Edicoes) => Promise<RascunhoLoja>;
  retentar: (id: string, fonte: FonteLoja) => Promise<RascunhoLoja>;
  confirmar: (id: string, revisao: number, form: FormData) => Promise<EstadoLoja>;
  imagens: Record<string, string>;
  linkMaps: string;
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

export function RevisaoLojaIa({ rascunho: inicial, cidades, whatsappInicial, avisoTeste, salvar, retentar, confirmar, imagens, linkMaps }: Props) {
  const [rascunho, setRascunho] = useState(inicial);
  const [valores, setValores] = useState(() => valoresIniciais(inicial, whatsappInicial));
  const [base, setBase] = useState(() => valoresIniciais(inicial, whatsappInicial));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState<EstadoLoja>(null);

  function atualizar(campo: NomeCampo, valor: string) { setValores(anteriores => ({ ...anteriores, [campo]: valor })); }
  function receber(r: RascunhoLoja) {
    setRascunho(r);
    const novos = valoresIniciais(r, whatsappInicial);
    setValores(novos); setBase(novos);
  }
  async function salvarPendentes(): Promise<RascunhoLoja> {
    const edicoes = edicoesPendentes(base, valores);
    if (!Object.keys(edicoes).length) return rascunho;
    const salvo = await salvar(rascunho.id, rascunho.revisao, edicoes);
    receber(salvo);
    return salvo;
  }
  async function executar(acao: "salvar" | "confirmar" | FonteLoja) {
    if (ocupado) return;
    setOcupado(true); setErro(""); setEstado(null);
    try {
      const salvo = await salvarPendentes();
      if (acao === "confirmar") {
        const resultado = await confirmar(salvo.id, salvo.revisao, formularioRevisao(valores));
        setEstado(resultado);
        if (resultado?.erro?.mensagem) setErro(resultado.erro.mensagem);
      } else if (acao !== "salvar") receber(await retentar(salvo.id, acao));
    } catch (e) { setErro(e instanceof Error && e.message ? e.message : "Não foi possível concluir. Tente novamente."); }
    finally { setOcupado(false); }
  }
  if (estado?.feito) return <div role="status"><p>Sua loja foi criada.</p><a href={`/loja/${encodeURIComponent(estado.feito.slug)}`} className="font-semibold text-laranja-escuro underline">Ver minha loja</a></div>;
  const erroCampo = (campo: NomeCampo) => estado?.campos?.[nomesForm[campo]];
  function detalhes(campo: NomeCampo) {
    const dado = rascunho.campos[campo];
    if (!dado) return null;
    const origem = dado.origem;
    const sugestao = dado.sugestao;
    return <div className="flex flex-col gap-1 text-sm text-texto-suave">
      {origem && <p>Origem: {origem.url && /^https:\/\//i.test(origem.url) ? <a href={origem.url} target="_blank" rel="noreferrer" className="text-laranja-escuro underline">{origem.rotulo}</a> : origem.rotulo}</p>}
      {sugestao && <div><p>Nova sugestão ({sugestao.origem.rotulo}): {sugestao.valor}</p><Botao variante="texto" tamanho="pequeno" type="button" onClick={() => atualizar(campo, sugestao.valor)}>Usar sugestão</Botao></div>}
    </div>;
  }
  const fontes = Object.entries(rascunho.fontes) as [FonteLoja, unknown][];
  return <section className="flex flex-col gap-5" aria-busy={ocupado}>
    <h1 className="text-xl font-semibold text-beringela">Revise sua loja</h1>
    <p>Confira os dados e escolha o que deseja publicar.</p>
    <AvisoErro mensagem={erro} />
    {rascunho.estado === "processando" && <p role="status">Algumas fontes ainda estão sendo consultadas. Você pode salvar suas alterações e voltar depois.</p>}
    <fieldset disabled={ocupado} className="flex min-w-0 flex-col gap-5">
      {campos.filter(c => c !== "logo" && c !== "capa").map(campo => <div key={campo} className="flex flex-col gap-2">
        {campo === "cidade" && cidades.length ? <div className="flex flex-col gap-1"><label className="text-sm font-semibold" htmlFor="revisao-cidade">Cidade da loja</label><select id="revisao-cidade" name="cidade" className={classesCampo} value={valores.cidade} onChange={e => atualizar("cidade", e.target.value)} aria-invalid={!!erroCampo("cidade")}><option value="">Escolha a cidade</option>{cidades.map(c => <option key={`${c.nome}-${c.uf}`} value={c.nome}>{c.nome} - {c.uf}</option>)}</select>{erroCampo("cidade") && <p role="alert" className="text-sm text-perigo">{erroCampo("cidade")}</p>}</div> : campo === "sobre" ? <Campo multilinha rotulo={rotulos[campo]} name={nomesForm[campo]} value={valores[campo]} onChange={e => atualizar(campo, e.target.value)} maxLength={1500} rows={4} erro={erroCampo(campo)} opcional /> : <Campo rotulo={rotulos[campo]} name={nomesForm[campo]} value={valores[campo]} onChange={e => atualizar(campo, e.target.value)} erro={erroCampo(campo)} opcional={!['nome','cidade','slug'].includes(campo)} />}
        {detalhes(campo)}
      </div>)}
      {(["logo", "capa"] as const).map(campo => <div key={campo} className="flex flex-col gap-2"><label htmlFor={`revisao-${campo}`} className="text-sm font-semibold">{rotulos[campo]}</label><select id={`revisao-${campo}`} className={classesCampo} value={valores[campo]} onChange={e => atualizar(campo, e.target.value)}><option value="">Nenhuma imagem</option>{Object.keys(imagens).map((id, i) => <option key={id} value={id}>Imagem {i + 1}</option>)}</select>{valores[campo] && imagens[valores[campo]] && <a href={imagens[valores[campo]]} target="_blank" rel="noreferrer" className="text-sm text-laranja-escuro underline">Visualizar {rotulos[campo].toLowerCase()}</a>}{detalhes(campo)}{erroCampo(campo) && <p role="alert" className="text-sm text-perigo">{erroCampo(campo)}</p>}</div>)}
      <a href={linkMaps} target="_blank" rel="noreferrer" className="font-semibold text-laranja-escuro underline">Conferir no Google Maps</a>
      {fontes.map(([fonte, resultado]) => {
        if (!resultado || typeof resultado !== "object" || !("estado" in resultado) || !["indisponivel", "pendente"].includes(String(resultado.estado))) return null;
        const pendente = resultado.estado === "pendente";
        const motivo = "motivo" in resultado && typeof resultado.motivo === "string" ? resultado.motivo : "Fonte indisponível.";
        return <div key={fonte} className="rounded-card bg-fundo p-3"><p>{fonte}: {pendente ? "Consulta em andamento." : motivo}</p><Botao type="button" variante="secundario" disabled={pendente} onClick={() => void executar(fonte)}>Tentar novamente</Botao></div>;
      })}
      {avisoTeste && <p className="rounded-card bg-fundo p-3">{avisoTeste}</p>}
      <div className="flex flex-wrap gap-3"><Botao type="button" variante="secundario" onClick={() => void executar("salvar")}>Salvar alterações</Botao><Botao type="button" onClick={() => void executar("confirmar")}>Criar minha loja</Botao></div>
    </fieldset>
  </section>;
}
