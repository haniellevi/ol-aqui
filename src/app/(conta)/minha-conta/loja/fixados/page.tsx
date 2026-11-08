import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ImageOff, Package, Plus } from "lucide-react";
import { meusAnunciosParaVitrine, meusRecursosVitrine, minhaVitrineCompleta, planosPublicos } from "@/lib/dados/vitrine-completa";
import { preco } from "@/lib/formato";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import type { MeuAnuncioVitrine } from "@/lib/tipos-vitrine";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { BotaoFixar, MoverFixado } from "@/components/vitrine/botao-fixar";
import { UpsellPlano } from "@/components/vitrine/upsell-plano";
import { textoDisponivelEm } from "@/components/vitrine/regras";

export const metadata: Metadata = { title: "Produtos no topo" };

// Produtos fixados no topo da vitrine (antes dos mais novos). Quantos, o plano diz (tabela planos);
// o banco confere ao fixar. Plano menor: os que passam ficam guardados e só voltam a aparecer depois.
export default async function PaginaFixadosLoja() {
  const v = await minhaVitrineCompleta();
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Produtos no topo" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para destacar produtos no topo da vitrine.">
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const [recursos, anuncios, planos] = await Promise.all([meusRecursosVitrine(), meusAnunciosParaVitrine(v.id), planosPublicos()]);
  const maximo = recursos.fixados_max;
  const noPlano = maximo === null || maximo > 0;
  const fixados = anuncios.filter((a) => a.fixado_na_loja !== null).sort((a, b) => (a.fixado_na_loja ?? 0) - (b.fixado_na_loja ?? 0));
  const outros = anuncios.filter((a) => a.fixado_na_loja === null && a.status === "ativo");
  // O banco conta todos os fixados da loja (só ficam fixados os anúncios no ar ou pausados)
  const total = Math.max(fixados.length, recursos.fixados_total);
  const cheio = maximo !== null && total >= maximo;
  // Posição entre os fixados que estão no ar (é o que a vitrine conta para o limite do plano)
  let noAr = 0;
  const avisos = new Map<string, string | null>();
  for (const a of fixados) {
    if (a.status !== "ativo") {
      avisos.set(a.id, "Pausado: não aparece na vitrine");
      continue;
    }
    noAr++;
    avisos.set(a.id, maximo !== null && noAr > maximo ? "Não aparece no topo: passa do seu plano" : null);
  }

  return (
    <PaginaConta>
      <TopoConta
        titulo="Produtos no topo"
        texto="Os produtos fixados aparecem no alto da sua vitrine, em “Destaques da loja”, na ordem que você escolher."
        voltar={LINK_MINHA_LOJA}
        textoVoltar="Minha loja"
      />

      {!noPlano && (
        <UpsellPlano titulo="Fixar produtos no topo" texto="Deixe seus melhores produtos sempre no alto da vitrine." disponivel={textoDisponivelEm(planos, "fixados")} />
      )}
      {noPlano && maximo !== null && (
        <p className="text-base font-semibold">
          Seu plano deixa fixar até {maximo} {maximo === 1 ? "produto" : "produtos"}. Você tem {total}.
        </p>
      )}

      {fixados.length > 0 && (
        <section aria-labelledby="titulo-fixados" className="flex flex-col gap-3">
          <h2 id="titulo-fixados" className="text-lg font-bold">
            No topo agora
          </h2>
          <ul className="flex flex-col gap-3">
            {fixados.map((a, i) => (
              <li key={a.id}>
                <Linha anuncio={a} aviso={avisos.get(a.id)}>
                  <MoverFixado anuncioId={a.id} titulo={a.titulo} primeiro={i === 0} ultimo={i === fixados.length - 1} />
                  <BotaoFixar anuncioId={a.id} fixado />
                </Linha>
              </li>
            ))}
          </ul>
        </section>
      )}

      {noPlano && (
        <section aria-labelledby="titulo-outros" className="flex flex-col gap-3">
          <h2 id="titulo-outros" className="text-lg font-bold">
            Outros produtos no ar
          </h2>
          {cheio && <p className="text-base text-texto-suave">Para fixar outro, tire um do topo primeiro.</p>}
          {outros.length === 0 ? (
            <Vazio icone={<Package />} titulo="Nenhum outro produto no ar" texto="Ponha mais anúncios no ar para escolher quais ficam no topo.">
              <Botao href="/anunciar" larguraTotal icone={<Plus />}>
                Criar anúncio
              </Botao>
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {outros.map((a) => (
                <li key={a.id}>
                  <Linha anuncio={a}>{!cheio && <BotaoFixar anuncioId={a.id} fixado={false} />}</Linha>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PaginaConta>
  );
}

function Linha({ anuncio: a, aviso, children }: { anuncio: MeuAnuncioVitrine; aviso?: string | null; children?: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-card bg-cartao p-3 shadow-1">
      <div className="flex items-center gap-3">
        <span className="relative size-16 shrink-0 overflow-hidden rounded-campo bg-borda">
          {a.capa ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura do Storage
            <img src={a.capa} alt="" width={64} height={64} loading="lazy" className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImageOff className="absolute inset-0 m-auto size-5 text-texto-suave" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-base leading-5">{a.titulo}</span>
          <span className="text-base font-bold">{preco(a.preco_centavos)}</span>
          {aviso && <span className="text-[13px] font-semibold text-aviso">{aviso}</span>}
        </span>
      </div>
      {children}
    </article>
  );
}
