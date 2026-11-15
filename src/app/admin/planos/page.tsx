import { exigirAdmin } from "@/lib/admin/auth";
import { reais } from "@/lib/admin/formato";
import { Titulo } from "@/components/admin/ui";
import { FormPlano, type Plano } from "./form-plano";
import { FormVoucher, type CampanhaVoucher } from "./vouchers";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Planos e preços" };

export default async function PlanosPage() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("planos").select("*").order("ordem");
  const planos = (data ?? []) as Plano[];
  const { data: campanhas, error: erroCampanhas } = await supabase.from("voucher_campanhas").select("id,codigo,valido_ate,ativo").order("criado_em", { ascending: false });
  if (erroCampanhas) throw new Error("Não foi possível consultar os cupons.");

  return (
    <>
      <Titulo sub="Mudanças valem para novas assinaturas. Campos vazios em limite ou propostas significam ilimitado. Tudo fica registrado no histórico.">
        Planos e preços
      </Titulo>
      <section className="mb-6 space-y-3" aria-labelledby="titulo-cupons">
        <h2 id="titulo-cupons" className="text-lg font-bold">Cupons de lançamento</h2>
        <p className="text-sm text-texto-suave">As lojas existentes e as novas recebem os cupons ativos. O código concede três meses do plano completo; a validade limita a data de resgate.</p>
        {(campanhas as CampanhaVoucher[] ?? []).map((campanha) => <FormVoucher key={campanha.id} campanha={campanha} />)}
        <FormVoucher />
      </section>
      <div className="space-y-4">
        {planos.map((p) => (
          <details key={p.codigo} className="rounded-card border border-borda bg-cartao p-4">
            <summary className="min-h-10 cursor-pointer font-semibold text-beringela">
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
          <summary className="cursor-pointer font-semibold text-beringela">Criar plano</summary>
          <div className="mt-4"><FormPlano /></div>
        </details>
      </div>
    </>
  );
}
