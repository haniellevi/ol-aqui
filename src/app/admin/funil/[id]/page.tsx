import { notFound } from "next/navigation";
import { exigirTela } from "@/lib/admin/equipe";
import { quando } from "@/lib/admin/formato";
import { ehUuid } from "@/lib/formato";
import type { LojistaFunil, NotaFunil } from "@/lib/admin/funil";
import { Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { carregarOpcoes } from "../dados";
import { BotaoApagarLojista, BotaoApagarNota, FormLojista, NovaNota } from "../formularios";

export const metadata = { title: "Contato · Funil" };
export const dynamic = "force-dynamic";

export default async function ContatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { supabase } = await exigirTela("funil");
  const [lojistaR, notasR, opcoes] = await Promise.all([
    supabase.from("funil_lojistas").select("*, vitrines_lojas(slug, nome, plano, status)").eq("id", id).maybeSingle(),
    supabase.from("funil_notas").select("id, texto, automatica, autor_id, criado_em, perfis(nome)").eq("lojista_id", id).order("criado_em", { ascending: false }).limit(100),
    carregarOpcoes(supabase),
  ]);
  if (!lojistaR.data) notFound();
  const lojista = lojistaR.data as LojistaFunil & { vitrines_lojas: { slug: string; nome: string; plano: string; status: string } | null };
  const notas = ((notasR.data ?? []) as unknown as (NotaFunil & { perfis: { nome: string } | { nome: string }[] | null })[]).map((n) => ({
    ...n,
    perfis: Array.isArray(n.perfis) ? n.perfis[0] ?? null : n.perfis,
  }));
  const loja = Array.isArray(lojista.vitrines_lojas) ? lojista.vitrines_lojas[0] : lojista.vitrines_lojas;

  return (
    <>
      <Botao href="/admin/funil" variante="texto" tamanho="pequeno">← Funil de lojistas</Botao>
      <Titulo sub={loja ? <>Tem loja no site: <a className="text-laranja-escuro underline-offset-4 hover:underline" href={`/loja/${loja.slug}`} target="_blank" rel="noopener noreferrer">{loja.nome}</a> (plano {loja.plano}{loja.status !== "ativa" ? `, ${loja.status}` : ""}).</> : "Ainda não tem loja no site. Quando se cadastrar com este WhatsApp, a ficha se liga sozinha."}>
        {lojista.nome_loja}
      </Titulo>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Cartao>
          <FormLojista lojista={lojista} opcoes={opcoes} />
        </Cartao>
        <Cartao>
          <h2 className="mb-2 text-xl font-semibold text-beringela">Anotações</h2>
          <NovaNota id={lojista.id} />
          <ol className="mt-4 space-y-3">
            {notas.map((n) => (
              <li key={n.id} className={`border-l-2 pl-3 ${n.automatica ? "border-borda" : "border-laranja"}`}>
                <p className={`whitespace-pre-wrap text-sm [overflow-wrap:anywhere] ${n.automatica ? "text-texto-suave" : "text-beringela"}`}>{n.texto}</p>
                <div className="flex flex-wrap items-center gap-2 text-legenda text-texto-suave">
                  <span>{quando(n.criado_em)}{n.perfis?.nome ? ` · ${n.perfis.nome}` : ""}</span>
                  {!n.automatica && <BotaoApagarNota id={lojista.id} nota={n.id} />}
                </div>
              </li>
            ))}
            {notas.length === 0 && <li className="text-sm text-texto-suave">Nenhuma anotação ainda.</li>}
          </ol>
        </Cartao>
      </div>
      <div className="mt-6"><BotaoApagarLojista id={lojista.id} nome={lojista.nome_loja} /></div>
    </>
  );
}
