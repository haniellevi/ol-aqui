import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// Caixa de campo do Mercado da Região: uma só para input, textarea e select.
// `olaki-campo` baixa a altura para 36px no computador (globals.css). Erro vem de aria-invalid.
export const classesCampo =
  "olaki-campo w-full min-w-0 rounded-campo border border-input bg-card px-3 text-base font-normal text-foreground outline-none transition-colors " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 " +
  "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-fundo disabled:opacity-70"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(classesCampo, "h-10", className)}
      {...props}
    />
  )
}

export { Input }
