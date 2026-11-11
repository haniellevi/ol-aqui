"use client";

import { Check, Sparkles, X } from "lucide-react";
import { decidirMelhoria, pedirMelhoria } from "@/app/(conta)/minha-conta/loja/melhorar/actions";
import type { DicaFoto, Melhoria } from "@/lib/dados/melhoria-ia";
import { Botao } from "@/components/ui/botao";
import { Mensagens, useAcao } from "@/components/conta/revisar-categorias";

// Vitrine com IA, etapa 5b: o lojista pede a sugestão, vê o antes e o depois e decide.

const PROBLEMA: Record<DicaFoto["problema"], string> = {
  escura: "Foto escura", tremida: "Foto tremida", fundo: "Fundo atrapalha", pequeno: "Produto pequeno na foto", cortado: "Produto cortado",
};

export function PedirMelhoria({ anuncioId, restam, limite }: { anuncioId: string; restam: number; limite: number }) {
  const { pendente, erro, aviso, executar } = useAcao();
  return (
    <div className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
      <p className="text-base">A IA lê o título, a descrição e as fotos, sugere um texto mais claro e diz o que melhorar nas fotos. Nada muda sem o seu toque.</p>
      <Botao icone={<Sparkles />} carregando={pendente} textoCarregando="A IA está lendo seu produto..." disabled={restam <= 0}
        onClick={() => executar(async () => {
          const r = await pedirMelhoria(anuncioId);
          return r.ok ? { ok: true } : r;
        }, "Sugestão pronta. Confira abaixo.")}>
        Pedir sugestão da IA
      </Botao>
      <p className="text-sm text-texto-suave">
        {restam <= 0 ? `Você já usou as ${limite} sugestões deste mês.` : `Restam ${restam} de ${limite} sugestões neste mês.`}
        {pendente && " Pode levar até 30 segundos."}
      </p>
      <Mensagens erro={erro} aviso={aviso} />
    </div>
  );
}

function AntesDepois({ rotulo, antes, depois }: { rotulo: string; antes: string | null; depois: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-bold">{rotulo}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-campo bg-fundo p-3">
          <span className="text-sm font-semibold text-texto-suave">Antes</span>
          <p className="whitespace-pre-line break-words text-base">{antes?.trim() ? antes : "(vazio)"}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-campo bg-selecao p-3">
          <span className="text-sm font-semibold text-laranja-escuro">Sugestão da IA</span>
          <p className="whitespace-pre-line break-words text-base">{depois}</p>
        </div>
      </div>
    </div>
  );
}

export function SugestaoMelhoria({ m, anuncioId, fotos }: { m: Melhoria; anuncioId: string; fotos: string[] }) {
  const { pendente, erro, aviso, executar } = useAcao();
  const temTexto = !!(m.titulo_novo || m.descricao_nova);
  const decidir = (aceitar: boolean, sucesso: string) => executar(async () => {
    const r = await decidirMelhoria(m.id, anuncioId, aceitar);
    return r.ok ? { ok: true } : r;
  }, sucesso);
  return (
    <div className="flex flex-col gap-4" aria-busy={pendente || undefined}>
      {temTexto && (
        <section aria-labelledby="titulo-texto" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          <h2 id="titulo-texto" className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-laranja-escuro" aria-hidden />
            Texto sugerido
          </h2>
          {m.titulo_novo && <AntesDepois rotulo="Título" antes={m.titulo_antes} depois={m.titulo_novo} />}
          {m.descricao_nova && <AntesDepois rotulo="Descrição" antes={m.descricao_antes} depois={m.descricao_nova} />}
          <p className="text-sm text-texto-suave">Confira se está tudo certo. Se a IA errou algum detalhe, mantenha o seu texto e corrija na edição do anúncio.</p>
          <div className="flex flex-wrap gap-2">
            <Botao icone={<Check />} carregando={pendente} textoCarregando="Salvando..." onClick={() => decidir(true, "Texto novo salvo no anúncio.")}>
              Usar o texto novo
            </Botao>
            <Botao variante="secundario" icone={<X />} disabled={pendente} onClick={() => decidir(false, "Mantivemos o seu texto.")}>
              Manter o meu
            </Botao>
          </div>
        </section>
      )}
      {m.dicas_foto.length > 0 && (
        <section aria-labelledby="titulo-fotos" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          <h2 id="titulo-fotos" className="text-lg font-bold">Dicas para as fotos</h2>
          <ul className="flex flex-col gap-3">
            {m.dicas_foto.map((d) => (
              <li key={d.indice} className="flex gap-3">
                {fotos[d.indice - 1] && (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura do próprio anúncio
                  <img src={fotos[d.indice - 1]} alt={`Foto ${d.indice}`} width={64} height={64} className="size-16 shrink-0 rounded-campo object-cover" />
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">Foto {d.indice}: {PROBLEMA[d.problema]}</span>
                  <span className="text-base">{d.dica}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-texto-suave">A IA não mexe nas suas fotos. Tire outra e troque na edição do anúncio.</p>
        </section>
      )}
      {!temTexto && (
        <div className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          {m.dicas_foto.length === 0 && <p className="text-base">Seu produto já está bom. A IA não achou nada para mudar no texto nem nas fotos.</p>}
          <Botao variante="secundario" icone={<Check />} disabled={pendente} onClick={() => decidir(false, "Pronto.")}>
            Entendi
          </Botao>
        </div>
      )}
      <Mensagens erro={erro} aviso={aviso} />
    </div>
  );
}
