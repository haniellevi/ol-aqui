import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { lerRegiao } from "@/lib/admin/cadastros";
import { inteiro } from "@/lib/admin/formato";
import { textoUso } from "@/lib/admin/regras-cadastros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_REGIOES, linkAdminRegiao } from "@/lib/rotas";
import { Cartao, Titulo, estiloBotaoDiscreto } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { AcoesCidade, BotaoApagarRegiao, FormAdicionarCidade, FormRegiao } from "../formularios";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Região" };

// Tela 7 · Uma região: nome, sede, repasse (a definir), cidades (ativar/desativar/remover/adicionar).
export default async function RegiaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { supabase } = await exigirAdmin();
  const { regiao, cidades, falhou } = await lerRegiao(supabase, id);

  if (!regiao) {
    if (!falhou) notFound();
    return (
      <Vazio titulo="Não conseguimos abrir esta região" texto="Confira a internet e tente de novo.">
        <Botao href={linkAdminRegiao(id)} variante="secundario" larguraTotal>
          Tentar de novo
        </Botao>
        <Botao href={LINK_ADMIN_REGIOES} variante="discreto">
          Voltar para as regiões
        </Botao>
      </Vazio>
    );
  }

  // UF mais comum da região: vem marcado ao adicionar cidade
  const contagemUf = new Map<string, number>();
  for (const c of cidades) contagemUf.set(c.uf, (contagemUf.get(c.uf) ?? 0) + 1);
  const ufPadrao = [...contagemUf.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "PI";
  const vazia = regiao.pessoas === 0 && regiao.lojas === 0 && regiao.vendedores_pf === 0 && regiao.anuncios_total === 0;

  return (
    <>
      <Link href={LINK_ADMIN_REGIOES} className={`${estiloBotaoDiscreto} mb-3`}>
        <ArrowLeft className="size-5" aria-hidden />
        Todas as regiões
      </Link>
      <Titulo
        sub={`${inteiro(regiao.cidades_ativas)} de ${inteiro(regiao.cidades_total)} cidades ativas · ${inteiro(regiao.anuncios_ativos)} anúncios no ar · ${inteiro(regiao.lojas)} lojas · ${inteiro(regiao.pessoas)} contas`}
      >
        {regiao.nome}
      </Titulo>

      <div className="space-y-4">
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold text-beringela">Dados da região</h2>
          <FormRegiao regiao={regiao} cidades={cidades} />
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-lg font-semibold text-beringela">Cidades</h2>
          <p className="mb-3 text-sm text-texto-suave">
            Cidade desativada some das listas (cadastro, busca, Radar). Os anúncios e lojas dela continuam como estão.
          </p>
          {cidades.length ? (
            <ul className="divide-y divide-borda">
              {cidades.map((c) => {
                const uso = textoUso(c);
                return (
                  <li key={c.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-beringela">
                        {c.nome}-{c.uf}
                        {c.e_sede && <Badge variant="default">sede</Badge>}
                        {!c.ativa && <Badge variant="secondary">desativada</Badge>}
                      </p>
                      <p className="text-legenda text-texto-suave">{uso || "Sem anúncios, lojas nem pessoas"}</p>
                    </div>
                    <AcoesCidade cidade={c} regiaoId={regiao.id} uso={uso} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio titulo="Nenhuma cidade nesta região" texto="Adicione a primeira cidade logo abaixo." icone={<Building2 />} />
          )}
          <div className="mt-4 border-t border-borda pt-4">
            <h3 className="mb-2 text-base font-semibold text-beringela">Adicionar cidade</h3>
            <FormAdicionarCidade regiaoId={regiao.id} ufPadrao={ufPadrao} />
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-lg font-semibold text-beringela">Apagar região</h2>
          {vazia ? (
            <>
              <p className="mb-3 text-sm text-texto-suave">Esta região ainda não tem contas, lojas nem anúncios. Apagar leva as cidades junto.</p>
              <BotaoApagarRegiao regiao={regiao} />
            </>
          ) : (
            <p className="text-sm text-texto-suave">
              Não dá para apagar: a região já tem contas, lojas ou anúncios. Para tirar cidades das listas, desative as cidades.
            </p>
          )}
        </Cartao>
      </div>
    </>
  );
}
