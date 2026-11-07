"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Meio = "celular" | "email";

/** Converte "(89) 99999-0000" em "+5589999990000" (formato que o Supabase Auth exige). */
function paraE164(celular: string) {
  const d = celular.replace(/\D/g, "");
  return `+${d.startsWith("55") ? d : `55${d}`}`;
}

export function FormEntrar() {
  const supabase = createClient();
  const router = useRouter();
  const voltar = useSearchParams().get("voltar") || "/";
  const [meio, setMeio] = useState<Meio>("celular");
  const [destino, setDestino] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"destino" | "codigo">("destino");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } =
      meio === "celular"
        ? await supabase.auth.signInWithOtp({ phone: paraE164(destino) })
        : await supabase.auth.signInWithOtp({ email: destino.trim(), options: { shouldCreateUser: true } });
    setCarregando(false);
    if (error) return setErro("Não conseguimos enviar o código. Confira e tente de novo.");
    setEtapa("codigo");
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } =
      meio === "celular"
        ? await supabase.auth.verifyOtp({ phone: paraE164(destino), token: codigo, type: "sms" })
        : await supabase.auth.verifyOtp({ email: destino.trim(), token: codigo, type: "email" });
    setCarregando(false);
    if (error) return setErro("Código inválido ou vencido.");
    router.replace(voltar);
    router.refresh();
  }

  const campo = "mt-1 h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-laranja";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Image src="/logo/olaki-opcao1-pin.svg" alt="OLAKI" width={200} height={70} className="mx-auto" priority />
      <h1 className="mt-8 text-xl font-bold">Entrar no OLAKI</h1>
      <p className="mt-1 text-sm text-neutral-500">Sem senha. Mandamos um código para você.</p>

      {etapa === "destino" ? (
        <form onSubmit={pedirCodigo} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1 text-sm font-medium">
            {(["celular", "email"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeio(m)}
                className={`h-10 rounded-lg ${meio === m ? "bg-white shadow-sm" : "text-neutral-500"}`}
              >
                {m === "celular" ? "Celular" : "E-mail"}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium">
            {meio === "celular" ? "Seu celular com DDD" : "Seu e-mail"}
            <input
              required
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              inputMode={meio === "celular" ? "tel" : "email"}
              autoComplete={meio === "celular" ? "tel" : "email"}
              placeholder={meio === "celular" ? "(89) 99999-0000" : "voce@email.com"}
              className={campo}
            />
          </label>
          <button disabled={carregando} className="h-12 w-full rounded-xl bg-laranja font-semibold text-marinho disabled:opacity-60">
            {carregando ? "Enviando…" : "Receber código"}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmar} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Código enviado para {destino}
            <input
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className={`${campo} text-center text-2xl tracking-[0.4em]`}
            />
          </label>
          <button disabled={carregando} className="h-12 w-full rounded-xl bg-laranja font-semibold text-marinho disabled:opacity-60">
            {carregando ? "Conferindo…" : "Entrar"}
          </button>
          <button type="button" onClick={() => setEtapa("destino")} className="w-full text-sm text-neutral-500 underline">
            Trocar {meio === "celular" ? "número" : "e-mail"}
          </button>
        </form>
      )}
      {erro && <p className="mt-4 text-sm text-red-600" role="alert">{erro}</p>}
    </main>
  );
}
