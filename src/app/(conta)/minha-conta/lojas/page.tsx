import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { ExcluirLoja, LojaNaLixeira } from "@/components/conta/excluir-loja";
import { EncerrarAcesso } from "@/components/conta/encerrar-acesso";
import { formatarNome } from "@/lib/formatar-nome";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { Vazio } from "@/components/ui/vazio";
import { escolherLoja } from "@/app/(conta)/_loja/actions";
import type { RascunhoLoja } from "@/lib/loja-ia/tipos";

export const metadata: Metadata = { title: "Minhas lojas" };
export type LojaDaConta = { id: string; nome: string; dono: boolean };

export default async function MinhasLojas() {
  const db = await createClient();
  const conta = await meuPerfilEVitrine(true);
  const pf = conta?.vitrine?.tipo === "pf";
  const { data: exclusao, error: erroExclusao } = pf ? await db.rpc("minha_loja_exclusao") : { data: null, error: null };
  const [{ data, error }, { data: rascunhoDados, error: erroRascunho }] = await Promise.all([db.rpc("minhas_lojas"), db.rpc("loja_ia_obter")]);
  const rascunho = rascunhoDados?.id && rascunhoDados?.entrada ? rascunhoDados as RascunhoLoja : null;
  const lojas = (data ?? []) as LojaDaConta[];
  return (
    <PaginaConta>
      <TopoConta titulo="Minhas lojas" texto="Encontre sua loja e as vitrines que você ajuda a gerenciar." />
      {pf && <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Minha vitrine de vendedor</h2>
        {erroExclusao ? <Aviso tipo="erro">Não foi possível carregar sua vitrine. Atualize a página.</Aviso>
          : exclusao?.na_lixeira ? <LojaNaLixeira apagarApos={exclusao.apagar_apos} podeRestaurar={exclusao.pode_restaurar === true} pf />
          : <ExcluirLoja temPagamentos={exclusao?.tem_pagamentos === true} pf />}
      </section>}
      {erroRascunho && <Aviso tipo="erro">Não foi possível verificar seu rascunho. Atualize a página para tentar novamente.</Aviso>}
      {rascunho && <section className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
        <div><h2 className="text-lg font-semibold">{rascunho.entrada.nome ? `Rascunho de ${formatarNome(rascunho.entrada.nome)}` : "Rascunho da loja"}</h2>
          <p className="text-sm text-texto-suave">{rascunho.estado === "coleta" ? "Continue preenchendo as informações." : rascunho.estado === "processando" ? "Estamos preparando seu rascunho." : "Seu rascunho está pronto para revisão."}</p></div>
        <Botao href="/quero-vender/loja/criar-com-ia" tamanho="acao">{rascunho.estado === "coleta" ? "Continuar cadastro" : "Abrir rascunho"}</Botao>
        <EncerrarAcesso id={rascunho.id} revisao={rascunho.revisao} />
      </section>}
      {error ? <Aviso tipo="erro">Não foi possível carregar suas lojas. Atualize a página para tentar novamente.</Aviso>
        : lojas.length ? (
          <ul className="grid gap-3">
            {lojas.map((loja) => (
              <li key={loja.id} className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
                <div>
                  <h2 className="text-lg font-semibold break-words">{formatarNome(loja.nome)}</h2>
                  <p className="text-sm text-texto-suave">{loja.dono ? "Sua loja" : "Você é gerente"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* A Minha loja segue a loja escolhida: o botão escolhe a própria antes de abrir. */}
                  {loja.dono && (
                    <form action={escolherLoja}>
                      <input type="hidden" name="loja" value={loja.id} />
                      <input type="hidden" name="voltar" value="/minha-conta/loja" />
                      <Botao type="submit" variante="secundario">Editar minha loja</Botao>
                    </form>
                  )}
                  {!loja.dono && (
                    <form action={escolherLoja}>
                      <input type="hidden" name="loja" value={loja.id} />
                      <input type="hidden" name="voltar" value="/minha-conta/anuncios" />
                      <Botao type="submit" variante="secundario">Cuidar dos anúncios</Botao>
                    </form>
                  )}
                  {loja.dono && <Botao href={`/minha-conta/lojas/${loja.id}`} variante="secundario">Gerenciar equipe</Botao>}
                </div>
                {!loja.dono && <EncerrarAcesso id={loja.id} gerenciar />}
              </li>
            ))}
          </ul>
        ) : !rascunho && !pf ? (
          <Vazio titulo="Você ainda não tem lojas aqui" texto="Quando você abrir uma loja ou aceitar um convite para gerenciar uma vitrine, ela aparece aqui.">
            <Botao href="/quero-vender/loja">Abrir minha loja</Botao>
          </Vazio>
        ) : null}
    </PaginaConta>
  );
}
