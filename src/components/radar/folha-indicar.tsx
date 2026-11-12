"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lightbulb, Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Alert } from "@/components/ui/alert";
import { Folha, FolhaContent, FolhaDescription, FolhaHeader, FolhaTitle } from "@/components/ui/folha";
import { preco } from "@/lib/formato";
import { buscarParaIndicar, indicarAnuncio } from "@/app/radar/actions";
import type { AnuncioParaIndicar } from "@/lib/tipos-radar";

// "Eu sei onde tem": a pessoa procura um anúncio da região (mesma busca do site) e indica para o pedido.
// O comprador vê a indicação sem saber quem indicou. O banco recusa anúncio da própria pessoa.
export function FolhaIndicar({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<AnuncioParaIndicar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [buscando, buscar] = useTransition();
  const [indicando, indicar] = useTransition();
  const trava = useRef(false);

  function abrir() {
    setErro(null);
    setFeito(false);
    setAberta(true);
  }

  function fechar() {
    if (trava.current) return;
    setAberta(false);
    if (feito) router.refresh();
  }

  function procurar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    buscar(async () => {
      try {
        const r = await buscarParaIndicar(pedidoId, termo);
        if (!r.ok) setErro(r.erro);
        else setLista(r.anuncios);
      } catch {
        setErro("Não deu para buscar agora. Tente novamente.");
      }
    });
  }

  function indicarEste(a: AnuncioParaIndicar) {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    indicar(async () => {
      try {
        const r = await indicarAnuncio(pedidoId, a.id);
        trava.current = false;
        if (!r.ok) setErro(r.erro);
        else setFeito(true);
      } catch {
        trava.current = false;
        setErro("Não conseguimos salvar. Tente novamente.");
      }
    });
  }

  return (
    <>
      <Botao larguraTotal icone={<Lightbulb />} onClick={abrir} tamanho="grande">
        Eu sei onde tem
      </Botao>
      <Folha open={aberta} onOpenChange={(v) => (v ? setAberta(true) : fechar())}>
        <FolhaContent>
          {feito ? (
            <>
              <FolhaHeader>
                <FolhaTitle className="text-3xl">Indicação enviada</FolhaTitle>
                <FolhaDescription className="text-facil">Obrigado! O comprador vai ver o anúncio que você indicou.</FolhaDescription>
              </FolhaHeader>
              <p className="inline-flex items-center gap-2 text-facil font-semibold text-verde-escuro">
                <CheckCircle2 className="size-5" aria-hidden />
                Pronto, já está no pedido.
              </p>
              <Botao larguraTotal variante="secundario" tamanho="grande" onClick={fechar}>
                Fechar
              </Botao>
            </>
          ) : (
            <>
              <FolhaHeader>
                <FolhaTitle className="text-3xl">Onde tem?</FolhaTitle>
                <FolhaDescription className="text-facil">Procure o anúncio de outra pessoa da região e indique para o comprador.</FolhaDescription>
              </FolhaHeader>
              <form onSubmit={procurar} className="flex flex-col gap-3" role="search">
                <Campo rotulo="O que você quer indicar?" name="busca-indicar" tamanho="grande" value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={80} autoComplete="off" enterKeyHint="search" />
                <Botao type="submit" variante="secundario" larguraTotal icone={<Search />} tamanho="grande" carregando={buscando} textoCarregando="Procurando...">
                  Procurar
                </Botao>
              </form>
              {lista && lista.length === 0 && <p className="text-facil text-texto-suave">Não achamos anúncios com esse nome. Tente outra palavra.</p>}
              {lista && lista.length > 0 && (
                <ul className="flex max-h-[45dvh] flex-col gap-3 overflow-y-auto">
                  {lista.map((a) => (
                    <li key={a.id} className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-3">
                      <div className="flex items-center gap-3">
                        {a.capa ? (
                          // eslint-disable-next-line @next/next/no-img-element -- capa do anúncio no Storage
                          <img src={a.capa} alt="" width={64} height={64} className="size-16 shrink-0 rounded-campo bg-borda object-cover" />
                        ) : (
                          <span aria-hidden className="size-16 shrink-0 rounded-campo bg-borda" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-facil font-semibold break-words">{a.titulo}</span>
                          <span className="text-facil font-bold text-beringela">{preco(a.preco_centavos)}</span>
                          <span className="text-facil text-texto-suave break-words">{a.vitrine_nome}</span>
                        </div>
                      </div>
                      <Botao variante="secundario" larguraTotal tamanho="grande" disabled={indicando} onClick={() => indicarEste(a)}>
                        Indicar este
                      </Botao>
                    </li>
                  ))}
                </ul>
              )}
              {erro && <Alert variant="destructive" role="alert" className="text-facil">{erro}</Alert>}
            </>
          )}
        </FolhaContent>
      </Folha>
    </>
  );
}
