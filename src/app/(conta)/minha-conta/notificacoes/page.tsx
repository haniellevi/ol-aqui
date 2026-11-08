import type { Metadata } from "next";
import { Bell, Radar } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { BotaoEnviar } from "@/components/radar/botao-enviar";
import { BotaoLinhaAviso, BotaoPreferencia } from "@/components/conta/botoes-aviso";
import { minhasNotificacoes, minhasPreferenciasAvisos } from "@/lib/dados/radar";
import { tempoRelativo } from "@/lib/formato";
import { LINK_RADAR } from "@/lib/rotas";
import { abrirAviso, marcarTodasLidas, salvarPreferenciaAviso } from "./actions";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

// T36 · Notificações: avisos do app (propostas do Radar, prazo, pedidos novos). Não lidos em destaque.
export default async function PaginaNotificacoes() {
  const [avisos, preferencias] = await Promise.all([minhasNotificacoes(), minhasPreferenciasAvisos()]);
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
                  <BotaoLinhaAviso lido={!!a.lida_em} temLink={!!a.link}>
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
                  </BotaoLinhaAviso>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      {preferencias.length > 0 && (
        <section className="mt-8 flex flex-col gap-3" aria-labelledby="titulo-escolher-avisos">
          <h2 id="titulo-escolher-avisos" className="text-lg font-bold">
            O que você quer receber
          </h2>
          <p className="text-[15px] text-texto-suave">Toque para ligar ou desligar. Os avisos chegam aqui, no OLAKI.</p>
          <ul className="flex flex-col gap-2">
            {preferencias.map((p) => (
              <li key={p.tipo}>
                <form action={salvarPreferenciaAviso}>
                  <input type="hidden" name="tipo" value={p.tipo} />
                  <input type="hidden" name="ligar" value={p.ligado ? "nao" : "sim"} />
                  <BotaoPreferencia ligado={p.ligado} nome={p.nome} explicacao={p.explicacao} />
                </form>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-texto-suave">Em breve: receber também pelo WhatsApp e por e-mail.</p>
        </section>
      )}
    </PaginaConta>
  );
}
