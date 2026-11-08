import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { lerRegioes } from "@/lib/admin/cadastros";
import { inteiro } from "@/lib/admin/formato";
import { linkAdminRegiao, LINK_ADMIN_REGIOES } from "@/lib/rotas";
import { Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { FormNovaRegiao } from "./formularios";

export const metadata = { title: "Regiões e cidades" };

// Tela 7 · Regiões e cidades: lista das microrregiões com sede e números, e "Nova região".
export default async function RegioesPage() {
  const { supabase } = await exigirAdmin();
  const { regioes, falhou } = await lerRegioes(supabase);

  return (
    <>
      <Titulo sub="Cada região junta cidades de qualquer estado. Cidade com anúncios não é apagada: você desativa e ela some das listas. Toda mudança fica no histórico.">
        Regiões e cidades
      </Titulo>

      <div className="space-y-4">
        {falhou && !regioes.length ? (
          <Vazio titulo="Não conseguimos abrir as regiões" texto="Confira a internet e tente de novo.">
            <Botao href={LINK_ADMIN_REGIOES} variante="secundario" larguraTotal>
              Tentar de novo
            </Botao>
          </Vazio>
        ) : !regioes.length ? (
          <Vazio titulo="Nenhuma região ainda" texto="Crie a primeira região logo abaixo, com a cidade-sede." icone={<MapPin />} />
        ) : (
          <ul className="space-y-3">
            {regioes.map((r) => (
              <li key={r.id}>
                <Link
                  href={linkAdminRegiao(r.id)}
                  className="flex min-h-12 items-center gap-3 rounded-card border border-borda bg-cartao p-4 shadow-1 active:brightness-95 md:hover:bg-fundo"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-laranja-claro text-beringela" aria-hidden>
                    <MapPin className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-beringela">{r.nome}</span>
                    <span className="block text-[13px] text-texto-suave">
                      Sede: {r.cidade_sede ?? "sem sede"} · {inteiro(r.cidades_ativas)} de {inteiro(r.cidades_total)} cidades ativas
                    </span>
                    <span className="block text-[13px] text-texto-suave">
                      {inteiro(r.lojas)} {r.lojas === 1 ? "loja" : "lojas"} · {inteiro(r.vendedores_pf)} {r.vendedores_pf === 1 ? "pessoa vendendo" : "pessoas vendendo"} ·{" "}
                      {inteiro(r.anuncios_ativos)} {r.anuncios_ativos === 1 ? "anúncio no ar" : "anúncios no ar"} · {inteiro(r.pessoas)}{" "}
                      {r.pessoas === 1 ? "conta" : "contas"}
                    </span>
                  </span>
                  <span className="hidden text-sm font-semibold text-laranja-escuro md:inline">Abrir</span>
                  <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Cartao className="border-dashed">
          <h2 className="mb-1 text-lg font-semibold text-beringela">Nova região</h2>
          <p className="mb-3 text-sm text-texto-suave">Depois de criar, você adiciona as outras cidades (de qualquer estado).</p>
          <FormNovaRegiao />
        </Cartao>
      </div>
    </>
  );
}
