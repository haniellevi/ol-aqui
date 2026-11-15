import { RetomarAnuncio } from "@/components/assistente/retomar";
import { etapaAnuncio, tentativaAssistente } from "@/lib/assistente";
import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, FileClock, ImageOff, ShieldAlert } from "lucide-react";
import { contaDaLoja } from "@/lib/dados/conta";
import { lojaEscolhida, lojasQueCuido } from "@/lib/dados/loja-ativa";
import { SeletorLoja } from "@/components/conta/seletor-loja";
import { anunciosDaLoja } from "@/lib/dados/anuncios";
import { categoriaPorId } from "@/lib/dados/categorias";
import { lerConfigNumero } from "@/lib/dados/config";
import { avulsoParaMim } from "@/lib/dados/cobranca";
import { pagamentoDisponivel } from "@/lib/asaas";
import { tempoRelativo } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { LimiteAtingido } from "@/components/anunciar/limite-atingido";
import { BotaoNovoRascunho } from "@/components/anunciar/botao-novo-rascunho";
import { urlPasso } from "@/components/anunciar/passos";

export const metadata: Metadata = { title: "Anunciar" };

// /anunciar: confere se a pessoa já vende e o limite do plano (T16) e então
// oferece retomar ou começar. Abrir/pré-carregar a página nunca grava no banco.
export default async function PaginaAnunciar({ searchParams }: { searchParams: Promise<{ assistente?: string }> }) {
  const assistente = tentativaAssistente((await searchParams).assistente);
  const conta = await contaDaLoja();
  if (!conta) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href="/anunciar" tamanho="toque" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </main>
    );
  }
  if (!conta.vitrine) redirect("/quero-vender");

  if (conta.vitrine.status === "suspensa") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Sua conta de vendedor está suspensa" texto="Fale com o suporte do Mercado da Região para saber o que aconteceu." icone={<ShieldAlert />}>
          <Botao href="/" variante="secundario" tamanho="toque" larguraTotal>Voltar ao início</Botao>
        </Vazio>
      </main>
    );
  }

  const [todos, lojas, lojaAtual] = await Promise.all([anunciosDaLoja(), lojasQueCuido(), lojaEscolhida()]);
  const rascunhos = todos.filter((a) => a.status === "rascunho");
  const retomar = assistente ? <RetomarAnuncio dono={conta.perfil.id} tentativa={assistente}
    rascunhos={rascunhos.map((a) => a.id)} publicados={todos.filter((a) => a.status === "ativo" || a.status === "em_analise" || (a.status === "rascunho" && a.pronto_em)).map((a) => a.id)} /> : null;
  const seletor = <SeletorLoja lojas={lojas} atual={lojaAtual} voltar="/anunciar" />;

  // P5b: ajudante no limite do plano não vê avulso nem planos (pagamento é do dono).
  if (!conta.podePublicar && conta.ajudante) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7">
        {seletor}
        <Vazio titulo="A loja está no limite do plano" texto="Para pôr mais anúncios no ar, pause um anúncio da loja ou fale com o dono para trocar de plano.">
          <Botao href="/minha-conta/anuncios" variante="secundario" tamanho="toque" larguraTotal>Ver os anúncios da loja</Botao>
        </Vazio>
      </main>
    );
  }

  if (!conta.podePublicar) {
    const avulso = await avulsoParaMim(conta.vitrine);
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7">
        {seletor}
        {retomar}
        <LimiteAtingido
          conta={conta}
          avulsoPreco={avulso?.preco ?? null}
          avulsoDias={avulso?.dias ?? null}
          pagamentoLigado={(await pagamentoDisponivel())}
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
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7">
        {seletor}
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo font-semibold text-beringela">Anunciar</h1>
          <p className="text-sm text-texto-suave md:text-base">Comece pelas fotos. Você pode salvar e continuar depois.</p>
        </div>
        {retomar}
        <BotaoNovoRascunho assistente={assistente} texto="Começar meu anúncio" />
      </main>
    );
  }

  const exibidos = assistente ? rascunhos : rascunhos.slice(0, 5);
  const [minimoFotos, categorias] = await Promise.all([
    lerConfigNumero("anuncio.fotos_minimo", conta.vitrine.microrregiao_id),
    Promise.all(exibidos.map((r) => r.categoria_id ? categoriaPorId(r.categoria_id).catch(() => null) : null)),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7">
      {seletor}
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">Seus rascunhos</h1>
        <p className="text-sm text-texto-suave md:text-base">Escolha um anúncio para continuar.</p>
      </div>
      {retomar}
      <ul className="flex flex-col gap-2 md:gap-3">
        {exibidos.map((r, i) => (
          <li key={r.id}>
            <Link
              href={urlPasso(etapaAnuncio(r, minimoFotos ?? 0, categorias[i]?.categoria.campos, categorias[i]?.filhas.length === 0), r.id, false, false, assistente)}
              className="flex min-h-toque items-center gap-2 rounded-card border border-borda bg-cartao p-2 sm:gap-3 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
            >
              <span className="relative grid size-12 shrink-0 sm:size-14 place-items-center overflow-hidden rounded-campo bg-borda text-texto-suave">
                {r.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura simples do Storage
                  <img src={r.fotos[0]} alt="" width={64} height={64} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <ImageOff className="size-6" aria-hidden />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] md:text-base">{formatarNome(r.titulo) || "Anúncio sem título"}</span>
                <span className="flex items-center gap-1 text-legenda text-texto-suave md:text-sm">
                  <FileClock className="size-4 shrink-0" aria-hidden />
                  Editado {tempoRelativo(r.atualizado_em)}
                </span>
              </span>
              <span className="sr-only sm:not-sr-only sm:text-sm sm:font-semibold sm:text-laranja-escuro">{assistente ? "Continuar anúncio" : "Continuar"}</span>
              <ChevronRight className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <BotaoNovoRascunho assistente={assistente} variante="secundario" texto={assistente ? "Criar novo anúncio" : undefined} />
    </main>
  );
}
