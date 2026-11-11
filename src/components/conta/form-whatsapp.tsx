import { CheckCircle2, Smartphone } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { telefone } from "@/lib/formato";
export function FormWhatsapp({ numero, confirmado, ehLoja }: { numero: string | null; confirmado: boolean; exigeCodigo: boolean; ehLoja: boolean }) {
  return <section aria-labelledby="titulo-whatsapp" className="flex flex-col gap-4 rounded-card bg-cartao p-5 shadow-1">
    <div><h2 id="titulo-whatsapp" className="flex items-center gap-2 text-lg font-bold"><Smartphone className="size-5 text-laranja-escuro" aria-hidden />Seu WhatsApp</h2>
      <p className="mt-1 text-sm text-texto-suave">Contato usado nos seus pedidos do Radar e nas vendas como pessoa física.</p></div>
    <div className="rounded-campo bg-fundo p-3"><p className="text-sm text-texto-suave">Número atual</p><p className="text-lg font-bold break-words tabular-nums">{numero ? telefone(numero) : "Não informado"}</p>
      {confirmado ? <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-verde-escuro"><CheckCircle2 className="size-4" aria-hidden />Celular confirmado por código</p> : <p className="mt-1 text-sm text-texto-suave">Confirme seu número antes de negociar.</p>}</div>
    <p className="text-sm text-texto-suave">Ao trocar o contato, seu número atual continua valendo até você confirmar o novo código.</p>
    <Botao href="/confirmar-celular" variante="secundario" larguraTotal>Confirmar ou trocar celular</Botao>
    <Botao href="/minha-conta/dados/foto" variante="texto" larguraTotal>Gerenciar dados de acesso</Botao>
    {ehLoja && <p className="text-sm text-texto-suave">O WhatsApp comercial da loja é separado do celular da sua conta. Altere-o em <a href="/minha-conta/loja" className="font-semibold text-laranja-escuro underline">Minha loja</a>.</p>}
  </section>;
}
