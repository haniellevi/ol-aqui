"use client";

import { useActionState, useState } from "react";
import { Check, Search } from "lucide-react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { classesChip } from "@/components/ui/chip";
import { telefone } from "@/lib/formato";
import { NOME_PAPEL, O_QUE_FAZ, PAPEIS, type Papel, type Regiao } from "@/lib/tipos-equipe";
import { buscarConta, desativarMembro, salvarMembro, type EstadoEquipe } from "./actions";

// Formulários da tela 14. Cada botão gira e troca o texto enquanto salva (sem toque duplo).

function Retorno({ estado }: { estado: EstadoEquipe }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

/** Escolher o papel (chips) e, para franqueado, a região. */
export function FormPapel({
  usuarioId,
  papelAtual = null,
  regiaoAtual = null,
  regioes,
  rotulo,
}: {
  usuarioId: string;
  papelAtual?: Papel | null;
  regiaoAtual?: string | null;
  regioes: Regiao[];
  rotulo: string;
}) {
  const [estado, acao, pendente] = useActionState(salvarMembro, null);
  const [papel, setPapel] = useState<Papel | null>(papelAtual);
  const idGrupo = `papel-${usuarioId}`;

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="usuario" value={usuarioId} />
      <fieldset>
        <legend className="mb-2 text-base font-semibold text-texto">Papel</legend>
        <div className="flex flex-wrap gap-2">
          {PAPEIS.map((p) => {
            const ativo = papel === p;
            return (
              <label key={p} className={`${classesChip(ativo)} cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro`}>
                <input
                  type="radio"
                  name="papel"
                  value={p}
                  checked={ativo}
                  onChange={() => setPapel(p)}
                  className="sr-only"
                  aria-describedby={`${idGrupo}-${p}`}
                />
                {ativo && <Check className="size-4 shrink-0" aria-hidden />}
                {NOME_PAPEL[p]}
              </label>
            );
          })}
        </div>
        {papel && (
          <p id={`${idGrupo}-${papel}`} className="mt-2 text-sm text-texto-suave">
            {O_QUE_FAZ[papel]}
          </p>
        )}
      </fieldset>

      {papel === "franqueado" && (
        <label className="text-base font-semibold text-texto">
          Região do franqueado
          <select name="regiao" required defaultValue={regiaoAtual ?? ""} className={estiloCampo}>
            <option value="" disabled>
              Escolha a região
            </option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <Campo
        rotulo="Observação"
        opcional
        name="observacao"
        maxLength={300}
        placeholder="Ex.: cuida da moderação à noite"
        dica="Fica no histórico junto com quem mudou e quando."
      />

      <div>
        <Botao type="submit" variante="secundario" carregando={pendente} textoCarregando="Salvando..." disabled={!papel}>
          {rotulo}
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

/** Tirar da equipe: pede confirmação (a pessoa perde o acesso ao painel na hora). */
export function FormDesativar({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(desativarMembro, null);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="usuario" value={usuarioId} />
      <Campo rotulo="Motivo" opcional name="observacao" maxLength={300} placeholder="Ex.: saiu da empresa" />
      <label className="flex min-h-10 cursor-pointer items-center gap-3 text-base text-texto">
        <input type="checkbox" name="confirmar" value="sim" required className="size-5 accent-laranja-escuro" />
        Sim, tirar {nome} da equipe
      </label>
      <div>
        <Botao type="submit" variante="perigo" carregando={pendente} textoCarregando="Tirando...">
          Tirar da equipe
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

/** Buscar uma conta que já existe (celular ou e-mail) e escolher o papel dela. */
export function BuscaConta({ regioes, euId }: { regioes: Regiao[]; euId: string }) {
  const [estado, acao, pendente] = useActionState(buscarConta, null);
  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-3 md:flex-row md:items-end">
        <Campo
          className="md:flex-1"
          rotulo="Celular ou e-mail da pessoa"
          name="q"
          required
          minLength={3}
          maxLength={120}
          defaultValue={estado?.termo ?? ""}
          placeholder="Ex.: (89) 99999-0000"
          dica="A pessoa precisa ter entrado no OLAKI pelo menos uma vez."
          autoComplete="off"
        />
        <Botao type="submit" carregando={pendente} textoCarregando="Buscando..." icone={<Search />} className="md:mb-7">
          Buscar conta
        </Botao>
      </form>

      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.aviso && <p className="rounded-card bg-aviso-fundo px-4 py-3 text-sm text-aviso">{estado.aviso}</p>}

      {estado?.contas && estado.contas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {estado.contas.map((c) => (
            <li key={c.usuario_id} className="rounded-card border border-borda bg-cartao p-4">
              <p className="text-base font-semibold text-beringela">{c.nome}</p>
              <p className="mb-3 text-sm text-texto-suave">
                {[c.whatsapp ? telefone(c.whatsapp) : null, c.cidade, c.papel ? `${NOME_PAPEL[c.papel]}${c.ativo ? "" : " (saiu)"}` : "Fora da equipe"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {c.usuario_id === euId ? (
                <p className="text-sm font-semibold text-texto-suave">É você. Peça a outro administrador para mudar o seu papel.</p>
              ) : (
                <FormPapel
                  usuarioId={c.usuario_id}
                  papelAtual={c.ativo ? c.papel : null}
                  regioes={regioes}
                  rotulo={c.papel && c.ativo ? "Trocar o papel" : "Pôr na equipe"}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
