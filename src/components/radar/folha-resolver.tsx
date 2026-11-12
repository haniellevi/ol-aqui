"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Store } from "lucide-react";
import { Botao, type VarianteBotao } from "@/components/ui/botao";
import { Alert } from "@/components/ui/alert";
import { Folha, FolhaContent, FolhaDescription, FolhaHeader, FolhaTitle } from "@/components/ui/folha";
import { avaliarPedido, resolverPedido } from "@/app/radar/actions";

const BOTAO_GRANDE = "min-h-12! text-lg!";

export type LojaComProposta = { propostaId: string; lojaNome: string };

// "Já resolvi": passo 1 "Com quem você resolveu?" (uma loja que mandou oferta ou "Outro lugar");
// passo 2, só com loja: "Como foi?" 👍/👎 ou "Pular". A escolha fica aqui (o banco não devolve).
export function FolhaResolver({
  pedidoId,
  propostas,
  variante = "secundario",
}: {
  pedidoId: string;
  propostas: LojaComProposta[];
  variante?: VarianteBotao;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [passo, setPasso] = useState<1 | 2>(1);
  const [loja, setLoja] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  const resolveu = useRef(false);

  function abrir() {
    setErro(null);
    setPasso(1);
    setLoja(null);
    resolveu.current = false;
    setAberta(true);
  }

  function fechar() {
    if (trava.current) return;
    setAberta(false);
    if (resolveu.current) router.refresh();
  }

  function rodar(acao: () => Promise<{ ok: boolean; erro?: string }>, depois: () => void) {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await acao();
        trava.current = false;
        if (!r.ok) setErro(r.erro ?? "Não deu certo. Tente novamente.");
        else depois();
      } catch {
        trava.current = false;
        setErro("Não conseguimos salvar. Tente novamente.");
      }
    });
  }

  function escolherLoja(p: LojaComProposta) {
    rodar(() => resolverPedido(pedidoId, p.propostaId, false), () => {
      resolveu.current = true;
      setLoja(p.lojaNome);
      setPasso(2);
    });
  }

  function outroLugar() {
    rodar(() => resolverPedido(pedidoId, null, true), () => {
      resolveu.current = true;
      fechar();
    });
  }

  function avaliar(nota: 1 | -1) {
    rodar(() => avaliarPedido(pedidoId, nota), fechar);
  }

  return (
    <>
      <Botao variante={variante} larguraTotal icone={<CheckCircle2 />} onClick={abrir} className={BOTAO_GRANDE}>
        Já resolvi
      </Botao>
      <Folha open={aberta} onOpenChange={(v) => (v ? setAberta(true) : fechar())}>
        <FolhaContent>
          {passo === 1 ? (
            <>
              <FolhaHeader>
                <FolhaTitle className="text-2xl">Com quem você resolveu?</FolhaTitle>
                <FolhaDescription className="text-lg">O pedido sai do Radar e as lojas param de ver.</FolhaDescription>
              </FolhaHeader>
              <div className="flex flex-col gap-2">
                {propostas.map((p) => (
                  <Botao key={p.propostaId} variante="secundario" larguraTotal icone={<Store />} disabled={pendente} onClick={() => escolherLoja(p)} className={`${BOTAO_GRANDE} sm:max-w-none`}>
                    {p.lojaNome}
                  </Botao>
                ))}
                <Botao variante="secundario" larguraTotal disabled={pendente} onClick={outroLugar} className={`${BOTAO_GRANDE} sm:max-w-none`}>
                  Outro lugar
                </Botao>
              </div>
            </>
          ) : (
            <>
              <FolhaHeader>
                <FolhaTitle className="text-2xl">Como foi?</FolhaTitle>
                <FolhaDescription className="text-lg">Sua compra com {loja}.</FolhaDescription>
              </FolhaHeader>
              <div className="flex flex-col gap-2">
                <Botao variante="secundario" larguraTotal disabled={pendente} onClick={() => avaliar(1)} className={`${BOTAO_GRANDE} sm:max-w-none`}>
                  <span aria-hidden>👍</span> Foi bom
                </Botao>
                <Botao variante="secundario" larguraTotal disabled={pendente} onClick={() => avaliar(-1)} className={`${BOTAO_GRANDE} sm:max-w-none`}>
                  <span aria-hidden>👎</span> Não foi bom
                </Botao>
                <Botao variante="texto" larguraTotal disabled={pendente} onClick={fechar} className={`${BOTAO_GRANDE} sm:max-w-none`}>
                  Pular
                </Botao>
              </div>
            </>
          )}
          {erro && <Alert variant="destructive" role="alert" className="text-lg">{erro}</Alert>}
        </FolhaContent>
      </Folha>
    </>
  );
}
