import type { Metadata } from "next";
import { Bell, ChevronRight, Radar } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { BotaoEnviar } from "@/components/radar/botao-enviar";
import { minhasNotificacoes } from "@/lib/dados/radar";
import { tempoRelativo } from "@/lib/formato";
import { LINK_RADAR } from "@/lib/rotas";
import { abrirAviso, marcarTodasLidas } from "./actions";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

// T36 · Notificações: avisos do app (propostas do Radar, prazo, pedidos novos). Não lidos em destaque.
export default async function PaginaNotificacoes() {
  const avisos = await minhasNotificacoes();
  const naoLidos = avisos.filter((a) => !a.lida_em).length;

  return (
    <PaginaConta>
      <TopoConta titulo="Notificações" texto={naoLidos > 0 ? `${naoLidos} ${naoLidos === 1 ? "aviso novo" : "avisos novos"}` : undefined} />
      {avisos.length === 0 ? (
        <Vazio titulo="Nenhum aviso por enquanto" icone={<Bell />} texto="Quando chegar proposta no Radar ou um pedido novo na sua região, avisamos aqui.">
          <Botao href={LINK_RADAR} variante="secundario" larguraTotal icone={<Radar />}>
            Ir para o Radar
          </Botao>
        </Vazio>
      ) : (
        <>
          {naoLidos > 0 && (
            <form action={marcarTodasLidas}>
              <BotaoEnviar variante="texto" textoCarregando="Marcando...">
                Marcar todas como lidas
              </BotaoEnviar>
            </form>
          )}
          <ul className="flex flex-col overflow-hidden rounded-card bg-cartao shadow-1">
            {avisos.map((a) => (
              <li key={a.id} className="border-b border-borda last:border-b-0">
                <form action={abrirAviso}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="link" value={a.link ?? ""} />
                  <button
                    type="submit"
                    className={`flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro ${
                      a.lida_em ? "" : "bg-laranja-claro/60"
                    }`}
                  >
                    <span
                      className={`mt-2 size-2.5 shrink-0 rounded-full ${a.lida_em ? "bg-transparent" : "bg-laranja-escuro"}`}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`text-base ${a.lida_em ? "font-semibold" : "font-bold"}`}>
                        {!a.lida_em && <span className="sr-only">Novo: </span>}
                        {a.titulo}
                      </span>
                      <span className="text-[15px] text-texto-suave">{a.texto}</span>
                      <span className="text-[13px] text-texto-suave">{tempoRelativo(a.criado_em)}</span>
                    </span>
                    {a.link && <ChevronRight className="mt-1 size-5 shrink-0 text-texto-suave" aria-hidden />}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </PaginaConta>
  );
}
