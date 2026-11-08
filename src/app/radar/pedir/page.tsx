// /radar/pedir: o comprador diz o que procura. Prazos e limites vêm do painel (configuracoes).
// O celular confirmado vem do Clerk: sincronizamos antes de mostrar o formulário.
// Enquanto o painel não exige o código (radar.exigir_celular_confirmado = false), quem não
// confirmou digita o WhatsApp no próprio formulário.
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronLeft, Smartphone } from "lucide-react";
import { garantirPerfil, sincronizarPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCategorias } from "@/lib/dados/categorias";
import { listarCidades } from "@/lib/dados/regiao";
import { exigeCelularConfirmado, regrasRadar } from "@/lib/dados/radar";
import { telefone } from "@/lib/formato";
import { LINK_RADAR } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { FormPedido } from "@/components/radar/form-pedido";

export const metadata = { title: "Pedir no Radar · OLAKI" };

export default async function PedirRadarPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  await garantirPerfil();
  try {
    const u = await currentUser();
    if (u) await sincronizarPerfil(u);
  } catch {
    // sem a chave do Clerk: vale o que já está no banco
  }
  const conta = await meuPerfilEVitrine();
  const confirmado = !!conta?.perfil.whatsapp && !!conta.perfil.whatsapp_verificado_em;
  const exigeCodigo = conta && !confirmado ? await exigeCelularConfirmado(conta.perfil.microrregiao_id) : false;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <Link href={LINK_RADAR} className="-ml-2 inline-flex min-h-12 w-fit items-center gap-1 px-2 text-base font-semibold text-laranja-escuro">
          <ChevronLeft className="size-5" aria-hidden />
          Radar
        </Link>
        <h1 className="text-2xl font-bold leading-8">O que você procura?</h1>
        <p className="text-base text-texto-suave">As lojas da região veem seu pedido e mandam ofertas.</p>
      </header>
      {!conta ? (
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href="/radar/pedir" larguraTotal>
            Tentar de novo
          </Botao>
        </Vazio>
      ) : exigeCodigo ? (
        <Vazio
          icone={<Smartphone />}
          titulo="Confirme seu celular primeiro"
          texto="As lojas falam com você pelo WhatsApp. Para pedir no Radar, seu celular precisa estar confirmado."
        >
          <Botao href="/minha-conta/dados/foto" larguraTotal>
            Confirmar meu celular
          </Botao>
          <Botao href={LINK_RADAR} variante="texto">
            Voltar ao Radar
          </Botao>
        </Vazio>
      ) : (
        <Formulario
          microrregiaoId={conta.perfil.microrregiao_id}
          cidadePerfil={conta.perfil.cidade}
          texto={q ?? ""}
          pedirWhatsapp={!confirmado}
          whatsappInicial={conta.perfil.whatsapp ? telefone(conta.perfil.whatsapp) : ""}
        />
      )}
    </main>
  );
}

async function Formulario({
  microrregiaoId,
  cidadePerfil,
  texto,
  pedirWhatsapp,
  whatsappInicial,
}: {
  microrregiaoId: string;
  cidadePerfil: string | null;
  texto: string;
  pedirWhatsapp: boolean;
  whatsappInicial: string;
}) {
  const [categorias, cidades, regras] = await Promise.all([listarCategorias(), listarCidades(microrregiaoId), regrasRadar(microrregiaoId)]);
  return (
    <FormPedido
      textoInicial={texto.slice(0, 120)}
      categorias={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
      cidades={cidades.map((c) => c.nome)}
      cidadeInicial={cidades.some((c) => c.nome === cidadePerfil) ? cidadePerfil : (cidades[0]?.nome ?? null)}
      regras={regras}
      pedirWhatsapp={pedirWhatsapp}
      whatsappInicial={whatsappInicial}
    />
  );
}
