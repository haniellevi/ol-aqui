import * as React from "react"
import { cn } from "@/lib/utils"
import { classesCampo } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(classesCampo, "min-h-24 resize-y py-2 leading-6", className)}
      {...props}
    />
  )
}

export { Textarea }
