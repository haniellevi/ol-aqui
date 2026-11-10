import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Armchair, Baby, Beef, Bike, BrickWall, Briefcase, Building2, Car, Cog, Dumbbell, Ellipsis, Footprints,
  Gamepad2, GraduationCap, Hammer, HandHelping, House, Lamp, Laptop, Map as Mapa, Package, PawPrint, Refrigerator,
  Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, SprayCan, Sprout, Store, Tag, Tractor, Trees, Truck, Tv,
  UserSearch, Wheat, Wrench, Zap,
} from "lucide-react";

// Ícone da categoria pelo nome salvo no banco (categorias.icone). Importa só os ícones
// usados pelas categorias, para não pesar o app. Nome desconhecido → etiqueta (Tag).
const ICONES: Record<string, LucideIcon> = {
  car: Car, bike: Bike, truck: Truck, wrench: Wrench, tractor: Tractor, cog: Cog, beef: Beef, sprout: Sprout,
  wheat: Wheat, house: House, "building-2": Building2, map: Mapa, trees: Trees, store: Store, sofa: Sofa,
  armchair: Armchair, refrigerator: Refrigerator, lamp: Lamp, hammer: Hammer, smartphone: Smartphone,
  laptop: Laptop, tv: Tv, "gamepad-2": Gamepad2, shirt: Shirt, footprints: Footprints, "shopping-bag": ShoppingBag,
  sparkles: Sparkles, "hand-helping": HandHelping, "brick-wall": BrickWall, zap: Zap, "spray-can": SprayCan,
  "graduation-cap": GraduationCap, ellipsis: Ellipsis, briefcase: Briefcase, "user-search": UserSearch,
  package: Package, dumbbell: Dumbbell, baby: Baby, "paw-print": PawPrint,
};

/** Nomes aceitos (útil para o painel mostrar a lista de ícones). */
export const NOMES_ICONES = Object.keys(ICONES);

/** Decorativo por padrão (aria-hidden): o nome da categoria vai sempre escrito ao lado. */
export function IconeCategoria({ nome, ...props }: { nome: string | null | undefined } & LucideProps) {
  const Icone = (nome && ICONES[nome]) || Tag;
  return <Icone aria-hidden {...props} />;
}

/** Ícone no círculo lavanda (padrão das categorias no Início). */
export function CirculoCategoria({ nome, className = "" }: { nome: string | null | undefined; className?: string }) {
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-selecao text-beringela ${className}`}>
      <IconeCategoria nome={nome} className="size-5" strokeWidth={2} />
    </span>
  );
}
