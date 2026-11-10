import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, FileClock, ImageOff, ShieldAlert } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { meusAnuncios } from "@/lib/dados/anuncios";
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
  const conta = await meuPerfilEVitrine();
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
        <Vazio titulo="Sua conta de vendedor está suspensa" texto="Fale com o suporte do OLAKI para saber o que aconteceu." icone={<ShieldAlert />}>
          <Botao href="/" variante="secundario" larguraTotal>Voltar ao início</Botao>
        </Vazio>
      </main>
    );
  }

  const rascunhos = (await meusAnuncios()).filter((a) => a.status === "rascunho");

  if (!conta.podePublicar) {
    const avulso = await avulsoParaMim(conta.vitrine);
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
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
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-titulo font-semibold text-beringela text-beringela">O que você quer vender?</h1>
          <p className="text-base text-texto-suave">Coloque as fotos, conte sobre o produto e escolha o preço e a cidade. Você confere tudo antes de publicar.</p>
        </div>
        <ol className="grid gap-3 rounded-card bg-cartao p-5 shadow-1">
          <li><strong>1. Mostre o produto</strong><p className="text-texto-suave">Escolha a capa e acrescente fotos dos detalhes.</p></li>
          <li><strong>2. Preencha as informações</strong><p className="text-texto-suave">Preço, categoria e localização, sem expor seu endereço.</p></li>
          <li><strong>3. Confira e publique</strong><p className="text-texto-suave">Cada etapa concluída fica salva como rascunho.</p></li>
        </ol>
        <BotaoNovoRascunho texto="Começar meu anúncio" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Continuar de onde parou?</h1>
        <p className="text-base text-texto-suave">Você tem anúncio pela metade. Tudo o que preencheu ficou guardado.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {rascunhos.slice(0, 5).map((r) => (
          <li key={r.id}>
            <Link
              href={urlPasso(r.fotos.length ? (r.categoria_id ? "detalhes" : "categoria") : "fotos", r.id)}
              className="flex min-h-11 items-center gap-3 rounded-card bg-cartao p-3 shadow-1 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
            >
              <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-campo bg-borda text-texto-suave">
                {r.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura simples do Storage
                  <img src={r.fotos[0]} alt="" width={64} height={64} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <ImageOff className="size-6" aria-hidden />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">{r.titulo || "Anúncio sem título"}</span>
                <span className="flex items-center gap-1 text-sm text-texto-suave">
                  <FileClock className="size-4" aria-hidden />
                  Rascunho · mexido {tempoRelativo(r.atualizado_em)}
                </span>
              </span>
              <span className="text-base font-semibold text-laranja-escuro">Continuar</span>
              <ChevronRight className="size-5 text-laranja-escuro" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <BotaoNovoRascunho variante="secundario" />
    </main>
  );
}
