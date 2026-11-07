import "server-only";
import { unstable_rethrow } from "next/navigation";

/**
 * Roda uma leitura e, se algo quebrar (rede, variável faltando), devolve o padrão
 * em vez de mostrar erro técnico. Repassa os sinais internos do Next (redirect, notFound, página dinâmica).
 */
export async function seguro<T>(leitura: () => Promise<T>, padrao: T): Promise<T> {
  try {
    return await leitura();
  } catch (e) {
    unstable_rethrow(e);
    return padrao;
  }
}
