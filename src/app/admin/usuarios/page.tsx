import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { EMAIL, idsPeloEmail } from "@/lib/dados/equipe";
import { Aviso, Cartao, Titulo, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import type { UsuarioAdmin } from "@/lib/admin/gestao";
import { telefone } from "@/lib/formato";

export const metadata = { title: "Usuários" };
export default async function Usuarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim().slice(0, 120) : "";
  const pagina = Math.max(1, Math.min(100000, Number(p.pagina) || 1));
  const email = EMAIL.test(q), ids = email ? await idsPeloEmail(q) : null;
  const resultado = email && ids === null ? { data: null, error: true } : await supabase.rpc("admin_usuarios", {
    p_busca: email ? "" : q, p_pagina: Math.floor(pagina), p_ids: ids,
  });
  const dados = resultado.data as { total: number; itens: UsuarioAdmin[] } | null;
  const linkPagina = (n: number) => `/admin/usuarios?${new URLSearchParams({ q, pagina: String(n) })}`;
  return <>
    <Titulo sub="Encontre uma conta, altere o cadastro e gerencie os dados de acesso.">Usuários</Titulo>
    <form className="mb-5 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-semibold">Buscar por nome, e-mail, WhatsApp ou ID
        <input name="q" defaultValue={q} maxLength={120} className={estiloCampo} />
      </label><button className={estiloBotao}>Buscar</button>
    </form>
    {resultado.error ? <Aviso tipo="erro">Não foi possível consultar os usuários. Recarregue para tentar novamente.</Aviso> : <>
      <p className="mb-3 text-sm text-texto-suave">{dados?.total ?? 0} usuários encontrados</p>
      {!dados?.itens.length ? <Cartao>Nenhum usuário encontrado para esta busca.</Cartao> : <ul className="grid gap-3">
        {dados.itens.map(u => <li key={u.id}><Cartao className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><h2 className="font-semibold">{u.nome}</h2>
            <p className="text-sm text-texto-suave">{u.cidade || "Cidade não informada"} · {telefone(u.whatsapp) || "Sem WhatsApp"} · {u.bloqueado ? "Bloqueado" : "Acesso liberado"}</p>
          </div><Link href={`/admin/usuarios/${u.id}`} className={estiloBotaoSec}>Gerenciar usuário</Link>
        </Cartao></li>)}
      </ul>}
      <nav aria-label="Páginas de usuários" className="mt-4 flex justify-between gap-3">
        {pagina > 1 ? <Link href={linkPagina(pagina - 1)} className={estiloBotaoSec}>Anterior</Link> : <span />}
        {dados && pagina * 30 < dados.total && <Link href={linkPagina(pagina + 1)} className={estiloBotaoSec}>Próxima</Link>}
      </nav>
    </>}
  </>;
}
