"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { IconeCategoria, NOMES_ICONES } from "@/components/ui/icone-categoria";
import type { EstadoForm } from "@/lib/admin/estado";
import { paraReaisInput } from "@/lib/admin/formato";
import { paraEditor } from "@/lib/admin/regras-cadastros";
import type { CategoriaAdmin } from "@/lib/tipos-cadastros";
import { enviarSemLimpar } from "../textos/enviar-sem-limpar";
import { apagarCategoria, criarCategoria, moverCategoria, salvarCategoria } from "./actions";
import { EditorCampos } from "./editor-campos";

// Formulários da tela 9 (Categorias e campos). Cada botão mostra a bolinha girando, troca o texto e
// não deixa enviar duas vezes. Se der erro, o que foi digitado continua no lugar.

const rotulo = "block text-sm font-semibold text-beringela";

function Retorno({ estado }: { estado: EstadoForm }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

/** Grade de ícones (os mesmos de src/components/ui/icone-categoria.tsx). Escolhido = laranja-claro + borda + ✓. */
function EscolhaIcone({ id, inicial }: { id: string; inicial: string | null }) {
  const [atual, setAtual] = useState(inicial && NOMES_ICONES.includes(inicial) ? inicial : "");
  return (
    <fieldset>
      <legend className={rotulo}>Ícone</legend>
      <input type="hidden" name="icone" value={atual} />
      <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2" role="radiogroup" aria-label="Ícone da categoria">
        {NOMES_ICONES.map((nome) => {
          const escolhido = nome === atual;
          return (
            <button
              key={nome}
              type="button"
              role="radio"
              aria-checked={escolhido}
              aria-label={`Ícone ${nome}`}
              id={escolhido ? `${id}-escolhido` : undefined}
              onClick={() => setAtual(nome)}
              className={`relative grid size-10 place-items-center rounded-campo border text-beringela focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro ${
                escolhido ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao hover:bg-fundo"
              }`}
            >
              <IconeCategoria nome={nome} className="size-6" />
              {escolhido && (
                <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-laranja-escuro text-white" aria-hidden>
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormNovaCategoria({ principais }: { principais: Pick<CategoriaAdmin, "id" | "nome" | "ativa">[] }) {
  const [estado, acao, pendente] = useActionState(criarCategoria, null);
  return (
    <form onSubmit={enviarSemLimpar(acao)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="nova-cat-nome" className={rotulo}>
            Nome
          </label>
          <input id="nova-cat-nome" name="nome" required minLength={2} maxLength={60} placeholder="Ex.: Bicicletas" className={estiloCampo} />
        </div>
        <div>
          <label htmlFor="nova-cat-pai" className={rotulo}>
            Fica dentro de
          </label>
          <select id="nova-cat-pai" name="pai_id" defaultValue={principais[0]?.id ?? ""} className={estiloCampo}>
            {principais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.ativa ? "" : " (escondida)"}
              </option>
            ))}
            <option value="">Nenhuma: é uma categoria principal</option>
          </select>
          <p className="mt-1 text-legenda text-texto-suave">O anúncio entra numa subcategoria. A principal só agrupa.</p>
        </div>
      </div>
      <EscolhaIcone id="nova-cat-icone" inicial={null} />
      <Botao type="submit" carregando={pendente} textoCarregando="Criando..." icone={<Plus />} className="w-full md:w-auto">
        Criar categoria
      </Botao>
      <Retorno estado={estado} />
    </form>
  );
}

export function BotoesOrdem({ id, nome, primeiro, ultimo }: { id: string; nome: string; primeiro: boolean; ultimo: boolean }) {
  const [estado, acao, pendente] = useActionState(moverCategoria, null);
  const [direcao, setDirecao] = useState<"subir" | "descer" | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        onSubmit={enviarSemLimpar(acao, (e) => {
          const botao = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          setDirecao((botao?.value as "subir" | "descer") ?? null);
          return true;
        })}
        className="flex gap-1"
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          name="direcao"
          value="subir"
          disabled={primeiro || pendente}
          aria-label={`Subir ${nome}`}
          className="inline-flex size-10 items-center justify-center rounded-card border border-borda bg-cartao text-beringela hover:bg-fundo disabled:opacity-40"
        >
          <ArrowUp className={`size-5 ${pendente && direcao === "subir" ? "animate-pulse" : ""}`} aria-hidden />
        </button>
        <button
          type="submit"
          name="direcao"
          value="descer"
          disabled={ultimo || pendente}
          aria-label={`Descer ${nome}`}
          className="inline-flex size-10 items-center justify-center rounded-card border border-borda bg-cartao text-beringela hover:bg-fundo disabled:opacity-40"
        >
          <ArrowDown className={`size-5 ${pendente && direcao === "descer" ? "animate-pulse" : ""}`} aria-hidden />
        </button>
      </form>
      {pendente && <span className="text-legenda text-texto-suave" role="status">Mudando a ordem...</span>}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </div>
  );
}

export function FormCategoria({
  categoria,
  principais,
}: {
  categoria: CategoriaAdmin;
  principais: Pick<CategoriaAdmin, "id" | "nome" | "ativa">[];
}) {
  const [estado, acao, pendente] = useActionState(salvarCategoria, null);
  const sub = !!categoria.pai_id;
  return (
    <form onSubmit={enviarSemLimpar(acao)} className="space-y-5">
      <input type="hidden" name="id" value={categoria.id} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="cat-nome" className={rotulo}>
            Nome
          </label>
          <input id="cat-nome" name="nome" required minLength={2} maxLength={60} defaultValue={categoria.nome} className={estiloCampo} />
          <p className="mt-1 text-legenda text-texto-suave">O endereço não muda: /c/…/{categoria.slug}</p>
        </div>
        {sub && (
          <div>
            <label htmlFor="cat-pai" className={rotulo}>
              Fica dentro de
            </label>
            <select id="cat-pai" name="pai_id" defaultValue={categoria.pai_id ?? ""} className={estiloCampo}>
              {principais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.ativa ? "" : " (escondida)"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-legenda text-texto-suave">Mudar aqui leva a subcategoria (e os anúncios dela) para outra categoria.</p>
          </div>
        )}
      </div>

      <EscolhaIcone id="cat-icone" inicial={categoria.icone} />

      <label className="flex min-h-10 items-start gap-3 text-base text-beringela">
        <input type="checkbox" name="ativa" defaultChecked={categoria.ativa} className="mt-1 size-5 shrink-0 accent-laranja-escuro" />
        <span>
          Aparece no cadastro de anúncio e na lista de categorias
          <span className="block text-legenda text-texto-suave">
            Desmarcado = escondida. Os anúncios que já estão nela continuam no ar e aparecem na busca.
            {!sub && " Esconder a principal esconde todas as subcategorias dela."}
          </span>
        </span>
      </label>

      {sub ? (
        <>
          <fieldset className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <legend className="mb-1 text-base font-semibold text-beringela">Preço que a moderação aceita</legend>
            <div>
              <label htmlFor="cat-preco-min" className={rotulo}>
                Mínimo (R$)
              </label>
              <input id="cat-preco-min" name="preco_min" inputMode="decimal" placeholder="sem mínimo" defaultValue={paraReaisInput(categoria.preco_min_centavos)} className={estiloCampo} />
            </div>
            <div>
              <label htmlFor="cat-preco-max" className={rotulo}>
                Máximo (R$)
              </label>
              <input id="cat-preco-max" name="preco_max" inputMode="decimal" placeholder="sem máximo" defaultValue={paraReaisInput(categoria.preco_max_centavos)} className={estiloCampo} />
            </div>
            <p className="text-legenda text-texto-suave md:col-span-2">
              Anúncio com preço fora dessa faixa vai para &quot;Em análise&quot; antes de aparecer. Vazio = usa a regra geral de Configurações.
            </p>
          </fieldset>

          <EditorCampos inicial={categoria.campos.map(paraEditor)} temAnuncios={categoria.anuncios_total > 0} />
        </>
      ) : (
        <p className="rounded-card bg-fundo px-4 py-3 text-sm text-texto-suave">
          Esta é uma categoria principal: ela só agrupa. Os campos do anúncio e o preço da moderação ficam em cada subcategoria.
        </p>
      )}

      <Botao type="submit" carregando={pendente} textoCarregando="Salvando..." className="w-full md:w-auto">
        Salvar categoria
      </Botao>
      <Retorno estado={estado} />
    </form>
  );
}

export function BotaoApagarCategoria({ categoria }: { categoria: CategoriaAdmin }) {
  const [estado, acao, pendente] = useActionState(apagarCategoria, null);
  return (
    <form onSubmit={enviarSemLimpar(acao, () => window.confirm(`Apagar "${categoria.nome}" de vez? Não dá para desfazer.`))} className="space-y-2">
      <input type="hidden" name="id" value={categoria.id} />
      <Botao type="submit" variante="perigo" carregando={pendente} textoCarregando="Apagando..." icone={<Trash2 />}>
        Apagar categoria
      </Botao>
      <Retorno estado={estado} />
    </form>
  );
}
