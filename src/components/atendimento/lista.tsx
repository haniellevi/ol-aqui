import { Botao } from "@/components/ui/botao";
import { quando } from "@/lib/admin/formato";
import { CONVERSAS_POR_PAGINA, type Atendimento } from "@/lib/dados/atendimento";

export function ListaAtendimentos({ dados, caminho, link, pagina, total, equipe = false }: {
  dados: Atendimento[]; caminho: string; link: (c: Atendimento) => string; pagina: number; total: number; equipe?: boolean;
}) {
  const paginas = Math.ceil(total / CONVERSAS_POR_PAGINA);
  return <div className="space-y-4">
    {dados.length === 0 ? <p className="rounded-card border border-borda bg-cartao p-4 text-texto-suave">
      {pagina === 1 ? "Nenhuma conversa por enquanto." : "Nenhuma conversa nesta página."}
    </p> : <ul className="space-y-3" aria-label="Conversas de atendimento">
      {dados.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-borda bg-cartao p-4">
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p className="font-semibold text-beringela">{c.anuncio_id ? c.anuncios?.titulo?.trim() || "Anúncio sem título" : "Confirmação do WhatsApp"}</p>
          <p className="mt-1 text-legenda text-texto-suave">Atualizado em {quando(c.atualizado_em)}</p>
          <p className="mt-1 text-sm text-texto-suave">{c.aguarda_equipe ? "Aguardando equipe" : c.aki_ativo ? "Atendimento com Aki" : "Atendimento da equipe"}</p>
        </div>
        <Botao href={link(c)} variante="secundario" prefetch={false}>{equipe ? "Gerenciar conversa" : "Ler conversa"}</Botao>
      </li>)}
    </ul>}
    {(pagina > 1 || paginas > 1) && <nav aria-label="Páginas de conversas" className="flex flex-wrap items-center gap-3">
      {pagina > 1 && <Botao href={pagina === 2 ? caminho : `${caminho}?pagina=${pagina - 1}`} variante="secundario" prefetch={false}>Anterior</Botao>}
      <p className="text-sm text-texto-suave">Página {pagina}</p>
      {pagina < paginas && <Botao href={`${caminho}?pagina=${pagina + 1}`} variante="secundario" prefetch={false}>Próxima</Botao>}
    </nav>}
  </div>;
}
