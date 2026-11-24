import { comAssistente, linkAssistente, tentativaAssistente } from "@/lib/assistente";
import { ArrowLeft, Sparkles, PenLine } from "lucide-react";
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

  const volta = assistente ? linkAssistente("loja", assistente) : conta.vitrine ? "/anunciar" : "/quero-vender";
  const textoVolta = assistente ? "Voltar ao assistente" : conta.vitrine ? "Voltar ao anúncio" : "Como vender";
  const db = await createClient();
  const { data: autorizado } = await db.rpc("loja_ia_piloto_autorizado");
  if (autorizado === true && manual !== "1") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-4 sm:px-6 sm:py-7">
        <Botao href={volta} variante="texto" tamanho="toque" icone={<ArrowLeft />} className="-ml-3">{textoVolta}</Botao>
        <h1 className="text-titulo leading-tight font-semibold text-beringela">Criar minha loja</h1>
        {aviso === "ia" && <Aviso tipo="erro">Não foi possível abrir o cadastro com IA. Tente novamente ou preencha manualmente.</Aviso>}
        <div className="w-full divide-y divide-borda rounded-card border border-borda bg-cartao">
          <section aria-labelledby="criar-loja-ia" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
              <div>
                <h2 id="criar-loja-ia" className="text-lg font-semibold text-beringela">Rascunho com a Lia</h2>
                <p className="mt-0.5 text-sm text-texto-suave">A Lia usa suas informações para montar a vitrine. Você revisa tudo antes de publicar.</p>
              </div>
            </div>
            <form action={abrirRascunho.bind(null, assistente)} className="sm:w-48 sm:shrink-0">
              <Botao type="submit" tamanho="toque" className="w-full">Começar com IA</Botao>
            </form>
          </section>
          <section aria-labelledby="criar-loja-manual" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <PenLine className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
              <div>
                <h2 id="criar-loja-manual" className="text-lg font-semibold text-beringela">Cadastro manual</h2>
                <p className="mt-0.5 text-sm text-texto-suave">Preencha os dados da vitrine e crie a loja na hora.</p>
              </div>
            </div>
            <Botao href={comAssistente("/quero-vender/loja?manual=1", assistente)} variante="secundario" tamanho="toque" className="w-full sm:w-48 sm:shrink-0">Abrir formulário</Botao>
          </section>
        </div>
        <Botao href="/minha-conta/lojas" variante="texto" tamanho="toque" className="-ml-3">Agora não</Botao>
      </main>
    );
  }
  const regiao = conta.perfil.microrregiao_id;
  const [cidades, teste] = await Promise.all([listarCidades(regiao), testeGratis(regiao)]);
  const sugerida = conta.vitrine?.cidade ?? conta.perfil.cidade ?? "";
  const cidadeInicial = !cidades.length || cidades.some((c) => c.nome === sugerida) ? sugerida : "";
  const planoPago = (conta.plano?.preco_centavos ?? 0) > 0;
  const avisoTeste = planoPago
    ? null
    : teste.dias
      ? `Seu teste grátis de ${teste.dias} dias começa ao criar a loja.${teste.limite != null ? ` Até ${teste.limite} anúncios no ar.` : ""}`
      : "O teste grátis começa assim que você criar a loja.";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-4 sm:px-6 sm:py-7">
      <Botao
        href={autorizado === true ? comAssistente("/quero-vender/loja", assistente) : volta}
        variante="texto" tamanho="toque" icone={<ArrowLeft />} className="-ml-3 self-start"
      >
        {autorizado === true ? "Opções de cadastro" : textoVolta}
      </Botao>
      <FormLoja
        cidades={cidades.map((c) => ({ nome: c.nome, uf: c.uf }))}
        cidadeInicial={cidadeInicial}
        whatsappInicial={conta.perfil.whatsapp ? telefone(conta.perfil.whatsapp) : ""}
        nomeInicial=""
        manterAnuncios={Boolean(conta.vitrine)}
        avisoTeste={avisoTeste}
        assistente={assistente}
      />
    </main>
  );
}
