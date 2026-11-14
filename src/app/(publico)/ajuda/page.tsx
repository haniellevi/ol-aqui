import type { Metadata } from "next";
import { FileText, LifeBuoy } from "lucide-react";
import { regiaoAtual } from "@/lib/dados/regiao";
import { ajudaCompleta, contatoEquipe, precosDestaqueAjuda } from "@/lib/dados/paginas";
import { planosPublicos } from "@/lib/dados/vitrine-completa";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { preco } from "@/lib/formato";
import { LINK_PLANOS, LINK_PRIVACIDADE, LINK_TERMOS } from "@/lib/rotas";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { ContatoSuporte } from "@/components/paginas/contato-suporte";
import { ListaAjuda } from "./lista-ajuda";

// T40 · Ajuda e dicas de segurança. Perguntas e categorias vêm do painel (tela 12, aba Ajuda);
// contato da equipe vem de Configurações > Geral; preços vêm de destaque_tipos e planos (nunca do texto).

export const metadata: Metadata = {
  title: "Ajuda e dicas de segurança",
  description: "Como não cair em golpe, como vender, como funciona o Radar, os destaques e os planos do Mercado da Região.",
  alternates: { canonical: "/ajuda" },
};

function dias(n: number | null) {
  if (!n) return "uma vez";
  return n === 1 ? "por 1 dia" : `por ${n} dias`;
}

export default async function PaginaAjuda() {
  const regiao = await regiaoAtual();
  const [ajuda, contato, destaques, planos] = await Promise.all([
    ajudaCompleta(),
    contatoEquipe(regiao?.id ?? null),
    precosDestaqueAjuda(regiao?.id ?? null),
    planosPublicos(),
  ]);
  const lugar = lugarDaRegiao(regiao);
  const planosVenda = planos.filter((p) => !p.e_teste && p.preco_centavos > 0);

  const precosHoje =
    destaques.length > 0 || planosVenda.length > 0 ? (
      <div className="flex flex-col gap-2 border-t border-borda pt-3">
        {destaques.length > 0 && <>
          <h3 className="text-base font-semibold">Destaques em {lugar}</h3>
          <ul className="flex flex-col gap-2">
            {destaques.map((d) => (
              <li key={d.slug} className="flex flex-col">
                <span className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-base">
                  <strong className="font-semibold">{d.nome}</strong>
                  <span className="tabular-nums">{d.preco_centavos > 0 ? preco(d.preco_centavos) : "Grátis"} {dias(d.dias)}</span>
                </span>
                {d.descricao && <span className="text-sm text-texto-suave">{d.descricao}</span>}
              </li>
            ))}
          </ul>
        </>}
        {planosVenda.length > 0 && <>
          <h3 className="text-base font-semibold">Planos pagos</h3>
          <ul className="flex flex-col gap-2">
            {planosVenda.map((p) => (
              <li key={p.codigo} className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-base">
                <strong className="font-semibold">{p.nome}</strong>
                <span className="tabular-nums">{preco(p.preco_centavos)} por {p.periodo_dias} dias</span>
              </li>
            ))}
          </ul>
        </>}
        <Botao href={LINK_PLANOS} variante="secundario" tamanho="toque">
          Ver planos e preços
        </Botao>
      </div>
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 [overflow-wrap:anywhere]">
      <header className="flex flex-wrap items-center justify-between gap-x-2">
        <h1 className="text-titulo font-semibold text-beringela">Ajuda</h1>
        <a href="#titulo-contato" className={classesBotao("texto", false, "", "toque")}>
          <LifeBuoy className="size-4 shrink-0" aria-hidden /> Falar com a equipe
        </a>
      </header>

      {ajuda.perguntas.length > 0 ? (
        <ListaAjuda categorias={ajuda.categorias} perguntas={ajuda.perguntas} extras={precosHoje ? { destaques: precosHoje } : {}} />
      ) : (
        <Vazio titulo="A Ajuda está indisponível" texto="Tente carregar as perguntas de novo ou fale com a equipe." icone={<LifeBuoy />}>
          <Botao href="/ajuda" variante="secundario" tamanho="toque">
            Tentar de novo
          </Botao>
        </Vazio>
      )}

      <ContatoSuporte contato={contato} />

      <nav aria-label="Textos do Mercado da Região" className="flex flex-wrap gap-2">
        <Botao href={LINK_TERMOS} variante="secundario" tamanho="toque" icone={<FileText />}>Termos de uso</Botao>
        <Botao href={LINK_PRIVACIDADE} variante="secundario" tamanho="toque" icone={<FileText />}>Política de privacidade</Botao>
      </nav>
    </main>
  );
}
