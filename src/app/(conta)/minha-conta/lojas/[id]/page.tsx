import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { FormInformacoes, type DadosInformacoes } from "@/components/vitrine/form-informacoes";
import { FormConvidarGerente, FormRevogarGerente } from "../equipe";
import { salvarVitrineGerenciada } from "../actions";
import type { LojaDaConta } from "../page";

export const metadata: Metadata = { title: "Gerenciar loja" };
type DadosGerente = Omit<DadosInformacoes, "instagram" | "formas_pagamento">;
type Convite = { id: string; final_telefone: string; expira_em: string; gerente: string | null };
const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function GerenciarLoja({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const db = await createClient();
  const { data, error } = await db.rpc("minhas_lojas");
  if (error) throw new Error("Não foi possível carregar suas lojas.");
  const loja = ((data ?? []) as LojaDaConta[]).find((v) => v.id === id);
  if (!loja) notFound();
  const voltar = "/minha-conta/lojas";

  if (!loja.dono) {
    const { data: dados, error: erroDados } = await db.rpc("dados_loja_gerenciada", { p_loja: id }).maybeSingle<DadosGerente>();
    if (erroDados) throw new Error("Não foi possível carregar as informações da vitrine.");
    if (!dados) notFound();
    return (
      <PaginaConta>
        <TopoConta titulo={loja.nome} texto="Edite endereço, horários, descrição e entrega da vitrine." voltar={voltar} textoVoltar="Minhas lojas" />
        <FormInformacoes dados={{ ...dados, instagram: null, formas_pagamento: [] }}
          formasDoPainel={[]} salvarComoGerente={salvarVitrineGerenciada.bind(null, id)} />
      </PaginaConta>
    );
  }

  const { data: equipe, error: erroEquipe } = await db.rpc("equipe_minha_loja", { p_loja: id });
  const convites = (equipe ?? []) as Convite[];
  return (
    <PaginaConta>
      <TopoConta titulo={`Equipe de ${loja.nome}`} voltar={voltar} textoVoltar="Minhas lojas"
        texto="Gerentes podem editar endereço, horários, descrição e entrega. O dono cuida dos acessos, do plano e da cobrança." />
      <FormConvidarGerente loja={id} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Gerentes e convites</h2>
        {erroEquipe ? <Aviso tipo="erro">Não foi possível carregar a equipe.</Aviso> : convites.length ? (
          <ul className="grid gap-2">
            {convites.map((c) => (
              <li key={c.id} className="rounded-card border border-borda bg-cartao p-4">
                <p className="font-semibold break-words">{c.gerente ?? `WhatsApp final ${c.final_telefone}`}</p>
                <p className="text-sm text-texto-suave">{c.gerente ? "Gerente ativo" : `Convite pendente até ${dataCurta.format(new Date(c.expira_em))}`}</p>
                <FormRevogarGerente loja={id} convite={c.id} aceito={c.gerente !== null} />
              </li>
            ))}
          </ul>
        ) : <p className="text-texto-suave">Sua loja ainda não tem gerentes ou convites pendentes.</p>}
      </section>
    </PaginaConta>
  );
}
