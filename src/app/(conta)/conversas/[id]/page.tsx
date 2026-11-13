import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { JanelaConfirmar } from "@/components/ui/confirmar";
import { ConversaAberta } from "@/components/conversas/conversa-aberta";
import { MenuSeguranca } from "@/components/conversas/menu-seguranca";
import { ALERTA_GOLPE, AVISO_ACOMPANHA } from "@/components/conversas/cartao-mensagem";
import { conversasLigadas, detalheConversa, mensagensDaConversa } from "@/lib/dados/conversas";
import { LINK_CONVERSAS } from "@/lib/rotas";

export const metadata: Metadata = { title: "Conversa" };
export const dynamic = "force-dynamic";

/** wa.me do cliente, montado só no servidor e só depois que ele mostrou o número. */
function linkWhatsappCliente(numero: string | null, nome: string): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (!/^55[1-9][0-9][0-9]{8,9}$/.test(digitos)) return null;
  const texto = `Olá, ${nome}! Vi sua mensagem no Mercado da Região.`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

export default async function PaginaConversa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await conversasLigadas())) notFound();
  const [d, mensagens] = await Promise.all([detalheConversa(id), mensagensDaConversa(id)]);
  if (!d) notFound();
  const bloqueada = d.eu_bloqueei || d.fui_bloqueado;
  return <PaginaConta>
    <TopoConta titulo={d.outro_nome} voltar={LINK_CONVERSAS} textoVoltar="Conversas"
      texto={d.papel === "cliente" ? "Conversa com a loja." : "Conversa com um cliente da sua loja."}>
      <div className="mt-2"><MenuSeguranca conversaId={d.id} eu_bloqueei={d.eu_bloqueei} nomeOutro={d.outro_nome} /></div>
    </TopoConta>
    <div className="sticky top-14 z-10 flex gap-3 rounded-card border border-borda bg-cartao p-3 text-base shadow-1 md:top-16">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
      <div className="flex flex-col gap-1">
        <p>{AVISO_ACOMPANHA}</p>
        <p className="font-semibold text-aviso">{ALERTA_GOLPE}</p>
      </div>
    </div>
    {d.fui_bloqueado && !d.eu_bloqueei && <p className="text-base text-texto-suave">{d.papel === "cliente" ? "A loja bloqueou esta conversa." : "O cliente bloqueou esta conversa."}</p>}
    <ConversaAberta conversaId={d.id} papel={d.papel} mensagensIniciais={mensagens} bloqueada={bloqueada}
      whatsappLiberado={d.whatsapp_liberado} nomeOutro={d.outro_nome}
      whatsappHref={d.papel === "loja" ? linkWhatsappCliente(d.whatsapp_cliente, d.outro_nome) : null} />
    <JanelaConfirmar />
  </PaginaConta>;
}
