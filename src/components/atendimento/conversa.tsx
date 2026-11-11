import { Botao } from "@/components/ui/botao";
import { quando } from "@/lib/admin/formato";
import { lerMensagensAtendimento, type MensagemAtendimento } from "@/lib/dados/atendimento";
import { createClient } from "@/lib/supabase/server";
import { FormMensagemAtendimento } from "./form-mensagem";
import { AtualizarConversa } from "./atualizar";

const AUTOR: Record<MensagemAtendimento["autor"], string> = { equipe: "Equipe Mercado da Região", anunciante: "Anunciante", aki: "Aki · IA" };

export async function ConversaAtendimento({ id, caminho, antes, equipe, aki, cadastro = false }: {
  id: string; caminho: string; antes?: string; equipe?: boolean; aki: boolean; cadastro?: boolean;
}) {
  const cursor = typeof antes === "string" && /^\d{1,15}$/.test(antes) ? antes : undefined;
  const { mensagens, error, anterior } = await lerMensagensAtendimento(await createClient(), id, cursor);
  return <section id="conversa" aria-labelledby="titulo-conversa" className="space-y-3 rounded-card border border-borda bg-cartao p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="titulo-conversa" className="text-base font-semibold text-beringela">Conversa privada</h2>
      <AtualizarConversa recentes={!cursor} />
    </div>
    <details className="text-legenda text-texto-suave">
      <summary className="olaki-controle min-h-11 cursor-pointer content-center rounded-campo focus-visible:outline-2 focus-visible:outline-laranja-escuro">Privacidade da conversa</summary>
      <p className="pb-2">Apenas {cadastro ? "a pessoa que pediu ajuda" : "o anunciante"} e a administração têm acesso. Não compartilhe senhas, documentos ou códigos.{!equipe && aki && " Mensagens enviadas ao Aki podem ser processadas pelo provedor de IA."}</p>
    </details>
    {error ? <p role="alert" className="text-sm text-perigo">Não foi possível carregar as mensagens. Use Atualizar para tentar novamente.</p> : <>
      {cursor && <Botao href={caminho} variante="secundario" prefetch={false}>Mensagens recentes</Botao>}
      {anterior && <Botao href={`${caminho}${caminho.includes("?") ? "&" : "?"}antes=${anterior}#conversa`} variante="secundario" prefetch={false}>Mensagens anteriores</Botao>}
      {mensagens.length === 0 ? <p className="text-sm text-texto-suave">Nenhuma mensagem nesta página.</p> :
        <ol aria-label="Mensagens da conversa" className="flex flex-col gap-2">
          {mensagens.map((m) => {
            const minha = equipe ? m.autor === "equipe" : m.autor === "anunciante";
            return <li key={m.id} className={`max-w-[92%] shrink-0 rounded-card px-3 py-2 [overflow-wrap:anywhere] ${minha ? "self-end bg-selecao" : "self-start bg-fundo"}`}>
              <p className="text-legenda font-semibold text-beringela">
                {minha ? "Você" : cadastro && m.autor === "anunciante" ? "Usuário" : AUTOR[m.autor]}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.texto}</p>
              <time dateTime={m.criado_em} className="mt-1 block text-legenda tabular-nums text-texto-suave">{quando(m.criado_em)}</time>
            </li>;
          })}
        </ol>}
      {!cursor && <FormMensagemAtendimento id={id} ofereceAki={!equipe && aki} />}
    </>}
  </section>;
}
