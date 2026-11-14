import { Chip } from "@/components/ui/chip";

export type AbaRadar = "meus" | "regiao" | "propostas";

const ROTULOS: Record<AbaRadar, string> = {
  meus: "Meus pedidos",
  regiao: "Pedidos na região",
  propostas: "Minhas propostas",
};

// Abas do Radar conforme quem é: comprador vê "Meus pedidos"; quem vende vê também a região e as propostas.
export function AbasRadar({ atual, abas }: { atual: AbaRadar; abas: AbaRadar[] }) {
  if (abas.length < 2) return null;
  return (
    <nav aria-label="Partes do Radar" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
      {abas.map((a) => (
        <Chip key={a} href={`/radar?aba=${a}`} ativo={a === atual}>
          {ROTULOS[a]}
        </Chip>
      ))}
    </nav>
  );
}
