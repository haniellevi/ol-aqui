import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient as criar } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a sessão do usuário do Clerk (integração "third-party auth").
 * O token do Clerk vai em cada requisição; o banco lê o id pelo 'sub' (public.usuario_id())
 * e as regras de RLS valem normalmente. Visitante sem login usa o papel anon.
 */
// A integração da Vercel pode criar a chave pública com um destes dois nomes.
const chavePublica =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createClient() {
  return criar(process.env.NEXT_PUBLIC_SUPABASE_URL!, chavePublica!, {
    accessToken: tokenDoClerk,
  });
}

/**
 * Token do Clerk, ou null (visitante sem login). Endereços que o middleware não cobre (ex.: um
 * /favicon.ico ou .png inexistente, que cai na página "não encontrada") fazem o auth() do Clerk
 * lançar erro; aí a consulta seguia como erro do banco ("Não foi possível carregar sua região").
 * Sem token, o banco usa o papel anon, que tem menos acesso, então tratar como visitante é seguro.
 */
async function tokenDoClerk(): Promise<string | null> {
  try {
    return await (await auth()).getToken();
  } catch {
    return null;
  }
}
