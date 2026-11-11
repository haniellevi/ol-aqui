import { MapPin, MessageCircle } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";

// Barra fixa embaixo da vitrine no celular (vitrine com IA, etapa 2): WhatsApp + Mapa.
// Fica acima da barra de navegação, no mesmo lugar da barra do anúncio. No computador some:
// o topo da loja já tem o WhatsApp e o mapa fica ao lado dos produtos.
// Links comuns: funcionam sem JavaScript.

export function BarraLoja({ whatsappHref, mapaHref }: { whatsappHref: string | null; mapaHref: string | null }) {
  if (!whatsappHref && !mapaHref) return null;
  const externo = mapaHref?.startsWith("http");
  return (
    <div className="olaki-material fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 px-4 py-2 md:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        {whatsappHref && (
          <a
            href={whatsappHref}
            data-medir="whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chamar a loja no WhatsApp (abre em nova aba)"
            className={classesBotao("whatsapp", false, "min-w-0 flex-1 px-3")}
          >
            <MessageCircle className="size-5" aria-hidden />
            Chamar no WhatsApp
          </a>
        )}
        {mapaHref && (
          <a
            href={mapaHref}
            data-medir="mapa"
            {...(externo ? { target: "_blank", rel: "noopener noreferrer", "aria-label": "Ver a loja no mapa (abre em nova aba)" } : {})}
            className={classesBotao("secundario", false, whatsappHref ? "shrink-0 px-3" : "min-w-0 flex-1 px-3")}
          >
            <MapPin className="size-5" aria-hidden />
            Mapa
          </a>
        )}
      </div>
    </div>
  );
}
