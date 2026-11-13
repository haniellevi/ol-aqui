import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, FileClock, ImageOff, ShieldAlert } from "lucide-react";
import { contaDaLoja } from "@/lib/dados/conta";
import { lojaEscolhida, lojasQueCuido } from "@/lib/dados/loja-ativa";
import { SeletorLoja } from "@/components/conta/seletor-loja";
import { anunciosDaLoja } from "@/lib/dados/anuncios";
import { avulsoParaMim } from "@/lib/dados/cobranca";
import { asaasConfigurado } from "@/lib/asaas";
import { tempoRelativo } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { LimiteAtingido } from "@/components/anunciar/limite-atingido";
import { BotaoNovoRascunho } from "@/components/anunciar/botao-novo-rascunho";
import { urlPasso } from "@/components/anunciar/passos";

export const metadata: Metadata = { title: "Anunciar" };

// /anunciar: confere se a pessoa já vende e o limite do plano (T16) e então
// oferece retomar ou começar. Abrir/pré-carregar a página nunca grava no banco.
export default async function PaginaAnunciar() {
  const conta = await contaDaLoja();
  if (!conta) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href="/anunciar" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </main>
    );
  }
  if (!conta.vitrine) redirect("/quero-vender");

  if (conta.vitrine.status === "suspensa") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Sua conta de vendedor está suspensa" texto="Fale com o suporte do Mercado da Região para saber o que aconteceu." icone={<ShieldAlert />}>
          <Botao href="/" variante="secundario" larguraTotal>Voltar ao início</Botao>
        </Vazio>
      </main>
    );
  }

  const [todos, lojas, lojaAtual] = await Promise.all([anunciosDaLoja(), lojasQueCuido(), lojaEscolhida()]);
  const rascunhos = todos.filter((a) => a.status === "rascunho");
  const seletor = <SeletorLoja lojas={lojas} atual={lojaAtual} voltar="/anunciar" />;

  // P5b: ajudante no limite do plano não vê avulso nem planos (pagamento é do dono).
  if (!conta.podePublicar && conta.ajudante) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2.5 py-4 md:gap-5 md:px-4 md:py-6">
        {seletor}
        <Vazio titulo="A loja está no limite do plano" texto="Para pôr mais anúncios no ar, pause um anúncio da loja ou fale com o dono para trocar de plano.">
          <Botao href="/minha-conta/anuncios" variante="secundario" larguraTotal>Ver os anúncios da loja</Botao>
        </Vazio>
      </main>
    );
  }

  if (!conta.podePublicar) {
    const avulso = await avulsoParaMim(conta.vitrine);
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2.5 py-4 md:gap-5 md:px-4 md:py-6">
        {seletor}
        <LimiteAtingido
          conta={conta}
          avulsoPreco={avulso?.preco ?? null}
          avulsoDias={avulso?.dias ?? null}
          pagamentoLigado={asaasConfigurado()}
        />
        {rascunhos.length > 0 && (
          <p className="text-center text-base text-texto-suave">
            Seus rascunhos continuam guardados em{" "}
            <Link href="/minha-conta/anuncios" className="font-semibold text-laranja-escuro underline underline-offset-4">
              Meus anúncios
            </Link>
            .
          </p>
        )}
      </main>
    );
  }

  if (rascunhos.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2.5 py-4 md:gap-5 md:px-4 md:py-6">
        {seletor}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-beringela">Anunciar</h1>
          <p className="text-sm text-texto-suave md:text-base">Comece pelas fotos. O anúncio fica salvo como rascunho até você publicar.</p>
        </div>
        <BotaoNovoRascunho texto="Começar meu anúncio" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2.5 py-4 md:gap-5 md:px-4 md:py-6">
      {seletor}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Seus rascunhos</h1>
        <p className="text-sm text-texto-suave md:text-base">Escolha um anúncio para continuar.</p>
      </div>
      <ul className="flex flex-col gap-2 md:gap-3">
        {rascunhos.slice(0, 5).map((r) => (
          <li key={r.id}>
            <Link
              href={urlPasso(r.fotos.length ? (r.categoria_id ? "detalhes" : "categoria") : "fotos", r.id)}
              className="flex min-h-12 items-center gap-2 rounded-card bg-cartao p-2 shadow-1 md:gap-3 md:p-3 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
            >
              <span className="relative grid size-12 shrink-0 md:size-16 place-items-center overflow-hidden rounded-campo bg-borda text-texto-suave">
                {r.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura simples do Storage
                  <img src={r.fotos[0]} alt="" width={64} height={64} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <ImageOff className="size-6" aria-hidden />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] md:text-base">{formatarNome(r.titulo) || "Anúncio sem título"}</span>
                <span className="flex items-center gap-1 text-xs text-texto-suave md:text-sm">
                  <FileClock className="size-4 shrink-0" aria-hidden />
                  Rascunho · mexido {tempoRelativo(r.atualizado_em)}
                </span>
              </span>
              <span className="sr-only md:not-sr-only md:text-sm md:font-semibold md:text-laranja-escuro">Continuar</span>
              <ChevronRight className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <BotaoNovoRascunho variante="secundario" />
    </main>
  );
}
