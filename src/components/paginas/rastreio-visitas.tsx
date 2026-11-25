"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { CHAVE_CONSENTIMENTO, EVENTO_CONSENTIMENTO, NEGADO, type Preferencia } from "@/lib/metricas/consentimento";
import { limparIdentificadores, podeMedir, preferenciaAtual, prepararIdentidadeMedicao, salvarPreferencia, sessaoPageviews } from "@/lib/metricas/cliente";
import { rotaNeutra } from "@/lib/metricas/contrato";

export function RastreioVisitas() {
  const caminho = usePathname();
  const [preferencia, setPreferencia] = useState<Preferencia>(NEGADO);
  const [aberto, setAberto] = useState(false);
  const ultima = useRef<string | null>(null);
  useEffect(() => {
    const atualizar = () => {
      const p = preferenciaAtual();
      setPreferencia(p);
      if (!p.estatistica) { limparIdentificadores(); ultima.current = null; }
    };
    atualizar();
    setAberto(!document.cookie.includes(`${CHAVE_CONSENTIMENTO}=`));
    const outraAba = (e: StorageEvent) => { if (e.key === CHAVE_CONSENTIMENTO || e.key === null) atualizar(); };
    window.addEventListener(EVENTO_CONSENTIMENTO, atualizar);
    window.addEventListener("storage", outraAba);
    return () => {
      window.removeEventListener(EVENTO_CONSENTIMENTO, atualizar);
      window.removeEventListener("storage", outraAba);
    };
  }, []);
  useEffect(() => {
    if (!podeMedir() || !caminho) { ultima.current = null; return; }
    if (ultima.current === caminho) return;
    const controller = new AbortController();
    const enviar = () => {
      if (!podeMedir() || document.visibilityState !== "visible" || ultima.current === caminho) return;
      // Uma tentativa por navegação elegível, inclusive se storage/cookie falhar. Sem fila.
      ultima.current = caminho;
      try {
        const identidade = prepararIdentidadeMedicao(true);
        if (!identidade) return;
        const { visitante, primeira } = identidade;
        const sessao = sessaoPageviews(Date.now(), location.search);
        if (!sessao) return;
        void fetch("/api/visita", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ visitante, sessao: sessao.id, ocorrencia: crypto.randomUUID(), caminho: rotaNeutra(caminho), origem: sessao.origem, primeira, celular: matchMedia("(pointer: coarse)").matches }),
        }).catch(() => undefined);
      } catch { /* storage indisponível: nenhuma coleta */ }
    };
    const timer = setTimeout(enviar, 0);
    document.addEventListener("visibilitychange", enviar);
    return () => { clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", enviar); };
  }, [caminho, preferencia.estatistica]);
  const escolher = (p: Preferencia) => { salvarPreferencia(p); setAberto(false); };
  if (!rotaNeutra(caminho) && caminho !== "/privacidade") return null;
  return (
    <section aria-label="Preferências de privacidade" className="border-b border-borda bg-cartao p-4 pb-reserva-nav text-base text-texto md:pb-4">
      {aberto ? <div className="mx-auto flex max-w-xl flex-col gap-3">
        <h2 className="text-lg font-semibold text-beringela">Você escolhe o que compartilhar</h2>
        <p>Estatísticas ajudam a entender visitas e interesse nos anúncios. Marketing permite futuras medições de campanhas, que estão desligadas. Você pode recusar e continuar usando o site.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => escolher({ v: 1, estatistica: true, marketing: true })}>Aceitar opcionais</Botao>
          <Botao variante="secundario" onClick={() => escolher(NEGADO)}>Recusar opcionais</Botao>
        </div>
        <details>
          <summary className="min-h-toque cursor-pointer py-3 font-semibold text-beringela">Personalizar</summary>
          <label className="flex min-h-toque items-center gap-3"><input type="checkbox" checked={preferencia.estatistica} onChange={(e) => setPreferencia({ ...preferencia, estatistica: e.target.checked })} />Estatísticas</label>
          <label className="flex min-h-toque items-center gap-3"><input type="checkbox" checked={preferencia.marketing} onChange={(e) => setPreferencia({ ...preferencia, marketing: e.target.checked })} />Marketing</label>
          <Botao variante="secundario" onClick={() => escolher(preferencia)}>Salvar escolhas</Botao>
        </details>
        <p>A retirada encerra novas medições neste navegador. Dados necessários à conta e aos avisos do Radar têm escolhas próprias.</p>
        <Botao href="/privacidade" variante="texto">Ler política de privacidade</Botao>
      </div> : <Botao variante="texto" onClick={() => setAberto(true)}>Preferências de privacidade</Botao>}
    </section>
  );
}
