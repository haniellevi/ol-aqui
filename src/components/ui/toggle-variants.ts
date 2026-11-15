import { cva, type VariantProps } from "class-variance-authority"

// Estilos do Toggle oficial (shadcn) num arquivo sem "use client", para servirem também a peças do
// servidor, como o Chip (chip.tsx). Todo estilo de chip mora aqui (DESIGN.md, seção 9).
// Chip: borda de campo e fundo branco; selecionado = fundo `selecao`, borda beringela e ✓ (o ✓ fica no Chip).
// Alturas: normal 44px no toque e 36px com mouse; toque sempre 44px; grande = Modo fácil do Radar (48px, letra 18px).
const CHIP =
  "gap-2 justify-start rounded-campo border font-semibold text-base text-beringela transition-colors " +
  "hover:text-beringela focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro focus-visible:ring-0"

export const toggleVariants = cva(
  "hover:text-foreground aria-pressed:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive data-[state=on]:bg-muted gap-1 rounded-lg text-sm font-medium transition-all [&_svg:not([class*='size-'])]:size-4 group/toggle inline-flex shrink-0 items-center justify-center whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-input hover:bg-muted border bg-transparent",
        chip: `${CHIP} border-borda-campo bg-cartao hover:bg-fundo active:bg-fundo`,
        chipAtivo: `${CHIP} border-beringela bg-selecao hover:bg-selecao aria-pressed:bg-selecao`,
      },
      size: {
        default: "min-h-controle min-w-controle px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "min-h-controle-pequeno min-w-controle-pequeno rounded-campo px-2.5 text-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-acao min-w-acao px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        normal: "olaki-controle min-h-controle px-3",
        toque: "min-h-toque min-w-toque max-w-full px-3 whitespace-normal",
        grande: "min-h-acao px-4 text-facil",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ToggleVariantProps = VariantProps<typeof toggleVariants>
