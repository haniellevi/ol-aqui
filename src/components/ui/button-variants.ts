import { cva, type VariantProps } from "class-variance-authority"

// Botão oficial do Mercado da Região (DESIGN.md, seções 4 e 9). Todo estilo de botão mora aqui:
// o <Button> do shadcn e a casca <Botao> (botao.tsx) usam as mesmas classes.
// Alturas: normal 44px no toque e 36px com mouse; pequeno 36/32px visíveis (no toque a área tocável cresce para 44px); acao 48px (ação principal e WhatsApp);
// grande = Modo fácil do Radar (48px, letra 18px). Rótulo longo quebra linha e o botão cresce.
// Principal = laranja com texto beringela (nunca branco no laranja). Laranja nunca vira cor de letra.
export const buttonVariants = cva(
  "olaki-acao group/button inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-campo border border-transparent bg-clip-padding font-semibold outline-none " +
    "focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro " +
    "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 " +
    "aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primario: "bg-laranja text-beringela hover:brightness-95 active:brightness-90",
        secundario: "border-beringela bg-cartao text-beringela hover:bg-fundo",
        perigo: "border-perigo bg-cartao text-perigo hover:bg-perigo-fundo",
        whatsapp: "bg-verde-escuro text-white hover:brightness-95 active:brightness-90",
        texto: "text-laranja-escuro underline-offset-4 hover:underline",
        // Nomes do shadcn, para as peças que vêm dele (dialog, alert-dialog, sidebar).
        default: "bg-laranja text-beringela hover:brightness-95 active:brightness-90",
        outline: "border-borda bg-cartao text-beringela hover:bg-fundo aria-expanded:bg-fundo",
        secondary: "bg-selecao text-beringela hover:brightness-95",
        ghost: "text-beringela hover:bg-fundo aria-expanded:bg-fundo",
        destructive: "bg-perigo-fundo text-perigo hover:brightness-95",
        link: "text-laranja-escuro underline-offset-4 hover:underline",
      },
      size: {
        normal: "olaki-controle min-h-controle px-4 text-base leading-5",
        pequeno: "olaki-controle-pequeno relative min-h-controle-pequeno px-3 text-sm leading-4 after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] pointer-fine:md:after:hidden",
        toque: "min-h-toque min-w-toque px-4 text-base leading-5",
        acao: "min-h-acao px-5 text-base leading-5",
        grande: "min-h-12 px-5 text-facil leading-6",
        // Nomes do shadcn.
        default: "olaki-controle min-h-controle px-4 text-base leading-5",
        sm: "olaki-controle-pequeno min-h-controle-pequeno px-3 text-sm leading-4",
        lg: "min-h-acao px-5 text-base leading-5",
        icon: "size-controle pointer-fine:md:size-9",
        "icon-sm": "size-controle-pequeno pointer-fine:md:size-8",
        "icon-lg": "size-toque",
      },
    },
    defaultVariants: {
      variant: "primario",
      size: "normal",
    },
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
