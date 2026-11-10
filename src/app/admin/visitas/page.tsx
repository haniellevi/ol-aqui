import Link from "next/link";
import { exigirTela } from "@/lib/admin/equipe";
import { inteiro } from "@/lib/admin/formato";
import { SITE } from "@/lib/formato";
import { hojeLocal } from "@/lib/admin/hoje";
import { Aviso, Cartao, Numero, Titulo } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Barras } from "../relatorios/barras";
import { GeradorLink } from "./gerador-link";
import { Origens, type OrigemLinha } from "./origens";

export const metadata = { title: "Visitas e origem" };
export const dynamic = "force-dynamic";

const PERIODOS = [
  { dias: 7, nome: "7 dias" },
  { dias: 30, nome: "30 dias" },
  { dias: 90, nome: "90 dias" },
] as const;

type Resumo = {
  visitas: number;
  pessoas: number;
  novas: number;
  celular: number;
  por_dia: { dia: string; visitas: number; pessoas: number }[];
  por_origem: { codigo: string; nome: string; visitas: number; pessoas: number; contas: number }[];
  por_campanha: { campanha: string; origem: string; visitas: number; pessoas: number }[];
  paginas: { caminho: string; visitas: number }[];
  contas_novas: number;
  contas_com_origem: number;
};

const DESTINOS = [
  { valor: "/", nome: "Página inicial" },
  { valor: "/lojas", nome: "Lista de lojas" },
  { valor: "/radar", nome: "Radar (pedir um produto)" },
  { valor: "/quero-vender", nome: "Quero vender (cadastro de loja)" },
  { valor: "/planos", nome: "Planos" },
  { valor: "loja", nome: "A vitrine de uma loja" },
];

export default async function VisitasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { supabase } = await exigirTela("visitas");
  const pedido = Number((await searchParams).dias);
  const dias = PERIODOS.some((p) => p.dias === pedido) ? pedido : 30;
  const agora = new Date();
  const ate = hojeLocal(agora);
  const de = hojeLocal(new Date(agora.getTime() - (dias - 1) * 86_400_000));

  const [resumoR, origensR, lojasR] = await Promise.all([
    supabase.rpc("admin_visitas", { p_de: de, p_ate: ate }),
    supabase.from("origens_visita").select("codigo, nome, dominios, ordem, ativa").order("ordem"),
    supabase.from("vitrines_lojas").select("slug, nome, cidade").eq("status", "ativa").order("nome").limit(1000),
  ]);
  const r = resumoR.data as Resumo | null;
  const origens = (origensR.data ?? []) as OrigemLinha[];
  const paraLink = origens.filter((o) => o.ativa && o.codigo !== "direto" && o.codigo !== "outro_site").map((o) => ({ valor: o.codigo, nome: o.nome }));
  const lojas = (lojasR.data ?? []).map((l) => ({ valor: l.slug as string, nome: l.nome as string, detalhe: (l.cidade as string) ?? undefined }));
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
  const nomeOrigem = new Map(origens.map((o) => [o.codigo, o.nome]));

  return (
    <>
      <Titulo sub="De onde vem quem visita o site: Instagram, rádio, QR da loja e o resto.">Visitas e origem</Titulo>

      <nav aria-label="Período" className="mb-4 flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/admin/visitas?dias=${p.dias}`}
            aria-current={p.dias === dias ? "page" : undefined}
            className={`olaki-controle-pequeno inline-flex min-h-8 items-center rounded-full border px-3 text-legenda font-medium ${
              p.dias === dias ? "border-beringela bg-beringela text-white" : "border-borda bg-cartao text-beringela hover:bg-fundo"
            }`}
          >
            {p.nome}
          </Link>
        ))}
      </nav>

      {resumoR.error || !r ? (
        <Aviso tipo="erro">Não consegui carregar as visitas agora. Atualize a página.</Aviso>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Numero rotulo="Pessoas" valor={inteiro(r.pessoas)} detalhe={`${inteiro(r.novas)} vieram pela primeira vez`} />
            <Numero rotulo="Páginas vistas" valor={inteiro(r.visitas)} />
            <Numero rotulo="No celular" valor={pct(r.celular, r.visitas)} />
            <Numero rotulo="Contas criadas" valor={inteiro(r.contas_novas)} detalhe={`${inteiro(r.contas_com_origem)} com origem conhecida`} />
          </div>

          {r.visitas === 0 ? (
            <Cartao className="text-sm text-texto-suave">Ainda não há visitas neste período. A contagem começou agora: volte amanhã.</Cartao>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Cartao>
                  <h2 className="mb-3 text-xl font-semibold text-beringela">Pessoas por origem</h2>
                  <Barras
                    rotulo="Pessoas por origem"
                    itens={r.por_origem.map((o) => ({
                      rotulo: o.nome,
                      valor: o.pessoas,
                      texto: inteiro(o.pessoas),
                      detalhe: `${inteiro(o.visitas)} páginas · ${inteiro(o.contas)} ${o.contas === 1 ? "conta criada" : "contas criadas"}`,
                    }))}
                  />
                </Cartao>
                <Cartao>
                  <h2 className="mb-3 text-xl font-semibold text-beringela">Pessoas por dia</h2>
                  <Barras
                    rotulo="Pessoas por dia"
                    cor="beringela"
                    itens={r.por_dia.slice(-14).reverse().map((d) => ({
                      rotulo: new Date(`${d.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
                      valor: d.pessoas,
                      texto: inteiro(d.pessoas),
                    }))}
                  />
                  {r.por_dia.length > 14 && <p className="mt-2 text-legenda text-texto-suave">Últimos 14 dias com visita.</p>}
                </Cartao>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Cartao>
                  <h2 className="mb-2 text-xl font-semibold text-beringela">Campanhas</h2>
                  {r.por_campanha.length === 0 ? (
                    <p className="text-sm text-texto-suave">Nenhum link com nome de campanha foi usado. Crie um abaixo.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Campanha</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Pessoas</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {r.por_campanha.map((c) => (
                          <TableRow key={`${c.campanha}-${c.origem}`}>
                            <TableCell className="[overflow-wrap:anywhere]">{c.campanha}</TableCell>
                            <TableCell>{nomeOrigem.get(c.origem) ?? c.origem}</TableCell>
                            <TableCell className="text-right tabular-nums">{inteiro(c.pessoas)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Cartao>
                <Cartao>
                  <h2 className="mb-2 text-xl font-semibold text-beringela">Páginas mais vistas</h2>
                  <Table>
                    <TableHeader><TableRow><TableHead>Página</TableHead><TableHead className="text-right">Vezes</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {r.paginas.map((p) => (
                        <TableRow key={p.caminho}>
                          <TableCell className="[overflow-wrap:anywhere]">{p.caminho}</TableCell>
                          <TableCell className="text-right tabular-nums">{inteiro(p.visitas)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Cartao>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <GeradorLink site={SITE} origens={paraLink} destinos={DESTINOS} lojas={lojas} />
        <Cartao>
          <h2 className="text-xl font-semibold text-beringela">Origens</h2>
          <p className="mt-1 text-sm text-texto-suave">Quem chega por um site da lista conta para aquela origem, mesmo sem link marcado.</p>
          <Origens origens={origens} />
        </Cartao>
      </div>
    </>
  );
}
