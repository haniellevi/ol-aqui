"use client";
import { Botao } from "@/components/ui/botao";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
export default function ErroMinhaLoja({ reset }: { reset: () => void }) {
  return <PaginaConta><TopoConta titulo="Minha loja" /><Aviso tipo="erro">Não foi possível carregar sua loja. Tente novamente para editar com segurança.</Aviso><Botao onClick={reset}>Tentar novamente</Botao></PaginaConta>;
}
