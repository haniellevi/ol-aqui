"use client";

import { useActionState, useEffect, useRef } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import type { EstadoForm } from "@/lib/admin/estado";
import { UFS } from "@/lib/admin/regras-cadastros";
import type { CidadeAdmin, RegiaoAdmin } from "@/lib/tipos-cadastros";
import { enviarSemLimpar } from "../textos/enviar-sem-limpar";
import { adicionarCidade, apagarRegiao, criarRegiao, removerCidade, salvarRegiao, trocarCidadeAtiva } from "./actions";
import { confirmarAntes, useConfirmar } from "@/components/ui/confirmar";

// Formulários da tela 7 (Regiões e cidades). Cada botão mostra a bolinha girando, troca o texto e
// não deixa enviar duas vezes. Se der erro, o que foi digitado continua no lugar.

const rotulo = "block text-sm font-semibold text-beringela";

function Retorno({ estado }: { estado: EstadoForm }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

function SeletorUf({ id, padrao = "PI" }: { id: string; padrao?: string }) {
  return (
    <select id={id} name="uf" required defaultValue={padrao} className={estiloCampo}>
      {UFS.map((uf) => (
        <option key={uf} value={uf}>
          {uf}
        </option>
      ))}
    </select>
  );
}

export function FormNovaRegiao() {
  const [estado, acao, pendente] = useActionState(criarRegiao, null);
  return (
    <form onSubmit={enviarSemLimpar(acao)} className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_6rem]">
      <div className="md:col-span-3">
        <label htmlFor="nova-regiao-nome" className={rotulo}>
          Nome da região
        </label>
        <input id="nova-regiao-nome" name="nome" required minLength={2} maxLength={80} placeholder="Ex.: Oeste da Bahia" className={estiloCampo} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="nova-regiao-sede" className={rotulo}>
          Cidade-sede
        </label>
        <input id="nova-regiao-sede" name="sede" required minLength={2} maxLength={80} placeholder="Ex.: Barreiras" className={estiloCampo} />
      </div>
      <div>
        <label htmlFor="nova-regiao-uf" className={rotulo}>
          Estado
        </label>
        <SeletorUf id="nova-regiao-uf" padrao="BA" />
      </div>
      <div className="md:col-span-3">
        <Botao type="submit" carregando={pendente} textoCarregando="Criando..." icone={<Plus />} className="w-full md:w-auto">
          Criar região
        </Botao>
      </div>
      <div className="md:col-span-3">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormRegiao({ regiao, cidades }: { regiao: RegiaoAdmin; cidades: CidadeAdmin[] }) {
  const [estado, acao, pendente] = useActionState(salvarRegiao, null);
  const ativas = cidades.filter((c) => c.ativa);
  return (
    <form onSubmit={enviarSemLimpar(acao)} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <input type="hidden" name="id" value={regiao.id} />
      <div>
        <label htmlFor="regiao-nome" className={rotulo}>
          Nome da região
        </label>
        <input id="regiao-nome" name="nome" required minLength={2} maxLength={80} defaultValue={regiao.nome} className={estiloCampo} />
      </div>
      <div>
        <label htmlFor="regiao-sede" className={rotulo}>
          Cidade-sede
        </label>
        <select id="regiao-sede" name="cidade_sede" required defaultValue={regiao.cidade_sede ?? ""} className={estiloCampo}>
          {!regiao.cidade_sede && <option value="">Escolha a sede</option>}
          {ativas.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}-{c.uf}
            </option>
          ))}
        </select>
        <p className="mt-1 text-legenda text-texto-suave">Só cidades ativas desta região.</p>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="regiao-repasse" className={rotulo}>
          Repasse do franqueado (%)
        </label>
        <input id="regiao-repasse" disabled readOnly value="" placeholder="a definir" className={`${estiloCampo} bg-fundo`} aria-describedby="regiao-repasse-dica" />
        <p id="regiao-repasse-dica" className="mt-1 text-legenda text-texto-suave">
          A definir: fica vazio até o modelo de franquia ser decidido. Nada é repassado enquanto isso.
        </p>
      </div>
      <div className="md:col-span-2">
        <Botao type="submit" carregando={pendente} textoCarregando="Salvando..." className="w-full md:w-auto">
          Salvar região
        </Botao>
      </div>
      <div className="md:col-span-2">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormAdicionarCidade({ regiaoId, ufPadrao }: { regiaoId: string; ufPadrao: string }) {
  const [estado, acao, pendente] = useActionState(adicionarCidade, null);
  const ref = useRef<HTMLFormElement>(null);
  // deu certo: limpa o nome para adicionar a próxima
  useEffect(() => {
    if (estado?.ok) {
      const campo = ref.current?.elements.namedItem("nome");
      if (campo instanceof HTMLInputElement) campo.value = "";
    }
  }, [estado]);
  return (
    <form ref={ref} onSubmit={enviarSemLimpar(acao)} className="grid grid-cols-[1fr_6rem] gap-3">
      <input type="hidden" name="regiao_id" value={regiaoId} />
      <div>
        <label htmlFor="cidade-nova-nome" className={rotulo}>
          Nome da cidade
        </label>
        <input id="cidade-nova-nome" name="nome" required minLength={2} maxLength={80} placeholder="Ex.: Formosa do Rio Preto" className={estiloCampo} />
      </div>
      <div>
        <label htmlFor="cidade-nova-uf" className={rotulo}>
          Estado
        </label>
        <SeletorUf id="cidade-nova-uf" padrao={ufPadrao} />
      </div>
      <div className="col-span-2">
        <Botao type="submit" variante="secundario" carregando={pendente} textoCarregando="Adicionando..." icone={<Plus />} className="w-full md:w-auto">
          Adicionar cidade
        </Botao>
      </div>
      <div className="col-span-2">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function AcoesCidade({ cidade, regiaoId, uso }: { cidade: CidadeAdmin; regiaoId: string; uso: string }) {
  const [estadoAtiva, acaoAtiva, trocando] = useActionState(trocarCidadeAtiva, null);
  const [estadoRemover, acaoRemover, removendo] = useActionState(removerCidade, null);
  const confirmar = useConfirmar();
  const ocupado = trocando || removendo;
  const podeRemover = !uso && !cidade.e_sede;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!cidade.e_sede && (
          <form onSubmit={enviarSemLimpar(acaoAtiva)}>
            <input type="hidden" name="id" value={cidade.id} />
            <input type="hidden" name="regiao_id" value={regiaoId} />
            <input type="hidden" name="ativa" value={cidade.ativa ? "0" : "1"} />
            <Botao
              type="submit"
              variante="secundario"
              disabled={ocupado}
              carregando={trocando}
              textoCarregando={cidade.ativa ? "Desativando..." : "Ativando..."}
              icone={cidade.ativa ? <EyeOff /> : <Eye />}
            >
              {cidade.ativa ? "Desativar" : "Ativar"}
            </Botao>
          </form>
        )}
        {podeRemover && (
          <form
            onSubmit={confirmarAntes(confirmar, { titulo: `Remover ${cidade.nome}-${cidade.uf} de vez?`, acao: "Remover", perigo: true }, enviarSemLimpar(acaoRemover))}
          >
            <input type="hidden" name="id" value={cidade.id} />
            <input type="hidden" name="regiao_id" value={regiaoId} />
            <Botao type="submit" variante="perigo" disabled={ocupado} carregando={removendo} textoCarregando="Removendo..." icone={<Trash2 />}>
              Remover
            </Botao>
          </form>
        )}
      </div>
      {cidade.e_sede && <p className="text-legenda text-texto-suave">É a sede: para desativar, escolha outra sede antes.</p>}
      {!cidade.e_sede && uso && (
        <p className="text-legenda text-texto-suave">Não dá para remover (tem {uso}). Desative para sair das listas e guardar o histórico.</p>
      )}
      <Retorno estado={estadoAtiva} />
      <Retorno estado={estadoRemover} />
    </div>
  );
}

export function BotaoApagarRegiao({ regiao }: { regiao: RegiaoAdmin }) {
  const [estado, acao, pendente] = useActionState(apagarRegiao, null);
  const confirmar = useConfirmar();
  return (
    <form onSubmit={confirmarAntes(confirmar, { titulo: `Apagar a região "${regiao.nome}"?`, texto: "As cidades dela também são apagadas. Não dá para desfazer.", acao: "Apagar região", perigo: true }, enviarSemLimpar(acao))} className="space-y-2">
      <input type="hidden" name="id" value={regiao.id} />
      <Botao type="submit" variante="perigo" carregando={pendente} textoCarregando="Apagando..." icone={<Trash2 />}>
        Apagar região
      </Botao>
      <Retorno estado={estado} />
    </form>
  );
}
