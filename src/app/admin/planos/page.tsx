import { exigirAdmin } from "@/lib/admin/auth";
import { reais } from "@/lib/admin/formato";
import { Titulo } from "@/components/admin/ui";
import { FormPlano, type Plano } from "./form-plano";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Planos e preços" };

export default async function PlanosPage() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("planos").select("*").order("ordem");
  const planos = (data ?? []) as Plano[];

  return (
    <>
      <Titulo sub="Mudanças valem para novas assinaturas. Campos vazios em limite ou propostas significam ilimitado. Tudo fica registrado no histórico.">
        Planos e preços
      </Titulo>
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
