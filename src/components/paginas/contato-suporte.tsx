import { Mail, MessageCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { ContatoEquipe } from "@/lib/tipos-paginas";

export function ContatoSuporte({ contato }: { contato: ContatoEquipe }) {
  const temContato = !!(contato.whatsapp || contato.email);
  return (
    <section aria-labelledby="titulo-contato" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
      <h2 id="titulo-contato" className="scroll-mt-20 text-lg font-semibold">Fale com a equipe</h2>
      {(contato.texto || !temContato) && (
        <p className="text-base">{temContato ? contato.texto : "O atendimento da equipe está indisponível nesta página."}</p>
      )}
      {temContato && <div className="flex flex-wrap gap-2">
        {contato.whatsapp && <Botao
          variante="whatsapp" tamanho="toque" icone={<MessageCircle />}
          href={`https://wa.me/${contato.whatsapp}?text=${encodeURIComponent("Olá! Preciso de ajuda com o Mercado da Região.")}`}
          target="_blank" rel="noopener noreferrer"
        >Chamar a equipe no WhatsApp</Botao>}
        {contato.email && <Botao variante="secundario" tamanho="toque" icone={<Mail />} href={`mailto:${contato.email}`}>
          Mandar e-mail
        </Botao>}
      </div>}
      <p className="text-sm text-texto-suave">A equipe do Mercado da Região nunca pede o código que chega no seu celular nem manda link de pagamento por mensagem.</p>
    </section>
  );
}
