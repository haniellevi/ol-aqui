import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { CHAVES_DE_MODELO, CHAVES_DE_PLANO, NOMES_GRUPO, OPCOES_FIXAS, tipoDe, valorParaForm, type Opcao } from "@/lib/admin/config";
import { quando } from "@/lib/admin/formato";
import { MODELOS_FIXOS_IA } from "@/lib/ia-modelos";
import { Aviso, Cartao, Titulo } from "@/components/admin/ui";
import { configGenericaEditavel, permiteExcecaoRegional } from "@/lib/admin/config-visibilidade";
import { removerExcecao } from "./actions";
import { FormConfig, FormExcecao } from "./form-config";

export const metadata = { title: "Configurações" };

type Config = {
  id: string;
  chave: string;
  microrregiao_id: string | null;
  valor: unknown;
  descricao: string | null;
  grupo: string;
  publico: boolean;
  atualizado_em: string;
};

const AREAS = [
  { nome: "Comercial", texto: "Preços, planos e destaques.", links: [["Planos", "/admin/planos"], ["Destaques", "/admin/destaques"], ["Teste grátis e avulsos", "/admin/configuracoes?grupo=planos"]] },
  { nome: "Merc", texto: "Modelo, orçamento e qualidade das respostas.", links: [["Configurar Merc", "/admin/robo"]] },
  { nome: "IA do site", texto: "Modelo de IA de cada recurso: moderação, categorias, anúncios, lojas e Radar.", links: [["Modelos de IA", "/admin/configuracoes?grupo=ia"]] },
  { nome: "Conteúdo", texto: "Página inicial, ajuda e documentos.", links: [["Textos e página inicial", "/admin/textos"]] },
  { nome: "Região", texto: "Região atendida e cidades disponíveis.", links: [["Regiões e cidades", "/admin/regioes"]] },
  { nome: "Catálogo", texto: "Categorias e campos dos anúncios.", links: [["Categorias e campos", "/admin/categorias"], ["Categorias sugeridas", "/admin/categorias/sugeridas"]] },
  { nome: "Comunicação", texto: "Avisos no site e canais de contato.", links: [["Mensagens automáticas", "/admin/mensagens"], ["Contatos da equipe", "/admin/configuracoes?grupo=geral"]] },
  { nome: "Equipe", texto: "Pessoas com acesso ao painel.", links: [["Equipe e permissões", "/admin/equipe"]] },
  { nome: "Privacidade", texto: "Consultas e solicitações registradas.", links: [["Consultas e histórico", "/admin/compliance"]] },
];

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  const { supabase } = await exigirAdmin();
  const { grupo } = await searchParams;
  if (!grupo) return <>
    <Titulo sub="Abra a área que precisa ajustar.">Configurações</Titulo>
    <div className="grid gap-3 sm:grid-cols-2">
      {AREAS.map(area => <Cartao key={area.nome}>
        <h2 className="text-lg font-semibold text-beringela">{area.nome}</h2>
        <p className="mb-3 mt-1 text-sm text-texto-suave">{area.texto}</p>
        <div className="flex flex-wrap gap-3">{area.links.map(([nome, href]) => <Link key={href} href={href} className="inline-flex min-h-10 items-center text-sm font-semibold text-laranja-escuro hover:underline">{nome}</Link>)}</div>
      </Cartao>)}
    </div>
    <details className="mt-5 rounded-card border border-borda bg-cartao p-4">
      <summary className="cursor-pointer font-semibold text-beringela">Ajustes avançados</summary>
      <nav aria-label="Ajustes avançados" className="mt-3 flex flex-wrap gap-3">{Object.entries(NOMES_GRUPO).map(([id, nome]) => <Link key={id} href={`/admin/configuracoes?grupo=${id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-laranja-escuro hover:underline">{nome}</Link>)}</nav>
    </details>
  </>;
  const [{ data: configs, error: erroConfigs }, { data: regioes }, { data: planos }, { data: modelos }] = await Promise.all([
    supabase.from("configuracoes").select("*").order("chave"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    supabase.from("planos").select("codigo, nome").order("nome"),
    supabase.from("robo_modelos").select("provedor, modelo, nome").eq("ativo", true).order("nome"),
  ]);
  const opcoesPlano: Opcao[] = (planos ?? []).map((p) => ({ valor: p.codigo, nome: `${p.nome} (${p.codigo})` }));
  const opcoesModelo: Opcao[] = (modelos ?? []).map((m) => ({ valor: m.modelo, nome: `${m.nome} · ${m.provedor}` }));
  const opcoesDe = (chave: string): Opcao[] | undefined =>
    OPCOES_FIXAS[chave] ?? (CHAVES_DE_PLANO.has(chave) ? opcoesPlano : CHAVES_DE_MODELO.has(chave) ? opcoesModelo : undefined);
  const lista = (configs ?? []) as Config[];
  const nomesRegiao = new Map((regioes ?? []).map((r) => [r.id, r.nome]));
  const grupos = [...new Set(lista.map((c) => c.grupo))].sort(
    (a, b) => Object.keys(NOMES_GRUPO).indexOf(a) - Object.keys(NOMES_GRUPO).indexOf(b),
  );
  const grupoAtual = grupo;
  const globais = lista.filter((c) => c.grupo === grupoAtual && c.microrregiao_id === null && configGenericaEditavel(c.chave));
  const textosRadar = lista.filter(c => c.grupo === grupoAtual && c.microrregiao_id === null && c.chave.startsWith("radar.aviso."));

  return (
    <>
      <Link href="/admin/configuracoes" className="mb-3 inline-flex min-h-10 items-center text-sm font-semibold text-laranja-escuro hover:underline">Todas as configurações</Link>
      <Titulo>{NOMES_GRUPO[grupoAtual] ?? "Ajustes avançados"}</Titulo>
      {erroConfigs && <Aviso tipo="erro">Não foi possível carregar os ajustes. Tente novamente.</Aviso>}
      {grupoAtual === "robo" && <p className="mb-4 text-sm text-texto-suave">Modelo, orçamento e textos ficam em <Link href="/admin/robo" className="font-semibold underline">Configurar Merc</Link>.</p>}
      {grupoAtual === "ia" && <p className="mb-4 text-sm text-texto-suave">Cada recurso usa o modelo escolhido aqui. Sem escolha, usa o GPT-6 Luna. Se o modelo falhar, o recurso segue como antes da IA: o anúncio ou a loja vai para a revisão da equipe e o Radar funciona sem IA.</p>}
      {grupoAtual === "radar" && <p className="mb-4 text-sm text-texto-suave">Os textos dos avisos ficam em <Link href="/admin/mensagens" className="font-semibold underline">Mensagens automáticas</Link>.</p>}

      <nav aria-label="Seções do painel" className="admin-abas -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {grupos.map((g) => (
          <Link
            key={g}
            href={`/admin/configuracoes?grupo=${g}`}
            aria-current={g === grupoAtual ? "page" : undefined}
            className={`inline-flex h-10 shrink-0 items-center rounded-campo border px-4 text-sm font-semibold text-beringela active:brightness-90 ${
              g === grupoAtual ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao"
            }`}
          >
            {NOMES_GRUPO[g] ?? ({ anuncios: "Anúncios", busca: "Busca" } as Record<string, string>)[g] ?? g}
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        {globais.map((c) => {
          const tipo = tipoDe(c.valor);
          const excecoes = lista.filter((e) => e.chave === c.chave && e.microrregiao_id !== null);
          return (
            <Cartao key={c.id} id={c.chave}>
              <div className="mb-3">
                <h2 className="font-semibold text-beringela">{c.chave === "moderacao.palavras_bloqueadas" ? "Palavras bloqueadas no Radar" : c.chave === "moderacao.ia_ativa" ? "Análise automática de pendências antigas" : c.descricao ?? c.chave}</h2>
                <details className="text-legenda text-texto-suave [overflow-wrap:anywhere]"><summary className="cursor-pointer">Detalhes do ajuste</summary>
                  {c.chave} · {c.publico ? "visível no site" : "só no sistema"} · alterado em {quando(c.atualizado_em)}
                </details>
              </div>
              <FormConfig id={c.id} chave={c.chave} tipo={tipo} valor={c.valor} opcoes={opcoesDe(c.chave)} />

              {permiteExcecaoRegional(c.chave) && excecoes.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {excecoes.map((e) => (
                    <li key={e.id} className="flex min-h-10 flex-wrap items-center gap-3 rounded-card bg-selecao pl-3 pr-1 text-sm text-beringela">
                      <span className="font-semibold">{nomesRegiao.get(e.microrregiao_id!) ?? "Região"}:</span>
                      <span className="truncate font-mono text-legenda">{nomeValor(tipoDe(e.valor), e.valor, opcoesDe(c.chave))}</span>
                      <form action={removerExcecao} className="ml-auto">
                        <input type="hidden" name="id" value={e.id} />
                        <button className="h-10 px-3 text-sm font-semibold text-perigo underline">remover</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {permiteExcecaoRegional(c.chave) && (regioes ?? []).length > 0 && (
                <div className="mt-3">
                  <FormExcecao chave={c.chave} tipo={tipo} valor={c.valor} regioes={regioes ?? []} opcoes={opcoesDe(c.chave)} />
                </div>
              )}
            </Cartao>
          );
        })}
        {grupoAtual === "ia" && <Cartao id="modelos-fixos">
          <h2 className="font-semibold text-beringela">Recursos com modelo fixo</h2>
          <p className="mb-3 mt-1 text-sm text-texto-suave">Estes recursos não trocam de modelo aqui.</p>
          <ul className="space-y-3">
            {MODELOS_FIXOS_IA.map((f) => <li key={f.nome} className="text-sm text-beringela">
              <p className="font-semibold">{f.nome}: <span className="font-normal">{f.modelo}</span></p>
              <p className="text-texto-suave">{f.motivo}</p>
            </li>)}
          </ul>
        </Cartao>}
        {textosRadar.length > 0 && <details className="rounded-card border border-borda bg-cartao p-4">
          <summary className="cursor-pointer font-semibold text-beringela">Textos específicos por região</summary>
          <p className="mt-2 text-sm text-texto-suave">Use apenas quando uma região precisar de mensagem diferente do modelo geral.</p>
          {textosRadar.map(c => <div key={c.id} className="mt-4 border-t border-borda pt-3">
            <p className="text-sm text-texto-suave">{c.chave}</p>
            {lista.filter(e => e.chave === c.chave && e.microrregiao_id !== null).map(e => <div key={e.id} className="mt-2">
              <p className="text-sm font-semibold">{nomesRegiao.get(e.microrregiao_id!) ?? "Região"}</p>
              <FormConfig id={e.id} chave={e.chave} tipo={tipoDe(e.valor)} valor={e.valor} />
              <form action={removerExcecao}><input type="hidden" name="id" value={e.id} /><button className="min-h-10 text-sm text-perigo underline">Usar texto geral</button></form>
            </div>)}
            <FormExcecao chave={c.chave} tipo={tipoDe(c.valor)} valor={c.valor} regioes={regioes ?? []} />
          </div>)}
        </details>}
      </div>
    </>
  );
}

function nomeValor(tipo: ReturnType<typeof tipoDe>, valor: unknown, opcoes?: Opcao[]) {
  const texto = valorParaForm(tipo, valor);
  if (tipo === "simnao") return valor ? "Sim" : "Não";
  return opcoes?.find((o) => o.valor === texto)?.nome ?? texto.replace(/\n/g, " · ");
}
