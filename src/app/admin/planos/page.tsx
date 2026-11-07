import { exigirAdmin } from "@/lib/admin/auth";
import { reais } from "@/lib/admin/formato";
import { Cartao, Titulo } from "@/components/admin/ui";
import { FormPlano, type Plano } from "./form-plano";

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
          <Cartao key={p.codigo}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-beringela">{p.nome}</h2>
              <span className="rounded-full bg-fundo px-2 py-0.5 text-[13px] text-texto-suave">{p.codigo}</span>
              {p.e_teste && <span className="rounded-full bg-aviso-fundo px-2 py-0.5 text-[13px] font-semibold text-aviso">teste grátis</span>}
              {!p.ativo && <span className="rounded-full bg-borda px-2 py-0.5 text-[13px] font-semibold text-texto-suave">inativo</span>}
              <span className="ml-auto text-sm font-semibold text-beringela">
                {p.preco_centavos ? `${reais(p.preco_centavos)} / ${p.periodo_dias} dias` : "Grátis"}
              </span>
            </div>
            <FormPlano plano={p} />
          </Cartao>
        ))}
        <Cartao className="border-dashed">
          <h2 className="mb-3 text-lg font-semibold text-beringela">Novo plano</h2>
          <FormPlano />
        </Cartao>
      </div>
    </>
  );
}
