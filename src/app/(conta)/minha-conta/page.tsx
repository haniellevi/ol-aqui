import Link from "next/link";
import type { Metadata } from "next";
import { SignOutButton } from "@clerk/nextjs";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Heart,
  LogOut,
  Megaphone,
  Radar,
  ShieldCheck,
  Store,
  Tag,
  UserRound,
  Lock,
  LifeBuoy,
  Pencil,
} from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { avisosNaoLidos } from "@/lib/dados/radar";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta } from "@/components/conta/topo-conta";
import { resumoPlano } from "@/components/conta/resumo-plano";

export const metadata: Metadata = { title: "Minha conta" };

type Item = { href: string; nome: string; icone: React.ReactNode; detalhe?: string };

const CLASSE_ITEM =
  "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-[0.9375rem] font-semibold hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro";

// T31 · Minha conta: lista simples com ícone + nome. Itens de vendedor só para quem vende.
export default async function PaginaMinhaConta() {
  const [conta, naoLidos] = await Promise.all([meuPerfilEVitrine(), avisosNaoLidos().catch(() => null)]);
  if (!conta) {
    return (
      <PaginaConta>
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href="/minha-conta" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const { perfil, vitrine } = conta;
  const plano = resumoPlano(conta);
  const ehLoja = vitrine?.tipo === "loja";
  const selo = ehLoja ? vitrine?.selo_loja_verificada : perfil.selo_negociador_certificado;
  const textoSelo = ehLoja ? "Loja verificada" : "Negociador certificado";
  const iniciais = perfil.nome.trim().slice(0, 1).toUpperCase() || "?";

  const deVendedor: Item[] = vitrine
    ? [
        {
          href: "/minha-conta/anuncios",
          nome: "Meus anúncios",
          icone: <Megaphone />,
          detalhe: conta.rascunhos > 0 ? `${conta.rascunhos} ${conta.rascunhos === 1 ? "rascunho" : "rascunhos"}` : undefined,
        },
        { href: "/minha-conta/plano", nome: "Meu plano", icone: <CreditCard /> },
        ...(ehLoja
          ? [{ href: "/minha-conta/loja", nome: "Minha loja", icone: <Store /> }]
          : [{ href: "/minha-conta/verificacao", nome: "Verificação de vendedor", icone: <ShieldCheck /> }]),
      ]
    : [];
  const paraTodos: Item[] = [
    { href: "/radar", nome: "Radar", icone: <Radar /> },
    { href: "/minha-conta/favoritos", nome: "Favoritos", icone: <Heart /> },
    {
      href: "/minha-conta/notificacoes",
      nome: "Notificações",
      icone: <Bell />,
      detalhe: naoLidos === null ? "Consulte seus avisos" : naoLidos > 0 ? `${naoLidos} ${naoLidos === 1 ? "aviso novo" : "avisos novos"}` : undefined,
    },
    { href: "/minha-conta/dados", nome: "Meus dados", icone: <UserRound />, detalhe: "Perfil, foto e WhatsApp" },
    { href: "/minha-conta/privacidade", nome: "Privacidade", icone: <Lock /> },
    { href: "/ajuda", nome: "Ajuda", icone: <LifeBuoy /> },
  ];

  return (
    <PaginaConta larga>
      <h1 className="text-titulo font-semibold text-beringela">Minha conta</h1>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-5">

          {/* Cartão do topo: nome, selo e, para quem vende, o plano e o uso */}
          <section aria-label="Sua conta" className="flex flex-col gap-3 rounded-card bg-beringela p-5 text-white">
            <div className="flex items-center gap-3">
              {perfil.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto do Clerk, host externo
                <img src={perfil.avatar_url} alt="" width={56} height={56} className="size-14 shrink-0 rounded-full bg-white/20 object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-laranja text-2xl font-bold text-beringela" aria-hidden>
                  {iniciais}
                </span>
              )}
              <div className="flex min-w-0 flex-col">
                <p className="break-words text-base font-semibold leading-6">{ehLoja && vitrine ? vitrine.nome : perfil.nome}</p>
                {ehLoja && <p className="break-words text-sm text-white/85">{perfil.nome}</p>}
                {selo && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-white">
                    <ShieldCheck className="size-4 shrink-0" aria-hidden />
                    {textoSelo}
                  </p>
                )}
              </div>
            </div>
            <Link href="/minha-conta/dados" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-campo bg-white/10 px-3 py-2 font-semibold hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-laranja">
              <Pencil className="size-4" aria-hidden />Editar perfil, foto e WhatsApp
            </Link>
            {plano && (
              <Link
                href="/minha-conta/plano"
                className="flex min-h-12 items-center justify-between gap-2 rounded-campo bg-white/10 px-3 py-2 text-[15px] font-semibold hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-laranja"
              >
                <span>{plano.linha}</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            )}
          </section>

          {!vitrine && (
            <section className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
              <p className="text-base font-semibold">Tem algo para vender? Anuncie de graça para a região.</p>
              <Botao href="/quero-vender" larguraTotal icone={<Tag />}>
                Quero vender
              </Botao>
            </section>
          )}

        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {deVendedor.length > 0 && <Lista titulo="Vendas" itens={deVendedor} />}
          <Lista titulo="Conta" itens={paraTodos} />

          {vitrine?.tipo === "pf" && (
            <p className="text-base text-texto-suave">
              Tem uma loja?{" "}
              <Link href="/quero-vender/loja" className="inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
                Abrir minha loja no OLAKI
              </Link>
            </p>
          )}

          <div className="overflow-hidden rounded-card border border-borda bg-cartao">
            <SignOutButton redirectUrl="/">
              <button type="button" className={`${CLASSE_ITEM} text-perigo`}>
                <span className="inline-flex shrink-0 [&>svg]:size-5" aria-hidden>
                  <LogOut />
                </span>
                Sair
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </PaginaConta>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: Item[] }) {
  return (
    <nav aria-label={titulo} className="flex flex-col gap-2">
      <h2 className="px-1 text-rotulo font-semibold text-beringela">{titulo}</h2>
      <ul className="divide-y divide-borda overflow-hidden rounded-card border border-borda bg-cartao">
        {itens.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className={`${CLASSE_ITEM} text-texto`}>
              <span className="inline-flex shrink-0 text-laranja-escuro [&>svg]:size-5" aria-hidden>
                {i.icone}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{i.nome}</span>
                {i.detalhe && <span className="text-sm font-normal text-texto-suave">{i.detalhe}</span>}
              </span>
              <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
