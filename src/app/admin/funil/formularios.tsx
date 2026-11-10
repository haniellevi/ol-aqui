"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { CampoBusca } from "@/components/admin/campo-busca";
import { Botao } from "@/components/ui/botao";
import { confirmarAntes, useConfirmar } from "@/components/ui/confirmar";
import { useCampoTelefone } from "@/components/ui/use-campo-telefone";
import type { EtapaFunil, LojistaFunil, OpcoesFunil } from "@/lib/admin/funil";
import {
  adicionarNota, agendarPasso, apagarLojista, apagarNota, importarLojas, mudarEtapa, salvarEtapa, salvarLojista,
} from "./actions";

function Retorno({ estado }: { estado: { ok?: string; erro?: string } | null }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

const rotulo = "text-sm font-medium text-beringela";

/** AAAA-MM-DD daqui a `dias` dias, no fuso do Piauí. */
function diaDaqui(dias: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date(Date.now() + dias * 86_400_000));
}

const ATALHOS = [
  { nome: "Hoje", dias: 0 },
  { nome: "Amanhã", dias: 1 },
  { nome: "Em 3 dias", dias: 3 },
  { nome: "Próxima semana", dias: 7 },
];

/** Ficha do contato: nova (sem `lojista`) ou edição. */
export function FormLojista({ lojista, opcoes, regiaoPadrao }: { lojista?: LojistaFunil; opcoes: OpcoesFunil; regiaoPadrao?: string }) {
  const [estado, acao, pendente] = useActionState(salvarLojista, null);
  const [regiao, setRegiao] = useState(lojista?.microrregiao_id ?? regiaoPadrao ?? opcoes.regioes[0]?.valor ?? "");
  const [etapa, setEtapa] = useState(lojista?.etapa ?? opcoes.etapas.find((e) => e.ativa)?.codigo ?? "");
  const [proximo, setProximo] = useState(lojista?.proximo_em ?? "");
  const tel = useCampoTelefone(lojista?.whatsapp ? lojista.whatsapp.replace(/^55/, "") : "");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- prefixo é da peça Input, não do <input>
  const { prefixo, ...campoTel } = tel.campo;
  const cidades = useMemo(() => opcoes.cidades.filter((c) => c.regiao === regiao), [opcoes.cidades, regiao]);
  const etapas = opcoes.etapas.filter((e) => e.ativa || e.codigo === lojista?.etapa);
  const perdido = opcoes.etapas.find((e) => e.codigo === etapa)?.tipo === "perdido";

  return (
    <form action={acao} className="grid grid-cols-1 gap-3 @2xl/painel:grid-cols-2">
      {lojista && <input type="hidden" name="id" value={lojista.id} />}
      <label className={rotulo}>
        Nome da loja
        <input name="nome_loja" required minLength={2} maxLength={80} defaultValue={lojista?.nome_loja} className={estiloCampo} />
      </label>
      <label className={rotulo}>
        Etapa
        <select name="etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)} className={estiloCampo}>
          {etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.nome}</option>)}
        </select>
      </label>
      <label className={rotulo}>
        Nome de quem atende
        <input name="contato_nome" maxLength={80} defaultValue={lojista?.contato_nome ?? ""} className={estiloCampo} />
      </label>
      <label className={rotulo}>
        WhatsApp
        <input name="whatsapp" {...campoTel} className={estiloCampo} />
        {tel.erro && <span className="mt-1 block text-legenda font-normal text-perigo">{tel.erro}</span>}
      </label>
      <label className={rotulo}>
        Região
        <select name="regiao" value={regiao} onChange={(e) => setRegiao(e.target.value)} className={estiloCampo}>
          {opcoes.regioes.map((r) => <option key={r.valor} value={r.valor}>{r.nome}</option>)}
        </select>
      </label>
      <div className={rotulo}>
        Cidade
        <div className="mt-1">
          <CampoBusca key={regiao} nome="cidade" opcoes={cidades} valorInicial={lojista?.cidade_id ?? ""} rotulo="Cidade" placeholder="Digite a cidade" />
        </div>
      </div>
      <label className={rotulo}>
        O que vende
        <select name="categoria" defaultValue={lojista?.categoria_id ?? ""} className={estiloCampo}>
          <option value="">Não sei ainda</option>
          {opcoes.categorias.map((c) => <option key={c.valor} value={c.valor}>{c.nome}</option>)}
        </select>
      </label>
      <label className={rotulo}>
        Como conheceu
        <select name="origem" defaultValue={lojista?.origem ?? ""} className={estiloCampo}>
          <option value="">Não sei</option>
          {opcoes.origens.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
        </select>
      </label>
      <label className={rotulo}>
        Responsável
        <select name="responsavel" defaultValue={lojista?.responsavel_id ?? ""} className={estiloCampo}>
          <option value="">Ninguém</option>
          {opcoes.responsaveis.map((r) => <option key={r.valor} value={r.valor}>{r.nome}</option>)}
        </select>
      </label>
      <label className={rotulo}>
        Próximo passo
        <input name="proximo_passo" maxLength={200} defaultValue={lojista?.proximo_passo ?? ""} placeholder="ex.: voltar com o QR do balcão" className={estiloCampo} />
      </label>
      <div className={`${rotulo} @2xl/painel:col-span-2`}>
        Quando
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input name="proximo_em" type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} className={`${estiloCampo} mt-0 w-auto`} />
          {ATALHOS.map((a) => (
            <Botao key={a.nome} type="button" variante="secundario" tamanho="pequeno" onClick={() => setProximo(diaDaqui(a.dias))}>{a.nome}</Botao>
          ))}
          {proximo && <Botao type="button" variante="texto" tamanho="pequeno" onClick={() => setProximo("")}>Limpar</Botao>}
        </div>
      </div>
      {perdido && (
        <label className={`${rotulo} @2xl/painel:col-span-2`}>
          Por que cancelou
          <input name="motivo_perda" maxLength={200} defaultValue={lojista?.motivo_perda ?? ""} className={estiloCampo} />
        </label>
      )}
      {!lojista && (
        <label className={`${rotulo} @2xl/painel:col-span-2`}>
          Anotação (opcional)
          <textarea name="nota" maxLength={1000} rows={3} className={`${estiloCampo} h-auto py-2`} />
        </label>
      )}
      <div className="@2xl/painel:col-span-2">
        <Botao type="submit" carregando={pendente} textoCarregando="Salvando...">{lojista ? "Salvar" : "Anotar no funil"}</Botao>
      </div>
      <div className="@2xl/painel:col-span-2"><Retorno estado={estado} /></div>
    </form>
  );
}

/** Select da etapa na lista: escolheu, já salva. */
export function MudarEtapa({ id, etapa, etapas }: { id: string; etapa: string; etapas: EtapaFunil[] }) {
  const [estado, acao, pendente] = useActionState(mudarEtapa, null);
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <select
        name="etapa"
        defaultValue={etapa}
        disabled={pendente}
        aria-label="Etapa"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${estiloCampo} mt-0 h-8 w-auto py-0 text-sm`}
      >
        {etapas.filter((e) => e.ativa || e.codigo === etapa).map((e) => <option key={e.codigo} value={e.codigo}>{e.nome}</option>)}
      </select>
      {estado?.erro && <p role="alert" className="mt-1 text-legenda text-perigo">{estado.erro}</p>}
    </form>
  );
}

/** Marcar o próximo passo com um toque. */
export function AgendarRapido({ id }: { id: string }) {
  const [estado, acao, pendente] = useActionState(agendarPasso, null);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={id} />
      {ATALHOS.slice(1).map((a) => (
        <Botao key={a.nome} type="submit" name="dia" value={diaDaqui(a.dias)} variante="texto" tamanho="pequeno" disabled={pendente}>{a.nome}</Botao>
      ))}
      {estado?.erro && <span role="alert" className="text-legenda text-perigo">{estado.erro}</span>}
    </form>
  );
}

export function NovaNota({ id }: { id: string }) {
  const [estado, acao, pendente] = useActionState(adicionarNota, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className={rotulo}>
        Nova anotação
        <textarea name="texto" required maxLength={1000} rows={3} placeholder="ex.: dono só fica à tarde; pediu para mandar o vídeo" className={`${estiloCampo} h-auto py-2`} />
      </label>
      <Botao type="submit" variante="secundario" tamanho="pequeno" carregando={pendente}>Anotar</Botao>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

export function BotaoApagarNota({ id, nota }: { id: string; nota: string }) {
  const [estado, acao, pendente] = useActionState(apagarNota, null);
  const confirmar = useConfirmar();
  return (
    <form action={acao} onSubmit={confirmarAntes(confirmar, { titulo: "Apagar esta anotação?", acao: "Apagar", perigo: true })}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nota" value={nota} />
      <Botao type="submit" variante="texto" tamanho="pequeno" carregando={pendente}>Apagar</Botao>
      {estado?.erro && <span role="alert" className="text-legenda text-perigo">{estado.erro}</span>}
    </form>
  );
}

export function BotaoApagarLojista({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(apagarLojista, null);
  const confirmar = useConfirmar();
  return (
    <form action={acao} onSubmit={confirmarAntes(confirmar, { titulo: `Tirar "${nome}" do funil?`, texto: "As anotações também somem. A loja no site não muda.", acao: "Tirar do funil", perigo: true })}>
      <input type="hidden" name="id" value={id} />
      <Botao type="submit" variante="perigo" tamanho="pequeno" carregando={pendente}>Tirar do funil</Botao>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

export function BotaoImportar() {
  const [estado, acao, pendente] = useActionState(importarLojas, null);
  return (
    <form action={acao} className="space-y-2">
      <Botao type="submit" variante="secundario" tamanho="pequeno" carregando={pendente}>Trazer lojas já cadastradas</Botao>
      <Retorno estado={estado} />
    </form>
  );
}

function LinhaEtapa({ e }: { e?: EtapaFunil }) {
  const [estado, acao, pendente] = useActionState(salvarEtapa, null);
  return (
    <form action={acao} className="grid grid-cols-2 items-end gap-2 border-b border-borda py-3 last:border-b-0 @3xl/painel:grid-cols-[1.5fr_1fr_5rem_7rem_auto]">
      {e ? <input type="hidden" name="codigo" value={e.codigo} /> : <input type="hidden" name="nova" value="1" />}
      <label className={rotulo}>
        Nome
        <input name="nome" required maxLength={40} defaultValue={e?.nome} placeholder={e ? undefined : "ex.: Negociando"} className={estiloCampo} />
      </label>
      <label className={rotulo}>
        Tipo
        <select name="tipo" defaultValue={e?.tipo ?? "aberta"} className={estiloCampo}>
          <option value="aberta">Em andamento</option>
          <option value="ganho">Fechou (pagando)</option>
          <option value="perdido">Perdeu (cancelou)</option>
        </select>
      </label>
      <label className={rotulo}>
        Ordem
        <input name="ordem" type="number" min={0} max={9999} defaultValue={e?.ordem ?? 100} className={estiloCampo} />
      </label>
      <label className={rotulo}>
        Situação
        <select name="ativa" defaultValue={e ? String(e.ativa) : "true"} className={estiloCampo}>
          <option value="true">Ligada</option>
          <option value="false">Desligada</option>
        </select>
      </label>
      <Botao type="submit" variante={e ? "secundario" : "primario"} tamanho="pequeno" carregando={pendente}>{e ? "Salvar" : "Adicionar"}</Botao>
      {estado && <div className="col-span-full"><Retorno estado={estado} /></div>}
    </form>
  );
}

export function EditarEtapas({ etapas }: { etapas: EtapaFunil[] }) {
  return (
    <div>
      {etapas.map((e) => <LinhaEtapa key={e.codigo} e={e} />)}
      <LinhaEtapa />
    </div>
  );
}
