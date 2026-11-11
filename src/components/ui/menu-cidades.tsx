"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { escolherCidade } from "@/app/(publico)/cidades/actions";
import type { Cidade } from "@/lib/tipos";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./dropdown-menu";

const estilo = "ml-1 inline-flex h-10 min-w-0 items-center gap-1 rounded-full border border-borda bg-cartao px-3 text-rotulo font-semibold text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro";

export function MenuCidades({ cidade, regiao, cidades }: { cidade: string | null; regiao?: string; cidades: Cidade[] }) {
  const rotulo = cidade ?? "Escolher cidade";
  const itens = (
    <>
      <MapPin className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{rotulo}</span>
      <ChevronDown className="size-4 shrink-0" aria-hidden />
    </>
  );
  if (!cidades.length) return <Link href="/cidades" className={estilo} aria-label="Escolher cidade">{itens}</Link>;

  return <form action={escolherCidade} className="min-w-0">
    <OpcoesCidade cidade={cidade} regiao={regiao} cidades={cidades} rotulo={rotulo}>{itens}</OpcoesCidade>
  </form>;
}

function OpcoesCidade({ cidade, regiao, cidades, rotulo, children }: {
  cidade: string | null; regiao?: string; cidades: Cidade[]; rotulo: string; children: React.ReactNode;
}) {
  const id = useRef<HTMLInputElement>(null);
  const { pending } = useFormStatus();
  return (
    <>
      <input ref={id} type="hidden" name="cidade" />
      <DropdownMenu>
        <DropdownMenuTrigger className={`${estilo} max-w-[calc(100%-0.25rem)]`} disabled={pending} aria-busy={pending || undefined}
          aria-label={cidade ? `Cidade: ${cidade}. Trocar cidade` : rotulo}>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60 max-w-[calc(100vw-1rem)]" aria-label="Cidades disponíveis">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3">Trocar cidade</DropdownMenuLabel>
            {cidades.map((opcao) => {
              const atual = opcao.microrregiao_id === regiao && opcao.nome === cidade;
              return (
                <DropdownMenuItem key={opcao.id} label={opcao.nome} aria-current={atual ? "true" : undefined}
                  onClick={() => {
                    if (!id.current) return;
                    id.current.value = opcao.id;
                    id.current.form?.requestSubmit();
                  }}>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{opcao.nome} · {opcao.uf}</span>
                  {atual && <Check className="size-4" aria-hidden />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
