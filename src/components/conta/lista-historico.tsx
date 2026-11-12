import { History } from "lucide-react";
import { Vazio } from "@/components/ui/vazio";
import { fraseHistorico, type AlvoHistorico, type LinhaHistorico } from "@/lib/historico";

/** Lista do histórico (anúncio ou loja): uma linha por mudança, mais recente primeiro, com o motivo quando houver. */
export function ListaHistorico({ linhas, vazio, alvo = "anuncio" }: { linhas: LinhaHistorico[]; vazio: string; alvo?: AlvoHistorico }) {
  if (!linhas.length) return <Vazio titulo="Nenhuma mudança registrada" texto={vazio} icone={<History />} />;
  return (
    <ol aria-label="Mudanças, da mais recente para a mais antiga" className="divide-y divide-borda rounded-card bg-cartao shadow-1">
      {linhas.map((l, i) => (
        <li key={`${l.quando}-${i}`} className="px-4 py-3 [overflow-wrap:anywhere]">
          <p className="text-base">{fraseHistorico(l, new Date(), alvo)}</p>
          {l.motivo && <p className="mt-1 text-sm text-texto-suave">Motivo: {l.motivo}</p>}
        </li>
      ))}
    </ol>
  );
}
