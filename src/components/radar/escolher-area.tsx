"use client";

import { useState } from "react";
import { MapPin, Map as MapaIcone } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { CartaoEscolha } from "./cartao-escolha";

// Passo 2: onde vale o pedido. valor vazio = toda a região.
// "Escolher cidades" abre os chips; voltar para "Toda a região" limpa a lista.
export function EscolherArea({
  cidades,
  valor,
  onChange,
}: {
  cidades: { id: string; nome: string }[];
  valor: string[];
  onChange: (ids: string[]) => void;
}) {
  const [escolhendo, setEscolhendo] = useState(valor.length > 0);
  const semCidades = cidades.length === 0;

  function alternar(id: string) {
    onChange(valor.includes(id) ? valor.filter((v) => v !== id) : [...valor, id]);
  }

  return (
    <div className="flex flex-col gap-3">
      <CartaoEscolha
        nome="area"
        valor="regiao"
        marcado={!escolhendo}
        onEscolher={() => {
          setEscolhendo(false);
          onChange([]);
        }}
        icone={<MapaIcone />}
        titulo="Toda a região"
        ajuda="Todas as cidades da sua região."
      />
      <CartaoEscolha
        nome="area"
        valor="cidades"
        marcado={escolhendo}
        desabilitado={semCidades}
        onEscolher={() => setEscolhendo(true)}
        icone={<MapPin />}
        titulo="Escolher cidades"
        ajuda={semCidades ? "Nenhuma cidade cadastrada na sua região ainda." : "Só as cidades que você marcar."}
      >
        <div className="flex flex-col gap-2">
          <div role="group" aria-label="Cidades" className="flex flex-wrap gap-2">
            {cidades.map((c) => (
              <Chip key={c.id} ativo={valor.includes(c.id)} onClick={() => alternar(c.id)} className="min-h-12! text-lg!">
                {c.nome}
              </Chip>
            ))}
          </div>
          {valor.length === 0 && (
            <p role="status" className="text-lg text-beringela">
              Marque uma ou mais cidades. Sem nenhuma marcada, o pedido vale para toda a região.
            </p>
          )}
        </div>
      </CartaoEscolha>
    </div>
  );
}
