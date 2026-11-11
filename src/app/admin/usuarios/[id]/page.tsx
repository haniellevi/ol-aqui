import Link from "next/link";
import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { exigirAdmin } from "@/lib/admin/auth";
import { localidadesGestao } from "@/lib/admin/gestao-dados";
import { idUsuarioValido, type UsuarioAdmin } from "@/lib/admin/gestao";
import { Aviso, Cartao, Titulo, estiloBotaoSec } from "@/components/admin/ui";
import { HistoricoGestao } from "@/components/admin/historico-gestao";
import { FormAcessoUsuario, FormBloqueioUsuario, FormUsuario } from "../formularios";
import { FormLixeiraConta } from "../../lixeira/formularios";
import type { Lixeira } from "@/lib/admin/lixeira";

export const metadata = { title: "Gerenciar usuário" };
export default async function Usuario({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await exigirAdmin();
  const { id } = await params;
  if (!idUsuarioValido(id)) notFound();
  const [r, locais, lixeiraR] = await Promise.all([supabase.rpc("admin_usuario", { p_id: id }), localidadesGestao(supabase), supabase.rpc("admin_lixeira")]);
  const naLixeira = (lixeiraR.data as Lixeira | null)?.contas.find(c => c.id === id) ?? null;
  if (r.error || !locais) return <Aviso tipo="erro">Não foi possível abrir o cadastro. Recarregue para tentar novamente.</Aviso>;
  if (!r.data) notFound();
  const u = r.data as UsuarioAdmin;
  let email: string | null = null, acessoDisponivel = false;
  try {
    const c = await (await clerkClient()).users.getUser(id);
    email = c.emailAddresses.find(e => e.id === c.primaryEmailAddressId)?.emailAddress ?? null;
    acessoDisponivel = true;
  } catch { /* A edição do cadastro funciona mesmo se o provedor de login estiver indisponível. */ }
  return <>
    <Link href="/admin/usuarios" className="mb-4 inline-block text-sm font-semibold text-laranja-escuro">Voltar aos usuários</Link>
    <Titulo sub={<span className="break-all">{u.id} · {naLixeira ? "Na lixeira" : u.bloqueado ? "Conta suspensa" : "Acesso liberado"}</span>}>{u.nome}</Titulo>
    <div className="mb-5 flex flex-wrap gap-2">
      {u.loja_id && <Link href={`/admin/lojas/${u.loja_id}`} className={estiloBotaoSec}>Gerenciar {u.loja_nome || "loja"}</Link>}
      <Link href="/admin/equipe" className={estiloBotaoSec}>Equipe e permissões</Link>
    </div>
    {u.revogado && <Aviso tipo="erro">Esta conta foi excluída. Os dados remanescentes são preservados para consulta.</Aviso>}
    <Cartao><FormUsuario usuario={u} locais={locais} /></Cartao>
    {!u.revogado && <>
      {acessoDisponivel ? <FormAcessoUsuario id={u.id} email={email} /> : <div className="mt-4"><Aviso tipo="erro">Os dados de login estão indisponíveis ou a conta já foi removida no provedor. A edição de e-mail e senha ficará disponível quando a consulta funcionar.</Aviso></div>}
      {!naLixeira && <FormBloqueioUsuario id={u.id} bloqueado={u.bloqueado} />}
      {!u.bloqueado && !lixeiraR.error && <FormLixeiraConta id={u.id} naLixeira={!!naLixeira} apagarApos={naLixeira?.apagar_apos ?? null} />}
    </>}
    <HistoricoGestao db={supabase} tipo="usuario" id={id} />
  </>;
}
