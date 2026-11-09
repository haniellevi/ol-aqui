import type { Metadata } from "next";
import { Bell, Radar } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { LinhaAviso, MarcarAvisos, PreferenciaAvisoBotao } from "@/components/conta/botoes-aviso";
import { AtualizarRadar } from "@/components/radar/atualizar-radar";
import { AVISOS_POR_PAGINA, avisosNaoLidos, minhasNotificacoes, minhasPreferenciasAvisos } from "@/lib/dados/radar";
import { LINK_AVISOS, LINK_RADAR } from "@/lib/rotas";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

export default async function PaginaNotificacoes({ searchParams }: { searchParams: Promise<{ pagina?: string; filtro?: string }> }) {
  const busca = await searchParams;
  const pagina = /^\d{1,5}$/.test(busca.pagina ?? "") ? Math.max(1, Math.min(10000, Number(busca.pagina))) : 1;
  const somenteNaoLidas = busca.filtro === "nao-lidas";
  const [lista, contagem, preferencias] = await Promise.allSettled([
    minhasNotificacoes(pagina, somenteNaoLidas), avisosNaoLidos(), minhasPreferenciasAvisos(),
  ]);
  const naoLidos = contagem.status === "fulfilled" ? contagem.value : null;
  const dados = lista.status === "fulfilled" ? lista.value : null;
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / AVISOS_POR_PAGINA)) : 1;
  const linkPagina = (n: number) => `${LINK_AVISOS}?pagina=${n}${somenteNaoLidas ? "&filtro=nao-lidas" : ""}`;

  return <PaginaConta larga>
    <TopoConta titulo="Notificações" texto={naoLidos === null ? "Confira seus avisos e preferências." : naoLidos > 0 ? `${naoLidos} ${naoLidos === 1 ? "aviso não lido" : "avisos não lidos"}` : "Você está em dia com seus avisos."}>
      <p className="text-[15px] text-texto-suave">Novas propostas, ofertas escolhidas e outros avisos chegam aqui, no OL-AKI.</p>
    </TopoConta>
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="flex min-w-0 flex-col gap-4" aria-label="Seus avisos">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2" aria-label="Filtrar notificações">
            <Chip href={LINK_AVISOS} ativo={!somenteNaoLidas}>Todas</Chip>
            <Chip href={`${LINK_AVISOS}?filtro=nao-lidas`} ativo={somenteNaoLidas}>Não lidas{naoLidos !== null ? ` (${naoLidos})` : ""}</Chip>
          </nav>
          <AtualizarRadar />
        </div>
        {naoLidos === null && <Aviso tipo="erro">Não foi possível atualizar a contagem. Use Atualizar para tentar novamente.</Aviso>}
        <MarcarAvisos desabilitado={naoLidos === null || naoLidos === 0} />
        {!dados ? <Aviso tipo="erro">Não conseguimos carregar seus avisos. Use Atualizar para tentar novamente.</Aviso> : dados.avisos.length === 0 ? (
          <Vazio titulo={pagina > 1 ? "Nenhum aviso nesta página" : somenteNaoLidas ? "Nenhum aviso não lido" : "Nenhum aviso por enquanto"} icone={<Bell />}
            texto={somenteNaoLidas ? "Você pode consultar os avisos anteriores em Todas." : "Quando uma loja enviar uma proposta ou um comprador escolher a sua oferta, o aviso aparece aqui."}>
            <Botao href={pagina > 1 || somenteNaoLidas ? LINK_AVISOS : LINK_RADAR} variante="secundario" larguraTotal icone={<Radar />}>{pagina > 1 || somenteNaoLidas ? "Ver todos os avisos" : "Ir para o Radar"}</Botao>
          </Vazio>
        ) : <>
          <ul className="flex min-w-0 flex-col overflow-hidden rounded-card bg-cartao shadow-1">
            {dados.avisos.map((a) => <li key={a.id} className="border-b border-borda last:border-b-0"><LinhaAviso aviso={a} /></li>)}
          </ul>
          {totalPaginas > 1 && <nav aria-label="Páginas de notificações" className="flex flex-wrap items-center justify-between gap-3">
            {pagina > 1 && <Botao href={linkPagina(pagina - 1)} variante="secundario">Anterior</Botao>}
            <span className="text-sm text-texto-suave tabular-nums">Página {pagina} de {totalPaginas}</span>
            {pagina < totalPaginas && <Botao href={linkPagina(pagina + 1)} variante="secundario">Próxima</Botao>}
          </nav>}
        </>}
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-escolher-avisos">
        <h2 id="titulo-escolher-avisos" className="text-lg font-bold">O que você quer receber</h2>
        <p className="text-[15px] text-texto-suave">Ligue ou desligue os avisos no site. Desligar uma opção não apaga os avisos anteriores.</p>
        {preferencias.status === "rejected" ? <Aviso tipo="erro">Não conseguimos carregar suas preferências. Use Atualizar para tentar novamente.</Aviso> : preferencias.value.length === 0 ? <p className="text-sm text-texto-suave">Nenhuma preferência disponível no momento.</p> :
          <ul className="flex flex-col gap-3">{preferencias.value.map((p) => <li key={p.tipo}><PreferenciaAvisoBotao preferencia={p} /></li>)}</ul>}
      </section>
    </div>
  </PaginaConta>;
}
