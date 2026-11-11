"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { API_VERIFICACAO_VENDEDOR, MAX_ARQUIVO_VERIFICACAO } from "@/lib/verificacao-vendedor";

export function FormVerificacaoVendedor() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando || enviado) return;
    setErro(null);
    const form = new FormData(e.currentTarget);
    for (const campo of ["documento", "comprovante"]) {
      const arquivo = form.get(campo);
      if (!(arquivo instanceof File) || arquivo.size < 1 || arquivo.size > MAX_ARQUIVO_VERIFICACAO) {
        setErro("Selecione os dois arquivos. Cada arquivo pode ter até 2 MB.");
        return;
      }
    }
    setEnviando(true);
    try {
      const res = await fetch(API_VERIFICACAO_VENDEDOR, { method: "POST", body: form });
      const retorno = await res.json().catch(() => null) as { ok?: boolean; mensagem?: string } | null;
      if (!res.ok || !retorno?.ok) {
        setErro(retorno?.mensagem ?? "Não foi possível enviar. Confira o tamanho dos arquivos e tente novamente.");
        if (res.status === 409) router.refresh();
        return;
      }
      setEnviado(true);
      router.refresh();
    } catch {
      setErro("Não conseguimos confirmar o envio. Atualize a página para consultar a situação antes de tentar novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form action={API_VERIFICACAO_VENDEDOR} method="post" encType="multipart/form-data" onSubmit={enviar} className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">Envie os dois arquivos em PDF, JPG ou PNG, com até 2 MB por arquivo.</p>
      <fieldset disabled={enviando || enviado} className="flex min-w-0 flex-col gap-4">
        <CampoArquivo rotulo="Documento oficial com foto" name="documento" required accept="application/pdf,image/jpeg,image/png" textoBotao="Escolher documento" textoTrocar="Trocar documento" />
        <CampoArquivo rotulo="Comprovante de endereço" name="comprovante" required accept="application/pdf,image/jpeg,image/png" textoBotao="Escolher comprovante" textoTrocar="Trocar comprovante" />
        <Botao type="submit" carregando={enviando} textoCarregando="Enviando..." disabled={enviado}>Enviar para conferência</Botao>
      </fieldset>
      {enviado && <p role="status" className="text-sm font-semibold text-verde-escuro">Arquivos enviados para conferência.</p>}
      {erro && <p role="alert" className="text-sm font-semibold text-perigo">{erro}</p>}
    </form>
  );
}
