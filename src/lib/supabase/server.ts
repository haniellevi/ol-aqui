import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient as criar } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a sessão do usuário do Clerk (integração "third-party auth").
 * O token do Clerk vai em cada requisição; o banco lê o id pelo 'sub' (public.usuario_id())
 * e as regras de RLS valem normalmente. Visitante sem login usa o papel anon.
 */
export async function createClient() {
  return criar(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    accessToken: async () => (await auth()).getToken(),
  });
}
