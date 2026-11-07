import { iniciais } from "@/components/vitrine/util";

// Logo redondo da loja, ou as iniciais quando não há logo.
export function AvatarVitrine({ nome, logo, tamanho = "md" }: { nome: string; logo?: string | null; tamanho?: "md" | "lg" | "xl" }) {
  const t = tamanho === "xl" ? "size-24 text-2xl" : tamanho === "lg" ? "size-16 text-xl" : "size-12 text-base";
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage; img simples é leve
      <img src={logo} alt="" width={96} height={96} loading="lazy" className={`${t} shrink-0 rounded-full border border-borda bg-cartao object-cover`} />
    );
  }
  return (
    <span aria-hidden className={`${t} grid shrink-0 place-items-center rounded-full bg-beringela font-bold text-white`}>
      {iniciais(nome)}
    </span>
  );
}
