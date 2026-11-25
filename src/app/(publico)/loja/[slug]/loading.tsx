import { Skeleton } from "@/components/ui/skeleton";
import { CarregandoGrade } from "@/components/ui/carregando";

export default function CarregandoLoja() {
  return <div className="mx-auto w-full max-w-6xl" aria-label="Carregando a loja" role="status">
    <Skeleton className="h-16 w-full" />
    <div className="flex flex-col gap-2 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-toque w-full" /></div>
    <CarregandoGrade />
  </div>;
}
