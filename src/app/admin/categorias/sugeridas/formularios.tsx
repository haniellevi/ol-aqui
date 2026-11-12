"use client";

import { useActionState, useId, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Aviso, Cartao, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { confirmarAntes, useConfirmar } from "@/components/ui/confirmar";
import type { EstadoForm } from "@/lib/admin/estado";
import { inteiro, quando } from "@/lib/admin/formato";
import type { GrupoSugestao } from "@/lib/tipos-cadastros";
import { enviarSemLimpar } from "../../textos/enviar-sem-limpar";
import { decidirSugestoes } from "./actions";

// Um grupo de sugestões: criar (aprovar), juntar com uma categoria no ar ou recusar. Cada botão é um
// formulário próprio; os grupos marcados em "parecidas" vão junto na mesma decisão (campo "grupo").

type Opcao = { id: string; nome: string };
type Parecida = { norm: string; texto: string; quantidade: number };
export type ItemSugestao = { grupo: GrupoSugestao; paiPadrao: string; finalPadrao: string; parecidas: Parecida[] };

const rotulo = "block text-sm font-semibold text-beringela";

function Retorno({ estado }: { estado: EstadoForm }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

/** `podeDecidir`: só o super admin cria, junta ou recusa (Etapa P5a); os outros admins só leem. */
export function CartaoSugestao({ item, maes, finais, podeDecidir = true }: { item: ItemSugestao; maes: Opcao[]; finais: Opcao[]; podeDecidir?: boolean }) {
  const { grupo } = item;
  const uid = useId();
  const confirmar = useConfirmar();
  const [incluidas, setIncluidas] = useState<string[]>([]);
  const [estadoCriar, criar, pendenteCriar] = useActionState(decidirSugestoes, null);
  const [estadoJuntar, juntar, pendenteJuntar] = useActionState(decidirSugestoes, null);
  const [estadoRecusar, recusar, pendenteRecusar] = useActionState(decidirSugestoes, null);

  const todos = [grupo.texto_norm, ...incluidas];
  const total = grupo.quantidade + item.parecidas.filter((p) => incluidas.includes(p.norm)).reduce((s, p) => s + p.quantidade, 0);
  const nomeSugerido = grupo.texto.charAt(0).toUpperCase() + grupo.texto.slice(1);
  const proximas = grupo.proximas.map((p) => `${p.caminho} (${inteiro(p.vezes)} ${p.vezes === 1 ? "vez" : "vezes"})`).join(", ");

  // Campos que vão em todas as decisões deste cartão (os grupos marcados).
  const grupos = todos.map((g) => <input key={g} type="hidden" name="grupo" value={g} />);

  return (
    <Cartao>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-beringela">“{grupo.texto}”</h2>
        <p className="text-legenda text-texto-suave">
          {inteiro(grupo.quantidade)} {grupo.quantidade === 1 ? "pedido" : "pedidos"} · {inteiro(grupo.anuncios)} {grupo.anuncios === 1 ? "anúncio" : "anúncios"} ·
          primeiro pedido {quando(grupo.primeira)}, último {quando(grupo.ultima)}
        </p>
        <p className="text-sm">
          <span className="text-texto-suave">Mais perto de:</span> {proximas || "—"}
        </p>
      </div>

      {item.parecidas.length > 0 && (
        <fieldset className="mt-3 flex flex-col gap-2 rounded-card bg-fundo p-3">
          <legend className="px-1 text-sm font-semibold text-beringela">Parecidas (erro de digitação?). Marque para decidir junto:</legend>
          {item.parecidas.map((p) => (
            <label key={p.norm} className="flex min-h-10 items-center gap-3 text-base text-beringela">
              <input
                type="checkbox"
                checked={incluidas.includes(p.norm)}
                onChange={(e) => setIncluidas(e.target.checked ? [...incluidas, p.norm] : incluidas.filter((x) => x !== p.norm))}
                className="size-5 shrink-0 accent-laranja-escuro"
              />
              <span>
                “{p.texto}” <span className="text-legenda text-texto-suave">({inteiro(p.quantidade)} {p.quantidade === 1 ? "pedido" : "pedidos"})</span>
              </span>
            </label>
          ))}
          {incluidas.length > 0 && <p className="text-sm text-texto-suave">Vão juntos: {inteiro(total)} pedidos.</p>}
        </fieldset>
      )}

      {podeDecidir && <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <form onSubmit={enviarSemLimpar(criar)} className="flex flex-col gap-2">
          <input type="hidden" name="acao" value="aprovar" />
          {grupos}
          <p className="text-base font-semibold text-beringela">Criar categoria</p>
          <div>
            <label htmlFor={`${uid}-nome`} className={rotulo}>Nome</label>
            <input id={`${uid}-nome`} name="nome" required minLength={2} maxLength={60} defaultValue={nomeSugerido} className={estiloCampo} />
          </div>
          <div>
            <label htmlFor={`${uid}-pai`} className={rotulo}>Fica dentro de</label>
            <select id={`${uid}-pai`} name="pai_id" defaultValue={item.paiPadrao} className={estiloCampo}>
              {maes.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          <Botao type="submit" carregando={pendenteCriar} textoCarregando="Criando..." icone={<Plus />} className="w-full">
            Aprovar e criar
          </Botao>
          <Retorno estado={estadoCriar} />
        </form>

        <form onSubmit={enviarSemLimpar(juntar)} className="flex flex-col gap-2">
          <input type="hidden" name="acao" value="juntar" />
          {grupos}
          <p className="text-base font-semibold text-beringela">Juntar com uma que já existe</p>
          <div>
            <label htmlFor={`${uid}-final`} className={rotulo}>Categoria</label>
            <select id={`${uid}-final`} name="categoria_id" defaultValue={item.finalPadrao} disabled={!finais.length} className={estiloCampo}>
              {finais.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
            <p className="mt-1 text-legenda text-texto-suave">Só categorias finais que estão no ar.</p>
          </div>
          <Botao type="submit" variante="secundario" carregando={pendenteJuntar} textoCarregando="Juntando..." icone={<Check />} disabled={!finais.length} className="w-full">
            Juntar e mover anúncios
          </Botao>
          <Retorno estado={estadoJuntar} />
        </form>

        <form
          onSubmit={confirmarAntes(
            confirmar,
            {
              titulo: `Recusar ${inteiro(total)} ${total === 1 ? "pedido" : "pedidos"} de “${grupo.texto}”?`,
              texto: "Os anúncios continuam na categoria atual.",
              acao: "Recusar",
              perigo: true,
            },
            enviarSemLimpar(recusar),
          )}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="acao" value="recusar" />
          {grupos}
          <p className="text-base font-semibold text-beringela">Recusar</p>
          <p className="text-sm text-texto-suave">Não cria categoria e não move anúncios.</p>
          <Botao type="submit" variante="perigo" carregando={pendenteRecusar} textoCarregando="Recusando..." icone={<Trash2 />} className="w-full">
            Recusar
          </Botao>
          <Retorno estado={estadoRecusar} />
        </form>
      </div>}
    </Cartao>
  );
}
