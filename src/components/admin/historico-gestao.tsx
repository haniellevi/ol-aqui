import type { SupabaseClient } from "@supabase/supabase-js";
import { Aviso, Cartao } from "./ui";
import { quando } from "@/lib/admin/formato";

const rotulos: Record<string, string> = {
  editar: "Cadastro alterado", criar: "Cadastro criado", excluir: "Loja excluída", bloquear: "Acesso bloqueado", desbloquear: "Acesso liberado",
  email_solicitado: "Troca de e-mail solicitada", email_concluido: "E-mail alterado", senha_solicitada: "Troca de senha solicitada",
  senha_concluida: "Senha alterada", acesso_falhou: "Alteração de acesso não concluída",
};
export async function HistoricoGestao({ db, tipo, id }: { db: SupabaseClient; tipo: "usuario" | "loja"; id: string }) {
  const { data, error } = await db.from("admin_gestao_eventos").select("id,acao,motivo,autor,criado_em")
    .eq("tipo", tipo).eq("alvo", id).order("criado_em", { ascending: false }).limit(30);
  return <Cartao className="mt-6">
    <h2 className="text-lg font-semibold">Histórico de gestão</h2>
    {error ? <Aviso tipo="erro">Não foi possível carregar o histórico.</Aviso> : !data?.length ? <p className="mt-2 text-sm text-texto-suave">Nenhuma alteração registrada nesta área.</p> :
      <ol className="mt-3 divide-y divide-borda">{data.map(e => <li key={e.id} className="py-3 text-sm">
        <p className="font-semibold">{rotulos[e.acao] ?? e.acao} · {quando(e.criado_em)}</p>
        <p>{e.motivo}</p><p className="break-all text-texto-suave">Responsável: {e.autor}</p>
      </li>)}</ol>}
  </Cartao>;
}
