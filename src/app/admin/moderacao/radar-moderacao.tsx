import { exigirTela } from "@/lib/admin/equipe";
import { quando, reais } from "@/lib/admin/formato";
import { Aviso, Cartao, estiloCampo } from "@/components/admin/ui";
import { classesBotao } from "@/components/ui/botao";
import { BotaoDecisao } from "./botao-decisao";
import { moderarRadar } from "./actions";

// Radar na moderação: pedidos e propostas mais recentes, com ocultar / devolver / remover e o motivo.
// A regra e o histórico ficam no banco (moderar_radar + logs_atividade).
const NA_TELA = 25;

type LinhaPedido = {
  id: string;
  titulo: string;
  detalhes: string | null;
  cidade: string;
  status: string;
  fechado_motivo: string | null;
  moderado_motivo: string | null;
  total_propostas: number;
  criado_em: string;
};

type LinhaProposta = {
  id: string;
  preco_centavos: number | null;
  mensagem: string | null;
  foto_url: string | null;
  status: "ativa" | "oculta";
  moderado_motivo: string | null;
  criado_em: string;
  vitrines_lojas: { nome: string } | { nome: string }[] | null;
  radar_pedidos: { titulo: string } | { titulo: string }[] | null;
};

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function RadarModeracao({ erro, ok }: { erro?: string; ok?: string }) {
  const { supabase } = await exigirTela("moderacao");
  const [pedidosR, propostasR] = await Promise.all([
    supabase
      .from("radar_pedidos")
      .select("id, titulo, detalhes, cidade, status, fechado_motivo, moderado_motivo, total_propostas, criado_em")
      .neq("status", "em_analise")
      .order("criado_em", { ascending: false })
      .limit(NA_TELA),
    supabase
      .from("radar_propostas")
      .select("id, preco_centavos, mensagem, foto_url, status, moderado_motivo, criado_em, vitrines_lojas(nome), radar_pedidos(titulo)")
      .order("criado_em", { ascending: false })
      .limit(NA_TELA),
  ]);
  const pedidos = (pedidosR.data ?? []) as LinhaPedido[];
  const propostas = (propostasR.data ?? []) as unknown as LinhaProposta[];

  return (
    <section id="radar" className="mt-8 scroll-mt-20">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">Radar: pedidos mais novos</h2>
      {(erro || ok) && (
        <div className="mb-3">
          <Aviso tipo={erro ? "erro" : "ok"}>{erro ?? ok}</Aviso>
        </div>
      )}
      {pedidosR.error && <Aviso tipo="erro">Não foi possível carregar os pedidos. Recarregue para tentar novamente.</Aviso>}
      {!pedidosR.error && pedidos.length === 0 && <Cartao className="text-sm text-texto-suave">Nenhum pedido no Radar ainda.</Cartao>}
      <div className="space-y-4">
        {pedidos.map((p) => {
          const tirado = p.fechado_motivo === "moderacao";
          return (
            <Cartao key={p.id}>
              <p className="font-semibold text-beringela">{p.titulo}</p>
              <p className="text-sm text-texto-suave">
                {p.cidade} · {quando(p.criado_em)} · {p.total_propostas} propostas · {tirado ? "tirado pela equipe" : p.status}
              </p>
              {p.moderado_motivo && <p className="mt-1 text-legenda font-semibold text-aviso">Motivo: {p.moderado_motivo}</p>}
              {p.detalhes && <p className="mt-2 line-clamp-3 text-sm text-texto-suave">{p.detalhes}</p>}
              <FormModerar tipo="pedido" id={p.id} oculto={tirado} />
            </Cartao>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Radar: propostas mais novas</h2>
      {propostasR.error && <Aviso tipo="erro">Não foi possível carregar as propostas. Recarregue para tentar novamente.</Aviso>}
      {!propostasR.error && propostas.length === 0 && <Cartao className="text-sm text-texto-suave">Nenhuma proposta ainda.</Cartao>}
      <div className="space-y-4">
        {propostas.map((r) => (
          <Cartao key={r.id}>
            <div className="flex gap-3">
              {r.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.foto_url} alt="" className="size-16 shrink-0 rounded-card object-cover" />
              ) : null}
              <div className="min-w-0">
                <p className="font-semibold text-beringela">
                  {um(r.vitrines_lojas)?.nome ?? "—"} · {r.preco_centavos != null ? reais(r.preco_centavos) : "sem preço"}
                </p>
                <p className="text-sm text-texto-suave">
                  Para “{um(r.radar_pedidos)?.titulo ?? "—"}” · {quando(r.criado_em)} · {r.status === "oculta" ? "oculta" : "no ar"}
                </p>
                {r.moderado_motivo && <p className="mt-1 text-legenda font-semibold text-aviso">Motivo: {r.moderado_motivo}</p>}
                {r.mensagem && <p className="mt-1 text-sm text-texto-suave">{r.mensagem}</p>}
              </div>
            </div>
            <FormModerar tipo="proposta" id={r.id} oculto={r.status === "oculta"} />
          </Cartao>
        ))}
      </div>
    </section>
  );
}

function FormModerar({ tipo, id, oculto }: { tipo: "pedido" | "proposta"; id: string; oculto: boolean }) {
  return (
    <div className="mt-4 space-y-2">
      <form action={moderarRadar.bind(null, "")} className="space-y-2">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="id" value={id} />
        <input name="motivo" maxLength={300} placeholder="Motivo (o dono vê e fica no histórico)" className={estiloCampo} aria-label="Motivo" />
        <label className="flex min-h-10 items-center gap-3 text-sm text-texto">
          <input type="checkbox" name="confirmar_remover" value="sim" className="size-5 accent-laranja-escuro" />
          Sim, remover de vez{tipo === "pedido" ? " (apaga também as propostas)" : ""}. Não dá para desfazer.
        </label>
        <div className="flex flex-wrap gap-2">
          {oculto ? (
            <BotaoAcao acao="devolver" variante="secundario" texto="Devolver ao ar" />
          ) : (
            <BotaoAcao acao="ocultar" variante="secundario" texto="Ocultar" />
          )}
          <BotaoAcao acao="remover" variante="perigo" texto="Remover" />
        </div>
      </form>
    </div>
  );
}

// A ação de cada botão é explícita; motivo e confirmação continuam no mesmo formulário.
function BotaoAcao({ acao, variante, texto }: { acao: string; variante: "secundario" | "perigo"; texto: string }) {
  return (
    <BotaoDecisao action={moderarRadar.bind(null, acao)} className={classesBotao(variante)}>
      {texto}
    </BotaoDecisao>
  );
}
