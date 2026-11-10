import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { SeloLoja, SeloNegociador } from "@/components/vitrine/selos";
import { desde, linkVendedor, primeiroNome } from "@/components/vitrine/util";
import { linkLoja } from "@/lib/formato";
import type { AnuncioPublico } from "@/lib/tipos";

type Dados = Pick<
  AnuncioPublico,
  "vitrine_id" | "vitrine_slug" | "vitrine_nome" | "vitrine_tipo" | "vitrine_logo_url" | "vitrine_selo" | "vitrine_desde" | "vendedor_certificado"
>;

// Cartão do vendedor na página do anúncio: loja leva à vitrine; pessoa física ao perfil (só o primeiro nome).
export function CartaoVendedor({ v }: { v: Dados }) {
  const loja = v.vitrine_tipo === "loja";
  const nome = loja ? v.vitrine_nome : primeiroNome(v.vitrine_nome);
  const href = loja ? linkLoja(v.vitrine_slug) : linkVendedor(v.vitrine_id);
  const desdeTexto = desde(v.vitrine_desde);

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card bg-cartao p-3 shadow-1 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
    >
      <AvatarVitrine nome={nome} logo={loja ? v.vitrine_logo_url : null} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-legenda text-texto-suave">{loja ? "Loja" : "Vendedor"}</span>
        <strong className="truncate text-sm font-semibold">{nome}</strong>
        {(v.vitrine_selo || v.vendedor_certificado) && (
          <span className="flex flex-wrap gap-1">
            {loja && v.vitrine_selo && <SeloLoja />}
            {v.vendedor_certificado && <SeloNegociador />}
          </span>
        )}
        {desdeTexto && <span className="text-legenda text-texto-suave">{desdeTexto}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-laranja-escuro">
        {loja ? "Ver loja" : "Ver anúncios"}
        <ChevronRight className="size-5" aria-hidden />
      </span>
    </Link>
  );
}
