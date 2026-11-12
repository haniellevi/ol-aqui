import { Store } from "lucide-react";
import { escolherLoja } from "@/app/(conta)/_loja/actions";
import { Botao } from "@/components/ui/botao";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { LojaOpcao } from "@/lib/dados/loja-ativa";

/**
 * Etapa P5b: "Trabalhando na loja X" com troca de loja. Só aparece para quem cuida de mais de uma
 * loja (a própria e as que ajuda). Funciona sem JavaScript (formulário comum).
 */
export function SeletorLoja({ lojas, atual, voltar }: { lojas: LojaOpcao[]; atual: LojaOpcao | null; voltar: "/minha-conta/anuncios" | "/anunciar" }) {
  if (lojas.length < 2 || !atual) return null;
  return (
    <form action={escolherLoja} className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-3 sm:flex-row sm:items-end">
      <input type="hidden" name="voltar" value={voltar} />
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1 text-sm text-texto-suave">
          <Store className="size-4 shrink-0" aria-hidden />
          Trabalhando na loja <strong className="break-words text-texto">{atual.nome}</strong>
          {!atual.dono && <span>(você ajuda)</span>}
        </span>
        <NativeSelect name="loja" defaultValue={atual.id} aria-label="Escolher a loja">
          {lojas.map((l) => (
            <NativeSelectOption key={l.id} value={l.id}>{l.dono ? `${l.nome} (sua loja)` : l.nome}</NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <Botao type="submit" variante="secundario" className="sm:w-fit">Trocar de loja</Botao>
    </form>
  );
}
