"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** O pedido tem navegação própria; as demais rotas mantêm a casca pública. */
export function CascaRadar({ children, cabecalho, navegacao, termos }: { children: ReactNode; cabecalho: ReactNode; navegacao: ReactNode; termos?: ReactNode }) {
  const pedindo = usePathname() === "/radar/pedir";
  return <>{!pedindo && cabecalho}<div id="conteudo" className={pedindo ? undefined : "pb-reserva-nav md:pb-0"}>{!pedindo && termos}{children}</div>{!pedindo && navegacao}</>;
}
