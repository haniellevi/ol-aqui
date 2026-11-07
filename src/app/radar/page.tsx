// app/radar/page.tsx
// Server Component: busca os pedidos e decide, NO SERVIDOR, o que o usuário pode ver.
// Quem não tem acesso ao Radar nunca recebe detalhes nem nome do comprador no HTML.
// Preços dos planos vêm da tabela `planos` (editável no painel), nunca do código.
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { RadarDeNegocios, type PedidoRadar, type PlanoResumo } from "@/components/radar/radar-de-negocios";

export const metadata = {
  title: "Radar de Negócios · OLAKI",
  description: "Veja o que os compradores da sua região estão procurando agora.",
};

export default async function RadarPage() {
  // o middleware já exige login nesta rota
  const userId = await garantirPerfil();
  const supabase = await createClient();

  const [{ data: acesso }, { data: restantes }, { data: perfil }, { data: planos }] = await Promise.all([
    supabase.rpc("tem_plano_pago"),
    supabase.rpc("propostas_restantes"),
    supabase.from("perfis").select("microrregiao_id").eq("id", userId!).single(),
    supabase
      .from("planos")
      .select("codigo, nome, preco_centavos")
      .eq("acesso_radar", true)
      .eq("e_teste", false)
      .order("ordem"),
  ]);
  const temAcesso = acesso === true;

  const { data } = await supabase
    .from("radar_feed")
    .select(
      "id, categoria, titulo, detalhes, preco_max_centavos, cidade, urgencia, total_propostas, max_propostas, modo_contato, propostas_ate, criado_em, comprador_certificado, comprador_primeiro_nome, ja_propus",
    )
    .eq("microrregiao_id", perfil?.microrregiao_id)
    .order("criado_em", { ascending: false })
    .limit(40);

  const pedidos: PedidoRadar[] = (data ?? []).map((p) => ({
    id: p.id,
    categoria: p.categoria,
    titulo: p.titulo,
    cidade: p.cidade,
    urgencia: p.urgencia,
    precoMaxCentavos: p.preco_max_centavos,
    totalPropostas: p.total_propostas,
    maxPropostas: p.max_propostas,
    modoContato: p.modo_contato,
    propostasAte: p.propostas_ate,
    criadoEm: p.criado_em,
    compradorCertificado: p.comprador_certificado,
    jaPropus: p.ja_propus,
    // Bloqueio real: dados sensíveis só vão para quem tem acesso.
    detalhes: temAcesso ? p.detalhes : null,
    compradorNome: temAcesso ? p.comprador_primeiro_nome : null,
  }));

  return (
    <RadarDeNegocios
      pedidos={pedidos}
      temAcesso={temAcesso}
      propostasRestantes={temAcesso ? (restantes as number | null) : 0}
      planos={(planos ?? []) as PlanoResumo[]}
    />
  );
}
