import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { Vazio } from "@/components/ui/vazio";
import { escolherLoja } from "@/app/(conta)/_loja/actions";

export const metadata: Metadata = { title: "Minhas lojas" };
export type LojaDaConta = { id: string; nome: string; dono: boolean };

export default async function MinhasLojas() {
  const db = await createClient();
  const { data, error } = await db.rpc("minhas_lojas");
  const lojas = (data ?? []) as LojaDaConta[];
  return (
    <PaginaConta>
      <TopoConta titulo="Minhas lojas" texto="Encontre sua loja e as vitrines que você ajuda a gerenciar." />
      {error ? <Aviso tipo="erro">Não foi possível carregar suas lojas. Atualize a página para tentar novamente.</Aviso>
        : lojas.length ? (
          <ul className="grid gap-3">
            {lojas.map((loja) => (
              <li key={loja.id} className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
                <div>
                  <h2 className="text-lg font-semibold break-words">{loja.nome}</h2>
                  <p className="text-sm text-texto-suave">{loja.dono ? "Sua loja" : "Você é gerente"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {loja.dono && <Botao href="/minha-conta/loja">Editar minha loja</Botao>}
                  {!loja.dono && (
                    <form action={escolherLoja}>
                      <input type="hidden" name="loja" value={loja.id} />
                      <input type="hidden" name="voltar" value="/minha-conta/anuncios" />
                      <Botao type="submit">Cuidar dos anúncios</Botao>
                    </form>
                  )}
                  <Botao href={`/minha-conta/lojas/${loja.id}`} variante="secundario">
                    {loja.dono ? "Gerenciar equipe" : "Editar informações da vitrine"}
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio titulo="Você ainda não tem lojas aqui" texto="Quando você abrir uma loja ou aceitar um convite para gerenciar uma vitrine, ela aparece aqui.">
            <Botao href="/quero-vender/loja">Abrir minha loja</Botao>
          </Vazio>
        )}
    </PaginaConta>
  );
}
