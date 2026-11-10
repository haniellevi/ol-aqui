"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

// Conta as páginas vistas e de onde a pessoa veio (Instagram, rádio, QR da loja...).
// Sem cookie e sem dado pessoal: um código aleatório guardado só neste navegador.
// A origem vale para a visita inteira (aba aberta), não só para a primeira página.

const CHAVE_VISITANTE = "mr_visitante";
const CHAVE_SESSAO = "mr_sessao_origem";
const CHAVE_PRIMEIRA = "mr_primeira_origem";
const CHAVE_CONTA = "mr_origem_conta_ok";

type Origem = { origem: string | null; campanha: string | null; referencia: string | null };

function ler(armazem: Storage | undefined, chave: string): string | null {
  try {
    return armazem?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}
function gravar(armazem: Storage | undefined, chave: string, valor: string) {
  try {
    armazem?.setItem(chave, valor);
  } catch {
    /* navegador sem armazenamento: segue sem guardar */
  }
}

function origemDaSessao(): Origem {
  const salvo = ler(window.sessionStorage, CHAVE_SESSAO);
  if (salvo) {
    try {
      return JSON.parse(salvo) as Origem;
    } catch {
      /* refaz abaixo */
    }
  }
  const q = new URLSearchParams(window.location.search);
  let referencia: string | null = null;
  try {
    const r = document.referrer ? new URL(document.referrer).host : "";
    referencia = r && r !== window.location.host ? r : null;
  } catch {
    referencia = null;
  }
  const o: Origem = {
    origem: q.get("origem") ?? q.get("utm_source"),
    campanha: q.get("campanha") ?? q.get("utm_campaign"),
    referencia,
  };
  gravar(window.sessionStorage, CHAVE_SESSAO, JSON.stringify(o));
  return o;
}

export function RastreioVisitas() {
  const caminho = usePathname();
  const { isSignedIn } = useAuth();
  // lido por referência: entrar na conta não conta uma página a mais
  const logado = useRef(isSignedIn);
  logado.current = isSignedIn;

  useEffect(() => {
    if (!caminho || caminho.startsWith("/admin") || caminho.startsWith("/api")) return;
    let visitante = ler(window.localStorage, CHAVE_VISITANTE);
    const primeira = !visitante;
    if (!visitante) {
      visitante = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).toLowerCase();
      gravar(window.localStorage, CHAVE_VISITANTE, visitante);
    }
    const o = origemDaSessao();
    const primeiraOrigem = ler(window.localStorage, CHAVE_PRIMEIRA);
    const conta = logado.current && primeiraOrigem && !ler(window.localStorage, CHAVE_CONTA) ? (JSON.parse(primeiraOrigem) as Origem) : null;

    fetch("/api/visita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        visitante,
        caminho,
        origem: o.origem,
        campanha: o.campanha,
        referencia: o.referencia,
        celular: window.matchMedia("(pointer: coarse)").matches,
        primeira,
        conta: conta ? { origem: conta.origem, campanha: conta.campanha } : undefined,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((r: { origem?: string | null; contaMarcada?: boolean } | null) => {
        // guarda o primeiro clique que veio de algum lugar (vale para a conta criada depois)
        if (r?.origem && r.origem !== "direto" && !primeiraOrigem) {
          gravar(window.localStorage, CHAVE_PRIMEIRA, JSON.stringify({ origem: r.origem, campanha: o.campanha, referencia: null }));
        }
        if (r?.contaMarcada) gravar(window.localStorage, CHAVE_CONTA, "1");
      })
      .catch(() => {
        /* sem internet: a visita só não é contada */
      });
  }, [caminho]);

  return null;
}
