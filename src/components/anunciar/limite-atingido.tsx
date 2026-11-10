import { CalendarClock, Gauge, ListChecks, Receipt, Store } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { BotaoNovoRascunho } from "@/components/anunciar/botao-novo-rascunho";
import { preco } from "@/lib/formato";
import type { MinhaConta } from "@/lib/tipos";
import { LINK_PLANOS } from "@/lib/rotas";

// T16 · Limite atingido: aparece ANTES do passo 1, com as saídas (avulso, planos, liberar vaga).
// Preço e dias do avulso vêm do painel (config). Nada de número escrito no código.
// "Fazer um anúncio avulso" começa um rascunho; no Revisar, ao tocar em Publicar, o aviso de limite
// leva para o pagamento do avulso (/anunciar/avulso).

export function LimiteAtingido({
  conta,
  avulsoPreco,
  avulsoDias,
  pagamentoLigado = false,
}: {
  conta: MinhaConta;
  /** Preço do avulso para esta pessoa; null quando o avulso não é oferecido para ela. */
  avulsoPreco: number | null;
  avulsoDias: number | null;
  /** O Asaas está ligado (ASAAS_API_KEY). Sem ele: "Pagamento em breve". */
  pagamentoLigado?: boolean;
}) {
  const semPlano = !conta.plano; // teste ou plano venceu
  const titulo = semPlano ? "Seu período grátis ou plano terminou" : `Você chegou ao limite de ${conta.limite} anúncios`;
  const texto = semPlano
    ? "Para colocar anúncios no ar de novo, assine um plano."
    : `Você tem ${conta.ativos} anúncios no ar no plano ${conta.plano?.nome ?? ""}. Escolha uma saída:`;
  const ehPf = conta.vitrine?.tipo === "pf";

  return (
    <section aria-labelledby="titulo-limite" className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-card bg-cartao p-5 text-center shadow-1">
        <span className="grid size-16 place-items-center rounded-full bg-selecao text-beringela" aria-hidden>
          <Gauge className="size-8" />
        </span>
        <h1 id="titulo-limite" className="text-xl font-semibold">{titulo}</h1>
        <p className="text-base text-texto-suave">{texto}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {avulsoPreco != null && avulsoPreco > 0 && (
          <li className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
            <div className="flex gap-3">
              <Receipt className="mt-0.5 size-6 shrink-0 text-beringela" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-semibold">Anúncio avulso por {preco(avulsoPreco)}</h2>
                <p className="text-base text-texto-suave">
                  Paga uma vez{avulsoDias ? ` e o anúncio fica ${avulsoDias} dias no ar` : ""}, sem mudar de plano.
                </p>
              </div>
            </div>
            {pagamentoLigado ? (
              <>
                <BotaoNovoRascunho variante="secundario" texto="Fazer um anúncio avulso" avulso />
                <p className="text-sm text-texto-suave">Monte o anúncio e, no fim, pague por Pix ou cartão para pôr no ar.</p>
              </>
            ) : (
              <>
                <Botao variante="secundario" larguraTotal disabled aria-describedby="avulso-em-breve">
                  Fazer um anúncio avulso
                </Botao>
                <p id="avulso-em-breve" className="text-sm text-texto-suave">Pagamento em breve: o avulso ainda não pode ser pago.</p>
              </>
            )}
          </li>
        )}
        <li className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 size-6 shrink-0 text-beringela" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-semibold">Assinar um plano maior</h2>
              <p className="text-base text-texto-suave">Mais anúncios no ar e o Radar de Negócios.</p>
            </div>
          </div>
          <Botao href={LINK_PLANOS} larguraTotal>Ver planos</Botao>
        </li>
        {ehPf && (
          <li className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
            <div className="flex gap-3">
              <Store className="mt-0.5 size-6 shrink-0 text-beringela" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-semibold">Tenho uma loja ou negócio</h2>
                <p className="text-base text-texto-suave">Vire loja com teste grátis. Seus anúncios continuam no ar.</p>
              </div>
            </div>
            <Botao href="/quero-vender/loja" variante="secundario" larguraTotal>Criar minha loja</Botao>
          </li>
        )}
        {!semPlano && (
          <li className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
            <div className="flex gap-3">
              <ListChecks className="mt-0.5 size-6 shrink-0 text-beringela" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-semibold">Liberar uma vaga</h2>
                <p className="text-base text-texto-suave">Marque como vendido ou pause um anúncio que já está no ar.</p>
              </div>
            </div>
            <Botao href="/minha-conta/anuncios" variante="secundario" larguraTotal>Ver meus anúncios</Botao>
          </li>
        )}
      </ul>
    </section>
  );
}
