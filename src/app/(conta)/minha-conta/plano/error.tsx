"use client";
import { Botao } from "@/components/ui/botao";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
export default function ErroMeuPlano() {
  return <PaginaConta><TopoConta titulo="Meu plano" /><Aviso tipo="erro">Não foi possível consultar seu plano e pagamentos. Tente novamente antes de iniciar outro pagamento.</Aviso><Botao onClick={() => window.location.reload()}>Tentar novamente</Botao></PaginaConta>;
}
