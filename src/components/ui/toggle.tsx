"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { toggleVariants, type ToggleVariantProps } from "@/components/ui/toggle-variants"
import { cn } from "@/lib/utils"


function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & ToggleVariantProps) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
