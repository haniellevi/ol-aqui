import Link from "next/link";
import { exigirTela } from "@/lib/admin/equipe";
import { Aviso, Cartao, Titulo } from "@/components/admin/ui";
import { CartaoMensagem } from "@/components/conversas/cartao-mensagem";
import { lerConversaAdmin } from "@/lib/dados/conversas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversa denunciada" };

// Leitura da equipe: só conversa denunciada. O banco registra cada leitura (conversa_leituras_admin).
export default async function ConversaDenunciada({ params }: { params: Promise<{ id: string }> }) {
  await exigirTela("moderacao");
  const { id } = await params;
  const r = await lerConversaAdmin(id);
  return <>
    <Titulo sub="Esta leitura fica registrada. Leia só o necessário para decidir a denúncia.">Conversa denunciada</Titulo>
    <Link href="/admin/moderacao" className="mb-4 inline-flex min-h-10 items-center text-sm font-semibold text-laranja-escuro underline underline-offset-4">Voltar para Moderação</Link>
    {!r.ok ? <Aviso tipo="erro">{r.erro}</Aviso> : r.mensagens.length === 0 ? <Cartao className="text-sm text-texto-suave">Esta conversa não tem mensagens.</Cartao> :
      <ol className="flex max-w-2xl flex-col gap-3">
        {r.mensagens.map((m) => <CartaoMensagem key={m.id} m={m} meuLado={null} autorNome={m.lado === "sistema" ? null : `${m.autor_nome ?? "Conta apagada"} (${m.lado === "loja" ? "loja" : "cliente"})`} />)}
      </ol>}
  </>;
}
