"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"

// Folha: no celular sobe de baixo e fecha arrastando para baixo (Drawer);
// no computador é a janela do meio (Dialog). Mesmo conteúdo nos dois.
const NoCelular = React.createContext(false)

type PropsFolha = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (aberta: boolean) => void
  children: React.ReactNode
}

function Folha({ onOpenChange, children, ...props }: PropsFolha) {
  const celular = useIsMobile()
  const aoMudar = onOpenChange ? (aberta: boolean) => onOpenChange(aberta) : undefined
  return (
    <NoCelular.Provider value={celular}>
      {celular ? (
        <Drawer showSwipeHandle onOpenChange={aoMudar} {...props}>{children}</Drawer>
      ) : (
        <Dialog onOpenChange={aoMudar} {...props}>{children}</Dialog>
      )}
    </NoCelular.Provider>
  )
}

function FolhaTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const celular = React.useContext(NoCelular)
  return celular ? <DrawerTrigger {...(props as React.ComponentProps<typeof DrawerTrigger>)} /> : <DialogTrigger {...props} />
}

function FolhaContent({
  className,
  children,
  showCloseButton = true,
}: {
  className?: string
  children: React.ReactNode
  /** Só vale no computador; no celular fecha arrastando ou tocando fora. */
  showCloseButton?: boolean
}) {
  const celular = React.useContext(NoCelular)
  if (!celular) return <DialogContent className={className} showCloseButton={showCloseButton}>{children}</DialogContent>
  return (
    <DrawerContent className="rounded-t-folha border-border pt-2">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] text-base">{children}</div>
    </DrawerContent>
  )
}

function FolhaHeader({ className, ...props }: React.ComponentProps<"div">) {
  const celular = React.useContext(NoCelular)
  return celular ? <DrawerHeader className={cn("gap-2 p-0 text-left!", className)} {...props} /> : <DialogHeader className={className} {...props} />
}

function FolhaTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  const celular = React.useContext(NoCelular)
  return celular ? (
    <DrawerTitle className={cn("text-xl font-semibold text-beringela", className)}>{children}</DrawerTitle>
  ) : (
    <DialogTitle className={className}>{children}</DialogTitle>
  )
}

function FolhaDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  const celular = React.useContext(NoCelular)
  return celular ? (
    <DrawerDescription className={cn("text-sm", className)}>{children}</DrawerDescription>
  ) : (
    <DialogDescription className={className}>{children}</DialogDescription>
  )
}

export { Folha, FolhaTrigger, FolhaContent, FolhaHeader, FolhaTitle, FolhaDescription }
