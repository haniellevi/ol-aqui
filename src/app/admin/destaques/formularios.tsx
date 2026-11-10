"use client";

import { useActionState, useState } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { paraReaisInput } from "@/lib/admin/formato";
import type { SlugDestaque, TipoDestaque } from "@/lib/tipos-destaques";
import {
  cancelarDestaqueAdmin,
  concederCortesia,
  removerPrecoRegiao,
  salvarCreditosDestaque,
  salvarPrecoRegiao,
  salvarTipoDestaque,
} from "./actions";

// Formulários da tela 10 (Destaques). Cada botão mostra "carregando" e não deixa enviar duas vezes.

function Retorno({ estado }: { estado: { ok?: string; erro?: string } | null }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

export function FormTipoDestaque({ tipo }: { tipo: TipoDestaque }) {
  const [estado, acao, pendente] = useActionState(salvarTipoDestaque, null);
  const subir = tipo.slug === "subir";
  return (
    <form action={acao} className="grid grid-cols-2 items-start gap-3 @3xl/painel:grid-cols-4">
      <input type="hidden" name="slug" value={tipo.slug} />
      <label className="col-span-2 text-sm font-semibold">
        Nome (aparece para o vendedor)
        <input name="nome" required maxLength={60} defaultValue={tipo.nome} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Preço (R$)
        <input name="preco" inputMode="decimal" required defaultValue={paraReaisInput(tipo.preco_centavos)} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        {subir ? "Dias" : "Dias no ar"}
        {subir ? (
          <input disabled value="Uma vez" className={estiloCampo} readOnly />
        ) : (
          <input name="dias" type="number" min={1} max={365} required defaultValue={tipo.dias ?? 7} className={estiloCampo} />
        )}
      </label>
      <label className="text-sm font-semibold">
        Vagas por região
        <input name="vagas" type="number" min={1} max={1000} placeholder="sem limite" defaultValue={tipo.vagas_por_regiao ?? ""} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Ordem na tela
        <input name="ordem" type="number" defaultValue={tipo.ordem} className={estiloCampo} />
      </label>
      <label className="col-span-2 text-sm font-semibold">
        O que faz (texto curto)
        <textarea name="descricao" rows={2} maxLength={200} defaultValue={tipo.descricao ?? ""} className={`${estiloCampo} h-auto min-h-20 py-2 leading-relaxed`} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-borda pt-2 @3xl/painel:col-span-4">
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={tipo.ativo} className="size-5 accent-laranja-escuro" />
          Ativo (aparece para vender)
        </label>
        <Botao type="submit" variante="secundario" carregando={pendente} textoCarregando="Salvando..." className="ml-auto">
          Salvar
        </Botao>
      </div>
      {estado && <div className="col-span-2 @3xl/painel:col-span-4"><Retorno estado={estado} /></div>}
    </form>
  );
}

export function FormCreditos({
  planos,
  tipos,
  creditos,
}: {
  planos: { codigo: string; nome: string }[];
  tipos: { slug: SlugDestaque; nome: string }[];
  creditos: Record<string, number>;
}) {
  const [estado, acao, pendente] = useActionState(salvarCreditosDestaque, null);
  return (
    <form action={acao} className="space-y-3">
      <div className="relative -mx-4 overflow-x-auto px-4 focus-visible:outline-2 focus-visible:outline-laranja-escuro" role="region" aria-label="Créditos por plano e tipo de destaque" tabIndex={0}>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-texto-suave">
              <th className="py-2 pr-3 font-semibold">Plano</th>
              {tipos.map((t) => (
                <th key={t.slug} className="px-2 py-2 font-semibold">
                  {t.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planos.map((p) => (
              <tr key={p.codigo} className="border-t border-borda">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-beringela">
                  {p.nome}
                </th>
                {tipos.map((t) => (
                  <td key={t.slug} className="px-2 py-1">
                    <label className="sr-only" htmlFor={`c-${p.codigo}-${t.slug}`}>
                      {`${t.nome} grátis por mês no ${p.nome}`}
                    </label>
                    <input
                      id={`c-${p.codigo}-${t.slug}`}
                      name={`c:${p.codigo}:${t.slug}`}
                      type="number"
                      min={0}
                      max={1000}
                      defaultValue={creditos[`${p.codigo}:${t.slug}`] ?? 0}
                      className={`${estiloCampo} mt-0 w-24`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Botao type="submit" variante="secundario" carregando={pendente} textoCarregando="Salvando...">
        Salvar créditos
      </Botao>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormCortesia({ tipos }: { tipos: { slug: SlugDestaque; nome: string; dias: number | null }[] }) {
  const [estado, acao, pendente] = useActionState(concederCortesia, null);
  const [tipo, setTipo] = useState<SlugDestaque>(tipos[0]?.slug ?? "busca");
  const atual = tipos.find((t) => t.slug === tipo);
  return (
    <form action={acao} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold">
        Tipo
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as SlugDestaque)} className={estiloCampo}>
          {tipos.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        {tipo === "loja" ? "Endereço da loja" : "Link do anúncio"}
        <input
          name="alvo"
          required
          placeholder={tipo === "loja" ? "/loja/nome-da-loja" : "/anuncio/..."}
          className={estiloCampo}
        />
      </label>
      {tipo !== "subir" && (
        <label className="text-sm font-semibold">
          Dias
          <input name="dias" type="number" min={1} max={365} placeholder={atual?.dias ? `${atual.dias} (padrão)` : ""} className={estiloCampo} />
        </label>
      )}
      <label className="text-sm font-semibold">
        Motivo (fica no histórico)
        <input name="motivo" required minLength={3} maxLength={300} placeholder="ex.: lançamento da loja" className={estiloCampo} />
      </label>
      <label className="flex h-11 items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="ignorar_vagas" className="size-5 accent-laranja-escuro" />
        Passar das vagas da região, se estiverem cheias
      </label>
      <div className="md:col-span-2">
        <Botao type="submit" carregando={pendente} textoCarregando="Ativando...">
          Dar cortesia
        </Botao>
      </div>
      <div className="md:col-span-2">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormPrecoRegiao({
  tipos,
  regioes,
}: {
  tipos: { slug: SlugDestaque; nome: string }[];
  regioes: { id: string; nome: string }[];
}) {
  const [estado, acao, pendente] = useActionState(salvarPrecoRegiao, null);
  const [tipo, setTipo] = useState<SlugDestaque>(tipos[0]?.slug ?? "busca");
  return (
    <form action={acao} className="grid grid-cols-2 gap-3 @3xl/painel:grid-cols-4">
      <label className="col-span-2 text-sm font-semibold @3xl/painel:col-span-1">
        Tipo
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as SlugDestaque)} className={estiloCampo}>
          {tipos.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 text-sm font-semibold @3xl/painel:col-span-1">
        Região
        <select name="microrregiao_id" required defaultValue="" className={estiloCampo}>
          <option value="" disabled>
            Escolha
          </option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Preço (R$)
        <input name="preco" inputMode="decimal" placeholder="igual ao do tipo" className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Dias
        {tipo === "subir" ? (
          <input disabled value="Uma vez" className={estiloCampo} readOnly />
        ) : (
          <input name="dias" type="number" min={1} max={365} placeholder="igual ao do tipo" className={estiloCampo} />
        )}
      </label>
      <div className="col-span-2 @3xl/painel:col-span-4">
        <Botao type="submit" variante="secundario" carregando={pendente} textoCarregando="Salvando...">
          Salvar exceção
        </Botao>
      </div>
      <div className="col-span-2 @3xl/painel:col-span-4">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function BotaoRemoverPrecoRegiao({ id }: { id: string }) {
  const [estado, acao, pendente] = useActionState(removerPrecoRegiao, null);
  return (
    <form action={acao} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Botao type="submit" variante="texto" className="text-perigo" carregando={pendente} textoCarregando="Removendo...">
        Remover
      </Botao>
      {estado?.erro && <Retorno estado={estado} />}
    </form>
  );
}

export function BotaoCancelarDestaque({ id, texto = "Cancelar destaque" }: { id: string; texto?: string }) {
  const [estado, acao, pendente] = useActionState(cancelarDestaqueAdmin, null);
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <Botao variante="texto" className="text-perigo" onClick={() => setAberto(true)}>
        {texto}
      </Botao>
    );
  }
  return (
    <form action={acao} className="flex flex-col gap-2 rounded-card bg-perigo-fundo p-3">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm font-semibold text-perigo">
        Motivo do cancelamento
        <input name="motivo" maxLength={300} placeholder="ex.: pedido do vendedor" className={estiloCampo} />
      </label>
      <p className="text-legenda text-perigo">
        Se foi pago, a devolução do dinheiro é feita no Asaas. Se ainda não foi pago, a cobrança é apagada no Asaas.
      </p>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="perigo" carregando={pendente} textoCarregando="Cancelando...">
          Sim, cancelar
        </Botao>
        <Botao variante="secundario" onClick={() => setAberto(false)} disabled={pendente}>
          Voltar
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}
