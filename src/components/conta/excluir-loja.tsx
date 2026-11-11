"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { excluirMinhaLoja, restaurarMinhaLoja, type EstadoExcluirLoja } from "@/app/(conta)/minha-conta/loja/exclusao-actions";
import { Aviso } from "./aviso";

const PALAVRA = "EXCLUIR";

function dataCurta(iso?: string | null) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Fortaleza" })
    : "30 dias";
}

// Minha loja · Excluir minha loja: confirmação forte (escrever EXCLUIR). A conta continua.
export function ExcluirLoja({ temPagamentos }: { temPagamentos: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, acao, enviando] = useActionState<EstadoExcluirLoja, FormData>(excluirMinhaLoja, null);
  const campo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) campo.current?.querySelector("input")?.focus();
  }, [aberto]);

  if (estado?.ok) {
    return <Aviso tipo="ok">Sua loja saiu do ar e será apagada em {dataCurta(estado.apagarApos)}. Até lá, você pode restaurar aqui.</Aviso>;
  }

  if (!aberto) {
    return (
      <Botao variante="perigo" larguraTotal icone={<Trash2 />} onClick={() => setAberto(true)} className="sm:w-fit">
        Excluir minha loja
      </Botao>
    );
  }

  const confere = texto.trim().toUpperCase() === PALAVRA;
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card border border-perigo bg-perigo-fundo p-4">
      <h3 className="text-lg font-bold text-perigo">Tem certeza?</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
        <li>Sua vitrine e os anúncios da loja saem do ar na hora.</li>
        <li>Tudo fica guardado por 30 dias. Nesse prazo, você pode restaurar aqui.</li>
        <li>Depois de 30 dias, a loja é apagada de vez. Sua conta continua.</li>
        {temPagamentos && <li>Como esta loja já teve pagamento, você não poderá abrir outra loja com esta conta.</li>}
      </ul>
      <div ref={campo}>
        <Campo
          rotulo={`Para confirmar, escreva ${PALAVRA}`}
          name="confirmacao"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          erro={estado?.erro}
        />
      </div>
      <Botao type="submit" variante="perigo" larguraTotal icone={<Trash2 />} disabled={!confere} carregando={enviando} textoCarregando="Excluindo...">
        Excluir minha loja
      </Botao>
      <Botao variante="secundario" larguraTotal disabled={enviando} onClick={() => { setAberto(false); setTexto(""); }}>
        Não, manter minha loja
      </Botao>
    </form>
  );
}

// Minha loja · loja na lixeira: mostra o prazo e, se foi o dono quem excluiu, o botão de restaurar.
export function LojaNaLixeira({ apagarApos, podeRestaurar }: { apagarApos: string | null; podeRestaurar: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoExcluirLoja, FormData>(restaurarMinhaLoja, null);
  if (estado?.ok) return <Aviso tipo="ok">Sua loja voltou ao ar, com os anúncios que estavam publicados.</Aviso>;
  return (
    <div className="flex flex-col gap-3">
      <Aviso tipo="atencao">
        {podeRestaurar
          ? `Sua loja está fora do ar e será apagada em ${dataCurta(apagarApos)}.`
          : "Sua loja foi tirada do ar pela equipe. Fale com o suporte."}
      </Aviso>
      {podeRestaurar && (
        <form action={acao} className="flex flex-col gap-2">
          {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          <Botao type="submit" larguraTotal icone={<RotateCcw />} carregando={enviando} textoCarregando="Restaurando..." className="sm:w-fit">
            Restaurar minha loja
          </Botao>
        </form>
      )}
    </div>
  );
}
