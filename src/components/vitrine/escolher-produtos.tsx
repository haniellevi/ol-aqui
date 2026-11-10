"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { definirProdutosSecao } from "@/app/(conta)/minha-conta/loja/vitrine-actions";
import { preco } from "@/lib/formato";
import type { MeuAnuncioVitrine } from "@/lib/tipos-vitrine";

// Marcar os produtos que entram numa seção. A ordem fica: os que já estavam, depois os novos marcados.
// Produto da seção que está fora do ar agora (em análise, vendido...) não aparece na lista, mas
// continua guardado na seção ao salvar: volta sozinho quando estiver no ar de novo.
export function EscolherProdutos({
  secaoId,
  anuncios,
  escolhidos: inicial,
  maximo,
}: {
  secaoId: string;
  anuncios: MeuAnuncioVitrine[];
  escolhidos: string[];
  /** Produtos por seção (configuração do painel; null = sem limite). */
  maximo: number | null;
}) {
  const router = useRouter();
  const existentes = new Set(anuncios.map((a) => a.id));
  const [escolhidos, setEscolhidos] = useState<string[]>(inicial.filter((id) => existentes.has(id)));
  const guardados = inicial.filter((id) => !existentes.has(id));
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const cheio = maximo !== null && escolhidos.length + guardados.length >= maximo;

  function alternar(id: string) {
    setOk(false);
    setErro(null);
    setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : cheio ? l : [...l, id]));
  }

  function salvar() {
    setErro(null);
    setOk(false);
    iniciar(async () => {
      const r = await definirProdutosSecao(secaoId, [...escolhidos, ...guardados]);
      if (!r.ok) setErro(r.erro.mensagem);
      else {
        setOk(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-semibold" aria-live="polite">
        {escolhidos.length === 0 ? "Nenhum produto marcado" : escolhidos.length === 1 ? "1 produto marcado" : `${escolhidos.length} produtos marcados`}
        {maximo !== null && <span className="font-normal text-texto-suave"> (até {maximo})</span>}
      </p>
      {guardados.length > 0 && (
        <p className="text-base text-texto-suave">
          {guardados.length === 1
            ? "Mais 1 produto desta seção está fora do ar agora (por exemplo, em análise). Ele continua na seção e volta quando estiver no ar."
            : `Mais ${guardados.length} produtos desta seção estão fora do ar agora (por exemplo, em análise). Eles continuam na seção e voltam quando estiverem no ar.`}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {anuncios.map((a) => {
          const marcado = escolhidos.includes(a.id);
          const bloqueado = !marcado && cheio;
          return (
            <li key={a.id}>
              <label
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-card border-2 bg-cartao p-2 shadow-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro ${
                  marcado ? "border-laranja-escuro bg-selecao" : "border-transparent"
                } ${bloqueado ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input type="checkbox" checked={marcado} disabled={bloqueado || pendente} onChange={() => alternar(a.id)} className="sr-only" />
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-campo border-2 ${marcado ? "border-laranja-escuro bg-laranja-escuro text-white" : "border-borda bg-cartao"}`}
                >
                  {marcado && <Check className="size-5" />}
                </span>
                <span className="relative size-14 shrink-0 overflow-hidden rounded-campo bg-borda">
                  {a.capa ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura do Storage
                    <img src={a.capa} alt="" width={56} height={56} loading="lazy" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <ImageOff className="absolute inset-0 m-auto size-5 text-texto-suave" aria-hidden />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 text-base leading-5">{a.titulo}</span>
                  <span className="text-base font-bold">{preco(a.preco_centavos)}</span>
                  {a.status === "pausado" && <span className="text-[13px] text-texto-suave">Pausado: só aparece quando voltar ao ar</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {ok && <Aviso tipo="ok">Produtos da seção salvos.</Aviso>}
      </div>
      <Botao larguraTotal icone={<Save />} carregando={pendente} textoCarregando="Salvando..." onClick={salvar}>
        Salvar produtos
      </Botao>
    </div>
  );
}
