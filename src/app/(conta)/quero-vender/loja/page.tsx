import { comAssistente, tentativaAssistente } from "@/lib/assistente";
import { Sparkles, PenLine } from "lucide-react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { telefone } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { Vazio } from "@/components/ui/vazio";
import { FormLoja } from "@/components/anunciar/form-loja";
import { testeGratis } from "../_dados";
import { createClient } from "@/lib/supabase/server";
import { abrirRascunho } from "./criar-com-ia/actions";

export const metadata: Metadata = { title: "Criar minha loja" };

// T15 · Dados da loja. Pessoa física que já vende pode virar loja aqui sem perder os anúncios.
export default async function PaginaDadosLoja({ searchParams }: { searchParams: Promise<{ manual?: string; assistente?: string; aviso?: string }> }) {
  const { manual, aviso, assistente: tentativa } = await searchParams;
  const assistente = tentativaAssistente(tentativa);
  const conta = await meuPerfilEVitrine();
  if (!conta) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href={comAssistente("/quero-vender/loja", assistente)} larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </main>
    );
  }
  if (conta.vitrine?.tipo === "loja") redirect(comAssistente("/anunciar", assistente)); // já é loja (dados da loja ficam em Minha conta)

  const db = await createClient();
  const { data: autorizado } = await db.rpc("loja_ia_piloto_autorizado");
  if (autorizado === true && manual !== "1") {
    return <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">Criar minha loja</h1>
        <p className="text-sm text-texto-suave">Escolha como preparar sua vitrine.</p>
      </div>
      {aviso === "ia" && <Aviso tipo="erro">Não foi possível abrir o cadastro com IA. Tente novamente ou use o formulário manual.</Aviso>}
      <section aria-labelledby="criar-loja-ia" className="flex flex-col gap-3 rounded-card border border-beringela bg-selecao p-4">
        <h2 id="criar-loja-ia" className="flex items-center gap-2 text-base font-semibold text-beringela">
          <Sparkles className="size-5" aria-hidden /> Criar com IA
        </h2>
        <p className="text-sm">Informe o nome e a cidade, adicione suas redes ou fotos e deixe o Merc preparar o rascunho. Você revisa os dados e as imagens antes de publicar.</p>
        <form action={abrirRascunho}><Botao type="submit" larguraTotal>Começar com IA</Botao></form>
      </section>
      <section aria-labelledby="criar-loja-manual" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
        <h2 id="criar-loja-manual" className="flex items-center gap-2 text-base font-semibold text-beringela">
          <PenLine className="size-4" aria-hidden /> Preencher manualmente
        </h2>
        <Botao href={comAssistente("/quero-vender/loja?manual=1", assistente)} variante="secundario" larguraTotal>Abrir formulário</Botao>
      </section>
      <Botao href="/minha-conta/lojas" variante="texto">Agora não</Botao>
    </main>;
  }
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
        assistente={assistente}
      />
    </main>
  );
}
