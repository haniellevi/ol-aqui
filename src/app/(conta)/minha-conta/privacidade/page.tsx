import type { Metadata } from "next";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { classesBotao } from "@/components/ui/botao";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { ExcluirConta } from "@/components/conta/excluir-conta";
import { ApagarConversasAki } from "@/components/aki/apagar-conversas";

export const metadata: Metadata = { title: "Privacidade" };

// T37 · Privacidade (LGPD): baixar meus dados e excluir minha conta.
export default async function PaginaPrivacidade() {
  const conta = await meuPerfilEVitrine();
  const vitrineId = conta?.vitrine?.id;
  const conversasAki = await seguro(async () => {
    const db = await createClient();
    const { count } = await db.from("robo_conversas").select("id", { count: "exact", head: true });
    return count ?? 0;
  }, 0);
  const temPagamentos = vitrineId
    ? await seguro(async () => {
        const db = await createClient();
        const { count } = await db.from("pagamentos").select("id", { count: "exact", head: true }).eq("vitrine_id", vitrineId);
        return (count ?? 0) > 0;
      }, false)
    : false;

  return (
    <PaginaConta>
      <TopoConta titulo="Privacidade" texto="Seus dados são seus. Aqui você pode baixar tudo ou apagar sua conta." />

      <section aria-labelledby="baixar" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="baixar" className="text-lg font-bold">
          Baixar meus dados
        </h2>
        <p className="text-base text-texto-suave">
          Um arquivo com seu perfil, sua loja, seus anúncios, favoritos, pedidos no Radar e conversas com o Aki.
        </p>
        {/* Link comum (não next/link): é um download de arquivo, não uma página */}
        <a href="/minha-conta/privacidade/baixar" download className={classesBotao("secundario", true)}>
          <Download className="size-5" aria-hidden />
          Baixar meus dados
        </a>
      </section>

      <section aria-labelledby="aki" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="aki" className="text-lg font-bold">
          Conversas com o Aki
        </h2>
        <p className="text-base text-texto-suave">
          {conversasAki === 0
            ? "Você não tem conversas guardadas com o Aki."
            : conversasAki === 1
              ? "Você tem 1 conversa guardada com o Aki (o robô do OLAKI)."
              : `Você tem ${conversasAki} conversas guardadas com o Aki (o robô do OLAKI).`}
        </p>
        {conversasAki > 0 && <ApagarConversasAki />}
      </section>

      <section aria-labelledby="excluir" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="excluir" className="text-lg font-bold">
          Excluir minha conta
        </h2>
        <p className="text-base text-texto-suave">Apaga sua conta e tira seus anúncios do ar.</p>
        <ExcluirConta temPagamentos={temPagamentos} />
      </section>
    </PaginaConta>
  );
}
