"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_MANUTENCAO, DURACAO_LIBERACAO_S, PAGINA_MANUTENCAO, codigoConfere, criarLiberacao, manutencaoLigada } from "@/lib/manutencao";

/** A equipe digita o código de MANUTENCAO_CODIGO e passa a ver o site durante a manutenção. */
export async function liberarEquipe(formData: FormData) {
  if (!manutencaoLigada()) redirect("/");
  const digitado = String(formData.get("codigo") ?? "").slice(0, 200);
  const liberacao = (await codigoConfere(digitado)) ? await criarLiberacao(Date.now()) : null;
  if (!liberacao) redirect(`${PAGINA_MANUTENCAO}?erro=1`);
  (await cookies()).set(COOKIE_MANUTENCAO, liberacao, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_LIBERACAO_S,
  });
  redirect("/");
}
