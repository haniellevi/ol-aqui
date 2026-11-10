import { Botao } from "@/components/ui/botao";
import { quando } from "@/lib/admin/formato";
import { lerMensagensAtendimento, type MensagemAtendimento } from "@/lib/dados/atendimento";
import { createClient } from "@/lib/supabase/server";
import { FormMensagemAtendimento } from "./form-mensagem";
import { AtualizarConversa } from "./atualizar";

const AUTOR: Record<MensagemAtendimento["autor"], string> = { equipe: "Equipe OL-AKI", anunciante: "Anunciante", aki: "Aki · resposta automática" };

export async function ConversaAtendimento({ id, caminho, antes, equipe, aki, cadastro = false }: {
  id: string; caminho: string; antes?: string; equipe?: boolean; aki: boolean; cadastro?: boolean;
}) {
  const cursor = typeof antes === "string" && /^\d{1,15}$/.test(antes) ? antes : undefined;
  const { mensagens, error, anterior } = await lerMensagensAtendimento(await createClient(), id, cursor);
  return <section id="conversa" aria-labelledby="titulo-conversa" className="space-y-4 rounded-card border border-borda bg-cartao p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="titulo-conversa" className="text-lg font-semibold text-beringela">Conversa privada</h2>
      <AtualizarConversa recentes={!cursor} />
    </div>
    <p className="text-sm text-texto-suave">Apenas {cadastro ? "a pessoa que pediu ajuda" : "o anunciante"} e a administração têm acesso aqui. Evite compartilhar senhas, documentos ou códigos de confirmação.</p>
    {error ? <p role="alert" className="text-sm text-perigo">Não foi possível carregar as mensagens. Use Atualizar para tentar novamente.</p> : <>
      {cursor && <Botao href={caminho} variante="secundario" prefetch={false}>Mensagens recentes</Botao>}
      {anterior && <Botao href={`${caminho}${caminho.includes("?") ? "&" : "?"}antes=${anterior}#conversa`} variante="secundario" prefetch={false}>Mensagens anteriores</Botao>}
      {mensagens.length === 0 ? <p className="text-sm text-texto-suave">Nenhuma mensagem nesta página.</p> :
        <ol aria-label="Mensagens da conversa" className="flex flex-col gap-3">
          {mensagens.map((m) => {
            const minha = equipe ? m.autor === "equipe" : m.autor === "anunciante";
            return <li key={m.id} className={`max-w-[92%] rounded-card p-3 [overflow-wrap:anywhere] ${minha ? "self-end bg-selecao" : "self-start bg-fundo"}`}>
              <p className="text-legenda font-semibold text-beringela">
                {minha ? "Você" : cadastro && m.autor === "anunciante" ? "Usuário" : AUTOR[m.autor]}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-base">{m.texto}</p>
              <time dateTime={m.criado_em} className="mt-1 block text-legenda text-texto-suave">{quando(m.criado_em)}</time>
            </li>;
          })}
        </ol>}
      {!cursor && <FormMensagemAtendimento id={id} ofereceAki={!equipe && aki} />}
    </>}
  </section>;
}
