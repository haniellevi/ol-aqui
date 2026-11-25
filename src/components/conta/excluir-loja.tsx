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

// Encerramento com confirmação forte (escrever EXCLUIR). A conta continua.
export function ExcluirLoja({ temPagamentos, pf = false }: { temPagamentos: boolean; pf?: boolean }) {
  const nome = pf ? "vitrine de vendedor" : "loja";
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, acao, enviando] = useActionState<EstadoExcluirLoja, FormData>(excluirMinhaLoja, null);
  const campo = useRef<HTMLDivElement>(null);
  const botaoExcluir = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberto) campo.current?.querySelector("input")?.focus();
  }, [aberto]);

  if (estado?.ok) {
    return <Aviso tipo="ok">Sua {nome} saiu do ar e será apagada em {dataCurta(estado.apagarApos)}. Até lá, você pode restaurar aqui.</Aviso>;
  }

  if (!aberto) {
    return (
      <Botao ref={botaoExcluir} variante="perigo" tamanho="toque" larguraTotal icone={<Trash2 />} onClick={() => setAberto(true)} className="sm:w-fit">
        Excluir minha {nome}
      </Botao>
    );
  }

  const confere = texto.trim().toUpperCase() === PALAVRA;
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card border border-perigo bg-perigo-fundo p-4">
      <h3 className="text-lg font-semibold text-perigo">Tem certeza?</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
        <li>Sua vitrine e seus anúncios saem do ar na hora.</li>
        <li>Tudo fica guardado por 30 dias. Nesse prazo, você pode restaurar aqui.</li>
        <li>Depois de 30 dias, o encerramento é definitivo. Sua conta continua.</li>
        {temPagamentos && <li>Os registros de pagamento ficam guardados. Após o prazo, você poderá criar outra vitrine.</li>}
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
        Excluir minha {nome}
      </Botao>
      <Botao variante="secundario" larguraTotal disabled={enviando} onClick={() => {
        setAberto(false);
        setTexto("");
        requestAnimationFrame(() => botaoExcluir.current?.focus({ preventScroll: true }));
      }}>
        Não, manter minha {nome}
      </Botao>
    </form>
  );
}

// Minha loja · loja na lixeira: mostra o prazo e, se foi o dono quem excluiu, o botão de restaurar.
export function LojaNaLixeira({ apagarApos, podeRestaurar, pf = false }: { apagarApos: string | null; podeRestaurar: boolean; pf?: boolean }) {
  const nome = pf ? "vitrine de vendedor" : "loja";
  const [estado, acao, enviando] = useActionState<EstadoExcluirLoja, FormData>(restaurarMinhaLoja, null);
  if (estado?.ok) return <Aviso tipo="ok">Sua {nome} voltou ao ar, com os anúncios que estavam publicados.</Aviso>;
  return (
    <div className="flex flex-col gap-3">
      <Aviso tipo="atencao">
        {podeRestaurar
          ? `Sua ${nome} está fora do ar e será encerrada em ${dataCurta(apagarApos)}.`
          : `Sua ${nome} foi tirada do ar pela equipe. Fale com o suporte.`}
      </Aviso>
      {podeRestaurar && (
        <form action={acao} className="flex flex-col gap-2">
          {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          <Botao type="submit" variante={pf ? "secundario" : "primario"} larguraTotal icone={<RotateCcw />} carregando={enviando} textoCarregando="Restaurando..." className="sm:w-fit">
            Restaurar minha {nome}
          </Botao>
        </form>
      )}
    </div>
  );
}
