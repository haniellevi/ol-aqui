import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { inteiro } from "@/lib/admin/formato";
import { Aviso, Cartao, Titulo } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

// Etapa P4: métricas do produto para a equipe. Só números somados (função admin_metricas_produtos,
// que confere e_admin no banco). Nenhuma pessoa aparece aqui.

const PERIODOS = [7, 30, 90] as const;
const VISOES = [
  { valor: "categoria", nome: "Por categoria" },
  { valor: "regiao", nome: "Por região" },
  { valor: "produto", nome: "Por produto" },
] as const;

type Grupo = {
  rotulo: string;
  produtos: number;
  aparicoes: number;
  visualizacoes: number;
  cliques_whatsapp: number;
  favoritos: number;
  posicao_media: number | null;
  pct_chamou: number | null;
  tempo_medio_dias: number | null;
};

type Produto = {
  anuncio_id: string;
  titulo: string;
  status: string;
  loja: string;
  categoria: string;
  regiao: string;
  aparicoes: number;
  visualizacoes: number;
  cliques_whatsapp: number;
  favoritos: number;
  pct_chamou: number | null;
  termos: { termo: string; vezes: number }[];
  tempo_ate_sair_dias: number | null;
};

type Params = Promise<{ dias?: string; visao?: string }>;

const pct = (n: number | null) => (n === null ? "—" : `${inteiro(n)}%`);
const media = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const SITUACAO: Record<string, string> = { ativo: "No ar", vendido: "Vendido", pausado: "Pausado", expirado: "Vencido", excluido: "Na lixeira", em_analise: "Em análise", congelado: "Congelado" };

export default async function PaginaProdutos({ searchParams }: { searchParams: Params }) {
  const { supabase } = await exigirAdmin();
  const sp = await searchParams;
  const pedido = Number(sp.dias);
  const dias = (PERIODOS as readonly number[]).includes(pedido) ? pedido : 30;
  const visao = VISOES.some((v) => v.valor === sp.visao) ? (sp.visao as (typeof VISOES)[number]["valor"]) : "produto";

  const { data, error } = await supabase.rpc("admin_metricas_produtos", { p_dias: dias, p_visao: visao });
  const linhas = Array.isArray(data) ? data : null;
  const grupos = visao !== "produto" ? (linhas as Grupo[] | null) : null;
  const produtos = visao === "produto" ? (linhas as Produto[] | null) : null;
  const link = (d: number, v: string) => `/admin/produtos?dias=${d}&visao=${v}`;

  return (
    <>
      <Titulo sub="Quantas pessoas viram e chamaram por categoria, região e produto. Só números: nenhuma pessoa aparece aqui.">Produtos</Titulo>

      <nav aria-label="Período" className="mb-3 flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link key={p} href={link(p, visao)} aria-current={p === dias ? "page" : undefined}
            className={`olaki-controle-pequeno inline-flex min-h-8 items-center rounded-full border px-3 text-legenda font-medium ${
              p === dias ? "border-beringela bg-beringela text-white" : "border-borda bg-cartao text-beringela hover:bg-fundo"}`}>
            {p} dias
          </Link>
        ))}
      </nav>
      <nav aria-label="Visão" className="mb-4 flex flex-wrap gap-2">
        {VISOES.map((v) => (
          <Link key={v.valor} href={link(dias, v.valor)} aria-current={v.valor === visao ? "page" : undefined}
            className={`olaki-controle-pequeno inline-flex min-h-8 items-center rounded-full border px-3 text-legenda font-medium ${
              v.valor === visao ? "border-beringela bg-beringela text-white" : "border-borda bg-cartao text-beringela hover:bg-fundo"}`}>
            {v.nome}
          </Link>
        ))}
      </nav>

      {error || !linhas ? (
        <Aviso tipo="erro">Não consegui carregar os produtos agora. Atualize a página.</Aviso>
      ) : linhas.length === 0 ? (
        <Cartao className="text-sm text-texto-suave">Nenhum produto teve número neste período.</Cartao>
      ) : grupos ? (
        <Cartao>
          <Table rotulo={visao === "categoria" ? "Números por categoria" : "Números por região"} className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>{visao === "categoria" ? "Categoria" : "Região"}</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="text-right">Apareceu</TableHead>
                <TableHead className="text-right">Abriram</TableHead>
                <TableHead className="text-right">WhatsApp</TableHead>
                <TableHead className="text-right">De 100 que abriram, chamaram</TableHead>
                <TableHead className="text-right">Favoritos</TableHead>
                <TableHead className="text-right">Lugar médio</TableHead>
                <TableHead className="text-right">Dias no ar até sair (média)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map((g) => (
                <TableRow key={g.rotulo}>
                  <TableCell className="[overflow-wrap:anywhere]">{g.rotulo}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(g.produtos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(g.aparicoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(g.visualizacoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(g.cliques_whatsapp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(g.pct_chamou)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(g.favoritos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{media(g.posicao_media)}</TableCell>
                  <TableCell className="text-right tabular-nums">{media(g.tempo_medio_dias)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Cartao>
      ) : (
        <Cartao>
          <p className="mb-2 text-legenda text-texto-suave">Os 30 produtos mais vistos do período.</p>
          <Table rotulo="Números dos produtos mais vistos" className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Região</TableHead>
                <TableHead className="text-right">Apareceu</TableHead>
                <TableHead className="text-right">Abriram</TableHead>
                <TableHead className="text-right">WhatsApp</TableHead>
                <TableHead className="text-right">De 100 que abriram, chamaram</TableHead>
                <TableHead className="text-right">Favoritos</TableHead>
                <TableHead>Palavras que trouxeram</TableHead>
                <TableHead className="text-right">Dias no ar até sair</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(produtos ?? []).map((p) => (
                <TableRow key={p.anuncio_id}>
                  <TableCell className="min-w-44 [overflow-wrap:anywhere]">
                    {p.titulo}
                    <span className="block text-legenda text-texto-suave">{SITUACAO[p.status] ?? p.status}</span>
                  </TableCell>
                  <TableCell className="[overflow-wrap:anywhere]">{p.loja}</TableCell>
                  <TableCell>{p.regiao}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(p.aparicoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(p.visualizacoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(p.cliques_whatsapp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(p.pct_chamou)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(p.favoritos)}</TableCell>
                  <TableCell className="[overflow-wrap:anywhere]">{p.termos.length ? p.termos.map((t) => `${t.termo} (${inteiro(t.vezes)})`).join(", ") : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.tempo_ate_sair_dias === null ? "—" : inteiro(p.tempo_ate_sair_dias)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Cartao>
      )}
    </>
  );
}
