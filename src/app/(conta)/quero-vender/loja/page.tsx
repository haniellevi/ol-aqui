import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { telefone } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { FormLoja } from "@/components/anunciar/form-loja";
import { testeGratis } from "../_dados";

export const metadata: Metadata = { title: "Criar minha loja" };

// T15 · Dados da loja. Pessoa física que já vende pode virar loja aqui sem perder os anúncios.
export default async function PaginaDadosLoja() {
  const conta = await meuPerfilEVitrine();
  if (!conta) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href="/quero-vender/loja" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </main>
    );
  }
  if (conta.vitrine?.tipo === "loja") redirect("/anunciar"); // já é loja (dados da loja ficam em Minha conta)

  const regiao = conta.perfil.microrregiao_id;
  const [cidades, teste] = await Promise.all([listarCidades(regiao), testeGratis(regiao)]);
  const sugerida = conta.vitrine?.cidade ?? conta.perfil.cidade ?? "";
  const cidadeInicial = !cidades.length || cidades.some((c) => c.nome === sugerida) ? sugerida : "";
  const planoPago = (conta.plano?.preco_centavos ?? 0) > 0;
  const avisoTeste = planoPago
    ? null
    : teste.dias
      ? `O teste grátis de ${teste.dias} dias começa assim que você criar a loja.${teste.limite != null ? ` Nele você pode ter até ${teste.limite} anúncios no ar.` : ""}`
      : "O teste grátis começa assim que você criar a loja.";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">Dados da loja</h1>
        <p className="text-base text-texto-suave">
          {conta.vitrine ? "Seus anúncios continuam no ar. " : ""}Você ganha uma vitrine com link próprio para divulgar.
        </p>
      </div>
      <FormLoja
        cidades={cidades.map((c) => ({ nome: c.nome, uf: c.uf }))}
        cidadeInicial={cidadeInicial}
        whatsappInicial={conta.perfil.whatsapp ? telefone(conta.perfil.whatsapp) : ""}
        nomeInicial=""
        avisoTeste={avisoTeste}
      />
    </main>
  );
}
