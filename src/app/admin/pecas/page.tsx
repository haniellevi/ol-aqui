import { Info, PackageSearch } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";

// Página de peças: o que o app usa para montar as telas. Serve para conferir a régua num lugar só.
export const metadata = { title: "Peças do design", robots: { index: false } };

const TONS = [
  ["default", "Em teste"],
  ["secondary", "Rascunho"],
  ["success", "No ar"],
  ["warning", "Em análise"],
  ["destructive", "Bloqueado"],
  ["featured", "Destaque"],
  ["solid", "Vendido"],
  ["outline", "Contorno"],
] as const;

export default function PaginaPecas() {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-titulo font-semibold text-beringela">Peças do design</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Selos</h2>
        <div className="flex flex-wrap gap-2">
          {TONS.map(([tom, texto]) => (
            <Badge key={tom} variant={tom}>{texto}</Badge>
          ))}
        </div>
      </section>
      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Avisos</h2>
        <Alert>
          <Info />
          <AlertTitle>Aviso neutro</AlertTitle>
          <AlertDescription>Para explicar algo sem pedir ação.</AlertDescription>
        </Alert>
        <Alert variant="info">Informação da própria loja ou do plano.</Alert>
        <Alert variant="success">Deu certo: o anúncio foi publicado.</Alert>
        <Alert variant="warning">Atenção: falta confirmar o celular.</Alert>
        <Alert variant="destructive">Não foi possível salvar. Tente de novo.</Alert>
      </section>
      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Tela vazia</h2>
        <Vazio titulo="Nenhum anúncio ainda" texto="Quando você publicar, ele aparece aqui." icone={<PackageSearch />}>
          <Botao tamanho="pequeno">Anunciar</Botao>
        </Vazio>
      </section>
      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Tela de espera</h2>
        <div className="flex items-center gap-3 rounded-card bg-card p-3 shadow-1">
          <Skeleton className="size-12 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      </section>
    </div>
  );
}
