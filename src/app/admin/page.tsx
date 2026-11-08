import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/admin/equipe";
import { primeiraTela } from "@/lib/tipos-equipe";
import { inteiro, reais } from "@/lib/admin/formato";
import { Cartao, Numero, Titulo } from "@/components/admin/ui";

export const metadata = { title: "Resumo" };

type Vitrine = { plano: string; status: string; teste_expira_em: string; plano_expira_em: string | null };

export default async function ResumoPage() {
  // O Resumo (dinheiro de todas as regiões) é só do administrador; os outros papéis vão para a tela deles.
  const { supabase, papel } = await exigirEquipe();
  if (papel !== "administrador") redirect(primeiraTela(papel));
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const contar = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [vitrinesR, planosR, pagosR, abertosR, anunciosAtivos, pedidosAbertos, propostasMes, emAnalise, pedidosAnalise, denuncias] =
    await Promise.all([
      supabase.from("vitrines_lojas").select("plano, status, teste_expira_em, plano_expira_em"),
      supabase.from("planos").select("codigo, nome, e_teste, preco_centavos").order("ordem"),
      supabase.from("pagamentos").select("valor_centavos").eq("status", "pago").gte("pago_em", inicioMes),
      supabase.from("pagamentos").select("status").in("status", ["pendente", "vencido"]),
      contar(supabase.from("anuncios").select("id", { count: "exact", head: true }).eq("status", "ativo")),
      contar(supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).eq("status", "aberto")),
      contar(supabase.from("radar_propostas").select("id", { count: "exact", head: true }).gte("criado_em", inicioMes)),
      contar(supabase.from("anuncios").select("id", { count: "exact", head: true }).eq("status", "em_analise")),
      contar(supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).eq("status", "em_analise")),
      contar(supabase.from("denuncias").select("id", { count: "exact", head: true }).eq("status", "aberta")),
    ]);

  // Radar no mês (pedidos feitos, quantos receberam proposta e quantas propostas foram escolhidas)
  const [pedidosMes, pedidosComProposta, escolhidasMes] = await Promise.all([
    contar(supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).gte("criado_em", inicioMes)),
    contar(supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).gte("criado_em", inicioMes).gt("total_propostas", 0)),
    contar(supabase.from("radar_propostas").select("id", { count: "exact", head: true }).gte("escolhida_em", inicioMes)),
  ]);

  const vitrines = (vitrinesR.data ?? []) as Vitrine[];
  const planos = planosR.data ?? [];
  const pagante = (v: Vitrine) => v.status === "ativa" && v.plano_expira_em && new Date(v.plano_expira_em) > agora;
  const emTeste = vitrines.filter((v) => v.plano === "teste" && v.status === "ativa" && new Date(v.teste_expira_em) > agora).length;
  const porPlano = planos
    .filter((p) => !p.e_teste && p.preco_centavos > 0)
    .map((p) => ({ ...p, total: vitrines.filter((v) => v.plano === p.codigo && pagante(v)).length }));
  const receitaMes = (pagosR.data ?? []).reduce((s, p) => s + (p.valor_centavos ?? 0), 0);
  const inadimplentes = (abertosR.data ?? []).filter((p) => p.status === "vencido").length;
  const fila = emAnalise + pedidosAnalise + denuncias;
  const mrr = porPlano.reduce((s, p) => s + p.total * p.preco_centavos, 0);

  return (
    <>
      <Titulo sub={`Atualizado agora · ${agora.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}`}>Resumo</Titulo>

      {fila > 0 && (
        <Link href="/admin/moderacao" className="mb-6 flex min-h-12 items-center justify-between gap-3 rounded-card bg-perigo-fundo px-4 py-3 text-sm font-semibold text-perigo active:brightness-90">
          <span>
            {fila} {fila === 1 ? "item espera" : "itens esperam"} revisão: {emAnalise} anúncios, {pedidosAnalise} pedidos, {denuncias} denúncias
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">Dinheiro</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Recebido no mês" valor={reais(receitaMes)} />
        <Numero rotulo="Receita mensal recorrente" valor={reais(mrr)} detalhe="assinaturas em dia × preço atual" />
        <Numero rotulo="Cobranças vencidas" valor={inteiro(inadimplentes)} alerta={inadimplentes > 0} />
        <Numero rotulo="Cobranças pendentes" valor={inteiro((abertosR.data ?? []).length - inadimplentes)} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Lojistas</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Vitrines no total" valor={inteiro(vitrines.length)} />
        <Numero rotulo="Em teste grátis" valor={inteiro(emTeste)} />
        {porPlano.map((p) => (
          <Numero key={p.codigo} rotulo={`Pagantes ${p.nome}`} valor={inteiro(p.total)} detalhe={`${reais(p.preco_centavos)}/mês`} />
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Movimento</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Anúncios no ar" valor={inteiro(anunciosAtivos)} />
        <Numero rotulo="Pedidos abertos no Radar" valor={inteiro(pedidosAbertos)} />
        <Numero rotulo="Propostas no mês" valor={inteiro(propostasMes)} />
        <Numero
          rotulo="Propostas por pedido"
          valor={pedidosAbertos ? (propostasMes / pedidosAbertos).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
          detalhe="mede se o Radar está vivo"
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Radar no mês</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Pedidos feitos" valor={inteiro(pedidosMes)} />
        <Numero
          rotulo="Pedidos com proposta"
          valor={inteiro(pedidosComProposta)}
          detalhe={pedidosMes ? `${Math.round((pedidosComProposta / pedidosMes) * 100)}% dos pedidos` : undefined}
        />
        <Numero rotulo="Propostas escolhidas" valor={inteiro(escolhidasMes)} detalhe="comprador chamou no WhatsApp" />
      </div>

      {vitrines.length === 0 && (
        <Cartao className="mt-8 text-sm text-texto-suave">
          Ainda não há lojistas cadastrados. Assim que o piloto em Corrente começar, os números aparecem aqui.
        </Cartao>
      )}
    </>
  );
}
