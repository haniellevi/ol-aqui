"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { salvarDados, type EstadoDados } from "@/app/(conta)/minha-conta/dados/actions";
import { Seletor } from "./seletor";
import { Aviso } from "./aviso";

// Meus dados: nome, cidade (cidades da região, do banco) e bairro.
export function FormDados({
  nome,
  cidade,
  bairro,
  cidades,
}: {
  nome: string;
  cidade: string | null;
  bairro: string | null;
  cidades: { nome: string; uf: string }[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoDados, FormData>(salvarDados, null);
  const campos = estado?.campos ?? {};
  const cidadeFora = cidade && !cidades.some((c) => c.nome === cidade);

  return (
    <form action={acao} className="flex flex-col gap-4 rounded-card bg-cartao p-4 shadow-1" noValidate>
      <div aria-live="polite">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="ok">Dados salvos.</Aviso>}
      </div>
      <Campo rotulo="Seu nome" name="nome" defaultValue={nome} autoComplete="name" required minLength={2} maxLength={120} erro={campos.nome} />
      {cidades.length > 0 ? (
        <Seletor rotulo="Cidade" name="cidade" defaultValue={cidade ?? ""} erro={campos.cidade}>
          <option value="">Escolha a cidade</option>
          {cidadeFora && <option value={cidade!}>{cidade}</option>}
          {cidades.map((c) => (
            <option key={`${c.nome}-${c.uf}`} value={c.nome}>
              {c.nome} - {c.uf}
            </option>
          ))}
        </Seletor>
      ) : (
        <Campo rotulo="Cidade" name="cidade" defaultValue={cidade ?? ""} autoComplete="address-level2" erro={campos.cidade} />
      )}
      <Campo rotulo="Bairro" name="bairro" opcional defaultValue={bairro ?? ""} maxLength={80} erro={campos.bairro} />
      <Botao type="submit" larguraTotal icone={<Save />} carregando={enviando} textoCarregando="Salvando...">
        Salvar
      </Botao>
    </form>
  );
}
