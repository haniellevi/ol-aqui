import { avisoTermos } from "@/lib/dados/paginas";
import { FaixaTermos } from "./faixa-termos";

// Lê no servidor se a pessoa logada tem versão nova dos termos para aceitar. Visitante: nada.
export async function AvisoTermos() {
  const aviso = await avisoTermos();
  return aviso ? <FaixaTermos aviso={aviso} /> : null;
}
