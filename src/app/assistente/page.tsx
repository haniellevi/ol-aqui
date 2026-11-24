import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EntradaAssistente } from "@/components/assistente/entrada";
import { ContinuarBusca, EscolherRadar, RetomarRadar, VincularAssistente } from "@/components/assistente/retomar";
import { BotaoVenderCoisas } from "@/components/anunciar/botao-vender-coisas";
import { Botao } from "@/components/ui/botao";
import Image from "next/image";
import { anunciarPelaVitrinePropria } from "@/app/(conta)/quero-vender/actions";
import { comAssistente, linkAssistente, objetivoAssistente, tentativaAssistente } from "@/lib/assistente";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { garantirPerfil } from "@/lib/perfil";
import { termosPendentes } from "@/lib/dados/paginas";

export const metadata = { title: "Primeiros passos", robots: { index: false } };

type Params = Promise<{ objetivo?: string; tentativa?: string; radar?: string }>;

export default async function PaginaAssistente({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const objetivo = objetivoAssistente(params.objetivo);
  const tentativa = tentativaAssistente(params.tentativa);
  if (!objetivo || !tentativa) redirect("/");
  if (objetivo === "explorar") redirect("/busca");

  const { userId } = await auth();
  const inicial = linkAssistente(objetivo, tentativa);
  const publicarRadar = objetivo === "procurar" && params.radar === "1";
  const destino = publicarRadar ? `${inicial}&radar=1` : inicial;
  const entrar = `/entrar?redirect_url=${encodeURIComponent(destino)}`;
  let conteudo;
  let pendencia: string | undefined;

  if (objetivo === "procurar" && !publicarRadar) {
    conteudo = <>
      <h1 className="text-titulo font-semibold">Como você quer procurar?</h1>
      <ContinuarBusca dono={userId} tentativa={tentativa} />
      <EscolherRadar dono={userId} tentativa={tentativa} href={`${inicial}&radar=1`} />
    </>;
  } else {
    if (!userId) redirect(entrar);
    await garantirPerfil();
    const conta = await meuPerfilEVitrine(true);
    if (!conta) {
      conteudo = <>
        <h1 className="text-titulo font-semibold">Não conseguimos abrir sua conta</h1>
        <Botao tamanho="acao" href={destino}>Tentar de novo</Botao>
      </>;
    } else if (!conta.perfil.whatsapp || !conta.perfil.whatsapp_verificado_em || (await termosPendentes()).length > 0) {
      pendencia = `/completar-perfil?redirect_url=${encodeURIComponent(destino)}`;
      conteudo = <h1 className="text-titulo font-semibold">Falta completar sua conta</h1>;
    } else if (publicarRadar) {
      conteudo = <>
        <h1 className="text-titulo font-semibold">O que você procura?</h1>
        <p>Você pode conferir os dados antes de enviar seu pedido às lojas da região.</p>
        <RetomarRadar dono={userId} tentativa={tentativa} />
      </>;
    } else if (conta.vitrine?.status === "suspensa") {
      conteudo = <>
        <h1 className="text-titulo font-semibold">Sua conta de vendedor está suspensa</h1>
        <Botao tamanho="acao" href="/minha-conta/atendimento">Falar com o suporte</Botao>
      </>;
    } else if (objetivo === "loja" && conta.vitrine?.tipo !== "loja") {
      conteudo = <>
        <h1 className="text-titulo font-semibold">Cadastre sua loja para anunciar</h1>
        <Botao tamanho="acao" href={comAssistente("/quero-vender/loja", tentativa)}>Cadastrar minha loja</Botao>
      </>;
    } else if (!conta.vitrine) {
      conteudo = <>
        <h1 className="text-titulo font-semibold">Prepare sua conta para anunciar</h1>
        <BotaoVenderCoisas assistente={tentativa} />
      </>;
    } else if (objetivo === "item" && conta.vitrine.tipo === "loja") {
      conteudo = <>
        <h1 className="text-titulo font-semibold">O anúncio sairá pela loja {conta.vitrine.nome}</h1>
        <form action={anunciarPelaVitrinePropria.bind(null, tentativa, objetivo)}>
          <Botao tamanho="acao" type="submit" larguraTotal>Anunciar pela loja</Botao>
        </form>
      </>;
    } else {
      conteudo = <>
        <h1 className="text-titulo font-semibold">Vamos preparar seu anúncio</h1>
        <form action={anunciarPelaVitrinePropria.bind(null, tentativa, objetivo)}>
          <Botao tamanho="acao" type="submit" larguraTotal>Continuar para o anúncio</Botao>
        </form>
      </>;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <Image src="/logo/mercado-da-regiao-logo.svg" alt="Mercado da Região" width={200} height={52} priority />
      {conteudo}
      {userId && <VincularAssistente dono={userId} objetivo={objetivo} tentativa={tentativa} destino={pendencia} />}
      <EntradaAssistente dono={userId} ocultarContinuar />
    </main>
  );
}
