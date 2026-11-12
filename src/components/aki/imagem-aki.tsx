"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErroLojistaAki, pedirAoAki, type ImagemAki, type PedidoLojistaAki } from "@/lib/aki/lojista";

type PedidoImagem = Extract<PedidoLojistaAki, { id: string }>;
type Saldo = { restantes: number; disponivel: boolean };

export function useImagemAki(chave: string, consulta: string) {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [imagem, setImagem] = useState<ImagemAki | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState<PedidoImagem | null>(null);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);

  const atualizarSaldo = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/aki/lojista?${consulta}`, { cache: "no-store" });
      if (resposta.ok) {
        const dados = await resposta.json() as Saldo & { imagem: ImagemAki | null };
        setSaldo(dados);
        if (dados.imagem) setImagem((anterior) => anterior ?? dados.imagem);
      }
    } catch { /* A geração consulta e valida o saldo no servidor. */ }
  }, [consulta]);

  useEffect(() => {
    void atualizarSaldo();
    try {
      const salvo = sessionStorage.getItem(chave);
      if (salvo) setPendente(JSON.parse(salvo) as PedidoImagem);
    } catch { /* O navegador pode bloquear sessionStorage. */ }
  }, [atualizarSaldo, chave]);

  useEffect(() => {
    if (!pendente || pendente.id !== imagem?.id) return;
    setPendente(null);
    try { sessionStorage.removeItem(chave); } catch { /* usa o estado local */ }
  }, [chave, imagem, pendente]);

  async function gerar(novo: PedidoImagem) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setErro("");
    const pedido = pendente ?? novo;
    setPendente(pedido);
    try { sessionStorage.setItem(chave, JSON.stringify(pedido)); } catch { /* usa o estado local */ }
    try {
      const pronta = await pedirAoAki<ImagemAki>(pedido);
      setImagem(pronta);
      setSaldo({ restantes: pronta.restantes, disponivel: true });
    } catch (e) {
      if (!(e instanceof ErroLojistaAki) || e.repetirPedido) {
        setErro(e instanceof ErroLojistaAki ? e.message : "A conexão caiu. Confira o mesmo pedido para recuperar a imagem.");
        return;
      }
      setErro(e.message);
    } finally {
      emCurso.current = false;
      setOcupado(false);
      void atualizarSaldo();
    }
    setPendente(null);
    try { sessionStorage.removeItem(chave); } catch { /* usa o estado local */ }
  }

  return { saldo, imagem, ocupado, pendente: !!pendente, erro, gerar };
}

export function TextoSaldoAki({ saldo }: { saldo: Saldo | null }) {
  return <p className="text-sm text-texto-suave" aria-live="polite">
    {saldo?.disponivel === false ? "As imagens do Aki estão indisponíveis agora."
      : saldo ? `${saldo.restantes} ${saldo.restantes === 1 ? "crédito de imagem disponível" : "créditos de imagem disponíveis"}.`
      : "Cada imagem pronta usa 1 crédito."}
  </p>;
}
