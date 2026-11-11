import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import { localidadesGestao } from "@/lib/admin/gestao-dados";
import type { LojaGestao } from "@/lib/admin/gestao";
import type { LojaAdmin } from "@/lib/tipos-cobranca";
import { ehUuid, linkLoja } from "@/lib/formato";
import { Aviso, Cartao, Titulo, estiloBotaoSec } from "@/components/admin/ui";
import { HistoricoGestao } from "@/components/admin/historico-gestao";
import { FormExcluirLoja, FormGestaoLoja } from "../gestao-formularios";
import { FormAcaoLoja } from "../formularios";

export const metadata = { title: "Gerenciar loja" };
export default async function Loja({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const [r, locais, planos, lista] = await Promise.all([
    supabase.rpc("admin_loja_detalhe", { p_id: id }), localidadesGestao(supabase),
    supabase.from("planos").select("codigo,nome").order("nome"),
    supabase.rpc("admin_lojas", { p_busca: id, p_limite: 1 }),
  ]);
  if (r.error || !locais) return <Aviso tipo="erro">Não foi possível abrir a loja. Recarregue para tentar novamente.</Aviso>;
  if (!r.data) notFound();
  const l = r.data as LojaGestao;
  const operacional = (lista.data as LojaAdmin[] | null)?.find(v => v.id === id);
  return <>
    <Link href="/admin/lojas" className="mb-4 inline-block text-sm font-semibold text-laranja-escuro">Voltar às lojas</Link>
    <Titulo sub={`${l.status} · Plano: ${l.plano} · Verificação: ${l.verificacao_estado}`}>{l.nome}</Titulo>
    <div className="mb-5 flex flex-wrap gap-2">
      {l.tipo === "loja" && <Link href={linkLoja(l.slug)} className={estiloBotaoSec}>Ver loja pública</Link>}
      <Link href={`/admin/usuarios/${l.dono_id}`} className={estiloBotaoSec}>Gerenciar titular</Link>
      <Link href={`/admin/anuncios?vitrine=${id}`} className={estiloBotaoSec}>Anúncios da loja</Link>
    </div>
    <FormGestaoLoja loja={l} locais={locais} />
    <Cartao className="mt-6"><h2 className="mb-4 text-lg font-semibold">Situação, plano e cortesia</h2>
      {operacional && !planos.error ? <FormAcaoLoja key={l.status + l.plano} loja={operacional} planos={planos.data ?? []} /> :
        <Link href={`/admin/lojas?q=${encodeURIComponent(l.nome)}`} className={estiloBotaoSec}>Abrir ações operacionais e verificação</Link>}
    </Cartao>
    <HistoricoGestao db={supabase} tipo="loja" id={id} />
    <FormExcluirLoja loja={l} />
  </>;
}
