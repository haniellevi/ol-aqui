import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secreta (ignora RLS). Só para o servidor: webhook do Clerk,
 * webhook do Asaas e sincronização de perfil. Nunca importe em componente de cliente.
 */
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("Falta SUPABASE_SECRET_KEY no servidor.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
