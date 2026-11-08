"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer, Search } from "lucide-react";
import { Aviso } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { LINK_ADMIN_COMPLIANCE } from "@/lib/rotas";
import { abrirConsulta, pedirRelatorio } from "./actions";

// Formulários da tela 8. Cada botão gira e troca o texto enquanto trabalha (sem toque duplo).

/** Antes de ver qualquer dado: o motivo (ex.: número do ofício). */
export function FormAbrirConsulta() {
  const [estado, acao, pendente] = useActionState(abrirConsulta, null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        rotulo="Motivo da consulta"
        name="motivo"
        required
        minLength={3}
        maxLength={500}
        placeholder="Ex.: Ofício nº 123/2026 da Delegacia de Corrente"
        dica="Fica gravado com a data, a hora e o seu IP. Sem motivo, nenhum dado aparece."
        autoComplete="off"
      />
      <div>
        <Botao type="submit" carregando={pendente} textoCarregando="Abrindo...">
          Começar consulta
        </Botao>
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

/** Busca por pessoa, celular ou anúncio. Vai pelo endereço (?c=&q=), sem o motivo. */
export function FormBusca({ consulta, termo }: { consulta: string; termo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 md:flex-row md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        iniciar(() => router.push(`${LINK_ADMIN_COMPLIANCE}?c=${consulta}&q=${encodeURIComponent(q)}`));
      }}
    >
      <Campo
        className="md:flex-1"
        rotulo="Buscar pessoa, celular ou anúncio"
        name="q"
        required
        minLength={3}
        maxLength={120}
        defaultValue={termo}
        placeholder="Celular, e-mail, nome, CNPJ, título ou código do anúncio"
        autoComplete="off"
      />
      <Botao type="submit" variante="secundario" carregando={pendente} textoCarregando="Buscando..." icone={<Search />} className="md:mb-0.5">
        Buscar
      </Botao>
    </form>
  );
}

/** Gerar o relatório para imprimir. O motivo vai no cabeçalho (pode ser outro número de ofício). */
export function FormRelatorio({ consulta, usuario, motivoConsulta }: { consulta: string; usuario: string; motivoConsulta: string }) {
  const [estado, acao, pendente] = useActionState(pedirRelatorio, null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="consulta" value={consulta} />
      <input type="hidden" name="usuario" value={usuario} />
      <Campo
        rotulo="Motivo que vai no relatório"
        name="motivo"
        required
        minLength={3}
        maxLength={500}
        defaultValue={motivoConsulta}
        dica="Ex.: número do ofício ou do processo. Aparece no topo do relatório e fica gravado."
        autoComplete="off"
      />
      <div>
        <Botao type="submit" carregando={pendente} textoCarregando="Gerando..." icone={<FileText />}>
          Gerar relatório
        </Botao>
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

/** Abre a janela de impressão do navegador (dá para escolher "Salvar como PDF"). */
export function BotaoImprimir() {
  return (
    <Botao type="button" onClick={() => window.print()} icone={<Printer />}>
      Imprimir ou salvar em PDF
    </Botao>
  );
}
