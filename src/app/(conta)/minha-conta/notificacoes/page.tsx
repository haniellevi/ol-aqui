import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Notificações" };

// T36 · Notificações. O banco ainda não guarda preferências de aviso: por enquanto, "Em breve".
export default function PaginaNotificacoes() {
  return (
    <PaginaConta>
      <TopoConta titulo="Notificações" />
      <Vazio
        titulo="Em breve"
        icone={<Bell />}
        texto="Logo você vai poder escolher quais avisos quer receber: anúncio no ar, propostas do Radar, teste grátis acabando e outros."
      >
        <Botao href="/minha-conta" variante="secundario" larguraTotal>
          Voltar para Minha conta
        </Botao>
      </Vazio>
    </PaginaConta>
  );
}
