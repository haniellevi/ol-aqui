"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Seletor } from "./seletor";
import { ABAS_ANUNCIOS } from "./situacao-anuncios";

export function FiltroMeusAnuncios({ aba, contagem }: { aba: string; contagem: Record<string, number> }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return <div className="sm:hidden">
    <Seletor rotulo="Situação dos anúncios" name="situacao" key={aba} defaultValue={aba} disabled={pendente}
      onChange={(e) => {
        const destino = e.target.value;
        iniciar(() => router.push(`/minha-conta/anuncios?aba=${destino}`, { scroll: false }));
      }}>
      {ABAS_ANUNCIOS.map((a) => <option key={a.chave} value={a.chave}>{a.nome} ({contagem[a.chave]})</option>)}
    </Seletor>
  </div>;
}
