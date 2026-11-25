"use client";

import { Aviso, Cartao } from "@/components/admin/ui";
import { useGestaoForm } from "@/components/admin/form-gestao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { confirmarAntes, useConfirmar } from "@/components/ui/confirmar";
import { registrarRetencao } from "./retencoes-actions";

export type Retencao = {
  tipo: "anuncio" | "pedido"; id: string; titulo: string; estado_comercial: string;
  estado: "retido" | "revisao_manual_pendente"; motivo: string | null; autor: string | null; criado_em: string | null;
  ultima_revisao: { motivo: string; autor: string; criado_em: string } | null;
  retencao_id: string; retencao_motivo: string | null; retencao_em: string | null;
};
const instante = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function RevisaoRetencao({ item, consulta }: { item: Retencao; consulta: string }) {
  const [estado, enviar, pendente] = useGestaoForm(registrarRetencao);
  const confirmar = useConfirmar();
  const liberada = item.estado === "revisao_manual_pendente";
  return <Cartao className="min-w-0 space-y-3">
    <h3 className="break-words text-lg font-semibold">{item.tipo === "anuncio" ? "Anúncio" : "Pedido Radar"}: {item.titulo}</h3>
    <p className="break-all text-sm text-texto-suave">Código do item: {item.id}</p>
    <p className="text-sm">Retenção {item.retencao_id}{item.retencao_em ? `, registrada em ${instante(item.retencao_em)}` : ", sem instante disponível"}.</p>
    <p className="break-words text-base">Motivo da retenção própria: {item.retencao_motivo || "Sem motivo registrado."}</p>
    <p className="text-base">{liberada ? "Liberação registrada. Revisão manual pendente." : "Retido para Compliance."}</p>
    <p className="text-sm text-texto-suave">Estado preservado: {item.estado_comercial}. Dados, fotos e referências continuam guardados.</p>
    {item.motivo && <p className="break-words text-base">Motivo da liberação: {item.motivo}</p>}
    {item.autor && item.criado_em && <p className="break-all text-sm text-texto-suave">Registrado por {item.autor} em {instante(item.criado_em)}.</p>}
    {item.ultima_revisao && <p className="break-words text-sm">Última revisão: {item.ultima_revisao.motivo} ({item.ultima_revisao.autor}, {instante(item.ultima_revisao.criado_em)}).</p>}
    <details>
      <summary className="flex min-h-toque cursor-pointer items-center font-semibold text-laranja-escuro underline underline-offset-4">{liberada ? "Revisar item" : "Registrar liberação"}</summary>
      <p className="my-3 text-base">A revisão continuará pendente até uma decisão sobre o destino. Esta ação não publica, restaura ou apaga o item.</p>
      <form className="space-y-3" onSubmit={confirmarAntes(confirmar, {
        titulo: liberada ? "Registrar revisão?" : "Registrar liberação da retenção?",
        texto: <>
          <span className="block break-words">{item.titulo}</span>
          <span className="block break-all">Código: {item.id}. Retenção: {item.retencao_id}.</span>
          <span className="block break-words">Motivo da retenção própria: {item.retencao_motivo || "Sem motivo registrado."}</span>
          <span className="block">O item mantém o estado atual. Dados, fotos e histórico ficam preservados para revisão manual.</span>
        </>,
        acao: "Registrar",
      }, enviar)}>
        <input type="hidden" name="consulta" value={consulta} />
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="tipo" value={item.tipo} />
        <input type="hidden" name="retencao" value={item.retencao_id} />
        <input type="hidden" name="acao" value={liberada ? "revisar" : "liberar"} />
        <Campo rotulo={liberada ? "Motivo e observações da revisão" : "Motivo da liberação"} name="motivo" minLength={3} maxLength={300} required />
        <Botao type="submit" variante="secundario" carregando={pendente}>{liberada ? "Registrar revisão pendente" : "Liberar para revisão manual"}</Botao>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      </form>
    </details>
  </Cartao>;
}
