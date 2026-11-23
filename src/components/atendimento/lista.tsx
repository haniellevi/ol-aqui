import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { formatarNome } from "@/lib/formatar-nome";
import { Badge } from "@/components/ui/badge";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { quando } from "@/lib/admin/formato";
import { CONVERSAS_POR_PAGINA, type Atendimento } from "@/lib/dados/atendimento";
import { LINK_ADMIN_ANUNCIOS, LINK_AJUDA } from "@/lib/rotas";

export function ListaAtendimentos({ dados, caminho, link, pagina, total, equipe = false }: {
  dados: Atendimento[]; caminho: string; link: (c: Atendimento) => string; pagina: number; total: number; equipe?: boolean;
}) {
  const paginas = Math.ceil(total / CONVERSAS_POR_PAGINA);
  return <div className="space-y-3">
    {dados.length === 0 ? (
      <Vazio
        icone={<MessagesSquare />}
        titulo={pagina === 1 ? "Nenhuma conversa por enquanto" : "Nenhuma conversa nesta página"}
        texto={pagina === 1 && !equipe ? "Quando você falar com a equipe sobre um anúncio ou confirmação do WhatsApp, a conversa aparece aqui." : undefined}
      >
        {pagina > 1 ? (
          <Botao href={caminho} variante="secundario" tamanho="toque" prefetch={false}>Voltar para a primeira página</Botao>
        ) : (
          <Botao href={equipe ? LINK_ADMIN_ANUNCIOS : LINK_AJUDA} variante="secundario" tamanho="toque">
            {equipe ? "Voltar aos anúncios" : "Ver opções de ajuda"}
          </Botao>
        )}
      </Vazio>
    ) : <ul className="divide-y divide-borda overflow-hidden rounded-card border border-borda bg-cartao" aria-label="Conversas de atendimento">
      {dados.map(c => {
        const titulo = c.anuncio_id ? formatarNome(c.anuncios?.titulo) || "Anúncio sem título" : "Confirmação do WhatsApp";
        const situacao = c.aguarda_equipe ? "Aguardando equipe" : c.aki_ativo ? "Atendimento com Merc" : "Atendimento da equipe";
        const resumo = <>
          <span className="block text-base font-semibold text-beringela">{titulo}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-legenda text-texto-suave">
            {c.aguarda_equipe ? <Badge variant="default">{situacao}</Badge> : <span>{situacao}</span>}
            <time dateTime={c.atualizado_em} className="tabular-nums">{quando(c.atualizado_em)}</time>
          </span>
        </>;
        return <li key={c.id} className={equipe ? "flex flex-wrap items-center justify-between gap-3 p-3" : undefined}>
          {equipe ? <>
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{resumo}</div>
            <Botao href={link(c)} variante="secundario" tamanho="toque" prefetch={false}>Gerenciar conversa</Botao>
          </> : <Link href={link(c)} prefetch={false}
            className="olaki-toque flex min-h-toque items-center justify-between gap-3 px-3 py-3 hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro">
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{resumo}</span>
            <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
          </Link>}
        </li>;
      })}
    </ul>}
    {(pagina > 1 || paginas > 1) && <nav aria-label="Páginas de conversas" className="flex flex-wrap items-center gap-2">
      {pagina > 1 && <Botao href={pagina === 2 ? caminho : `${caminho}?pagina=${pagina - 1}`} variante="secundario" tamanho="toque" className="px-3" prefetch={false}>Anterior</Botao>}
      <p className="px-1 text-sm text-texto-suave tabular-nums">Página {pagina}</p>
      {pagina < paginas && <Botao href={`${caminho}?pagina=${pagina + 1}`} variante="secundario" tamanho="toque" className="px-3" prefetch={false}>Próxima</Botao>}
    </nav>}
  </div>;
}
