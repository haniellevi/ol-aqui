"use client";

import { useEffect, useState } from "react";
import { estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { LINK_ADMIN_RELATORIOS } from "@/lib/rotas";

// Filtros da tela 15 (período e região). Vai pelo endereço (?de=&ate=&regiao=), então o link pode ser
// guardado ou mandado para alguém. O botão mostra "Carregando…" e trava até a página nova chegar.

export function FiltrosRelatorio({
  de,
  ate,
  regiao,
  regioes,
}: {
  de: string;
  ate: string;
  regiao: string | null;
  regioes: { id: string; nome: string }[];
}) {
  const [carregando, setCarregando] = useState(false);
  // Voltar pelo navegador pode trazer a página guardada com o botão ainda girando
  useEffect(() => {
    const destravar = () => setCarregando(false);
    window.addEventListener("pageshow", destravar);
    return () => window.removeEventListener("pageshow", destravar);
  }, []);
  return (
    <form method="get" action={LINK_ADMIN_RELATORIOS} onSubmit={() => setCarregando(true)} className="grid grid-cols-1 items-end gap-3 @sm/painel:grid-cols-2 @3xl/painel:grid-cols-4">
      <label className="text-sm font-medium text-beringela">
        De
        <input type="date" name="de" defaultValue={de} required className={estiloCampo} />
      </label>
      <label className="text-sm font-medium text-beringela">
        Até
        <input type="date" name="ate" defaultValue={ate} required className={estiloCampo} />
      </label>
      <label className="col-span-full @3xl/painel:col-span-2 text-sm font-medium text-beringela">
        Região
        <select name="regiao" defaultValue={regiao ?? ""} className={estiloCampo}>
          <option value="">Todas as regiões</option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="col-span-full ">
        <Botao type="submit" carregando={carregando} textoCarregando="Carregando…" className="w-full md:w-auto">
          Ver relatório
        </Botao>
      </div>
    </form>
  );
}
