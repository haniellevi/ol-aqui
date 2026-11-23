import { ChevronDown } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { quando } from "@/lib/admin/formato";
import { lerMensagensAtendimento, type MensagemAtendimento } from "@/lib/dados/atendimento";
import { createClient } from "@/lib/supabase/server";
import { FormMensagemAtendimento } from "./form-mensagem";
import { AtualizarConversa } from "./atualizar";

const AUTOR: Record<MensagemAtendimento["autor"], string> = { equipe: "Equipe Mercado da Região", anunciante: "Anunciante", aki: "Merc · IA" };

export async function ConversaAtendimento({ id, caminho, antes, equipe, aki, cadastro = false }: {
  id: string; caminho: string; antes?: string; equipe?: boolean; aki: boolean; cadastro?: boolean;
}) {
  const cursor = typeof antes === "string" && /^\d{1,15}$/.test(antes) ? antes : undefined;
  const { mensagens, error, anterior } = await lerMensagensAtendimento(await createClient(), id, cursor);
  return <section id="conversa" aria-labelledby="titulo-conversa" className="min-w-0 space-y-3 rounded-card border border-borda bg-cartao p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="titulo-conversa" className="text-lg font-semibold text-beringela">Conversa privada</h2>
      <AtualizarConversa recentes={!cursor} />
    </div>
    <details className="group border-b border-borda text-sm text-texto-suave">
      <summary className="flex min-h-toque w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded-campo pr-2 font-semibold focus-visible:outline-3 focus-visible:outline-laranja-escuro [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        <span>Privacidade da conversa</span>
      </summary>
      <p className="max-w-[65ch] pb-3 [overflow-wrap:anywhere]">Apenas {cadastro ? "a pessoa que pediu ajuda" : "o anunciante"} e a administração têm acesso. Não compartilhe senhas, documentos ou códigos.{!equipe && aki && " Mensagens enviadas ao Merc podem ser processadas pelo provedor de IA."}</p>
    </details>
    {error ? <p role="alert" className="text-base text-perigo">Não foi possível carregar as mensagens. Use Atualizar para tentar novamente.</p> : <>
      {(cursor || anterior) && <nav aria-label="Histórico da conversa" className="flex flex-wrap gap-2">
        {cursor && <Botao href={caminho} variante="secundario" tamanho="toque" className="px-3" prefetch={false}>Mensagens recentes</Botao>}
        {anterior && <Botao href={`${caminho}${caminho.includes("?") ? "&" : "?"}antes=${anterior}#conversa`} variante="secundario" tamanho="toque" className="px-3" prefetch={false}>Mensagens anteriores</Botao>}
      </nav>}
      {mensagens.length === 0 ? <p className="py-2 text-base text-texto-suave">{cursor ? "Nenhuma mensagem nesta página." : "Ainda não há mensagens. Escreva abaixo para começar."}</p> :
        <ol aria-label="Mensagens da conversa" className="flex flex-col gap-2 py-1">
          {mensagens.map((m) => {
            const minha = equipe ? m.autor === "equipe" : m.autor === "anunciante";
            return <li key={m.id} className={`min-w-0 max-w-[92%] shrink-0 rounded-card px-3 py-2 [overflow-wrap:anywhere] ${minha ? "self-end bg-selecao" : "self-start bg-fundo"}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-legenda font-semibold text-beringela">
                  {minha ? "Você" : cadastro && m.autor === "anunciante" ? "Usuário" : AUTOR[m.autor]}
                </span>
                <time dateTime={m.criado_em} className="text-legenda text-texto-suave tabular-nums">{quando(m.criado_em)}</time>
              </div>
              <p className="mt-1 text-base whitespace-pre-wrap">{m.texto}</p>
            </li>;
          })}
        </ol>}
      {!cursor && <FormMensagemAtendimento id={id} ofereceAki={!equipe && aki} />}
    </>}
  </section>;
}
