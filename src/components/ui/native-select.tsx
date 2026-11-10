import * as React from "react"
import { cn } from "@/lib/utils"
import { classesCampo } from "@/components/ui/input"

import { ChevronDownIcon } from "lucide-react"

// Select nativo (abre a lista do próprio celular) com a caixa de campo do projeto.
// `className` vai para a moldura (largura, margem); o resto vai para o <select>.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("group/native-select relative w-full", className)} data-slot="native-select-wrapper">
      <select data-slot="native-select" className={cn(classesCampo, "h-10 appearance-none pr-9")} {...props} />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
