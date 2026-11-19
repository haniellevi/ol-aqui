import { exigirAdmin, eSuperAdmin } from "@/lib/admin/auth";
import { reais } from "@/lib/admin/formato";
import { Titulo } from "@/components/admin/ui";
import { FormPlano, type Plano } from "./form-plano";
import { FormVoucher, type CampanhaVoucher } from "./vouchers";
import { FormPromocional } from "./promocional";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Planos e preços" };

export default async function PlanosPage() {
  const { supabase } = await exigirAdmin();
  const [master, { data }] = await Promise.all([
    eSuperAdmin(supabase),
    supabase.from("planos").select("*").order("ordem"),
  ]);
  const linhas = (data ?? []) as Plano[];
  const promocional = linhas.find((p) => p.codigo === "promocional");
  const planos = linhas.filter((p) => p.codigo !== "promocional");
  const { data: campanhas, error: erroCampanhas } = master
    ? await supabase.from("voucher_campanhas").select("id,codigo,valido_ate,duracao_dias,ativo").order("criado_em", { ascending: false })
    : { data: null, error: null };
  if (erroCampanhas) throw new Error("Não foi possível consultar os cupons.");

  return (
    <>
      <Titulo sub="Mudanças nos planos comerciais valem para novas assinaturas. As permissões do Promocional mudam também para quem já tem acesso. Campos vazios em limite ou propostas significam ilimitado. Tudo fica registrado no histórico.">
        Planos e preços
      </Titulo>
      {master && <div className="mb-5 grid gap-5">
        {promocional && <FormPromocional plano={promocional} />}
        <section className="space-y-3" aria-labelledby="titulo-cupons">
          <h2 id="titulo-cupons" className="text-lg font-semibold text-beringela">Cupons promocionais</h2>
          <p className="text-base text-texto-suave">Compartilhe o código com quem pode usar. Cada cupom tem sua duração. Alterar a duração ou desativar o cupom mantém os prazos de quem já ativou.</p>
          <FormVoucher />
          {((campanhas ?? []) as CampanhaVoucher[]).map((campanha) => <FormVoucher key={campanha.id} campanha={campanha} />)}
        </section>
      </div>}
      <div className="space-y-4">
        {planos.map((p) => (
          <details key={p.codigo} className="rounded-card border border-borda bg-cartao p-4">
            <summary className="min-h-toque cursor-pointer font-semibold text-beringela">
              <span className="mr-3">{p.nome}</span>
              {p.e_teste && <Badge variant="warning">teste grátis</Badge>}
              {!p.ativo && <Badge variant="secondary">inativo</Badge>}
              {p.recomendado && <Badge variant="default">recomendado</Badge>}
              <span className="ml-3 text-sm font-semibold text-beringela">
                {p.preco_centavos ? `${reais(p.preco_centavos)} / ${p.periodo_dias} dias` : "Grátis"}
              </span>
            </summary>
            <div className="mt-4"><FormPlano plano={p} /></div>
          </details>
        ))}
        <details className="rounded-card border border-dashed border-borda bg-cartao p-4">
          <summary className="min-h-toque cursor-pointer font-semibold text-beringela">Criar plano</summary>
          <div className="mt-4"><FormPlano /></div>
        </details>
      </div>
    </>
  );
}
