import type { Metadata } from "next";
import Link from "next/link";
import { FileText, LifeBuoy } from "lucide-react";
import { regiaoAtual } from "@/lib/dados/regiao";
import { ajudaCompleta, contatoEquipe, precosDestaqueAjuda } from "@/lib/dados/paginas";
import { planosPublicos } from "@/lib/dados/vitrine-completa";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { preco } from "@/lib/formato";
import { LINK_PLANOS, LINK_PRIVACIDADE, LINK_TERMOS } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
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
      <div className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h3 className="text-base font-semibold">Preços de hoje em {lugar}</h3>
        {destaques.length > 0 && (
          <ul className="flex flex-col gap-2">
            {destaques.map((d) => (
              <li key={d.slug} className="flex flex-col">
                <span className="text-base">
                  <strong className="font-semibold">{d.nome}</strong>: {d.preco_centavos > 0 ? preco(d.preco_centavos) : "grátis"} {dias(d.dias)}
                </span>
                {d.descricao && <span className="text-sm text-texto-suave">{d.descricao}</span>}
              </li>
            ))}
          </ul>
        )}
        {planosVenda.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-borda pt-3">
            {planosVenda.map((p) => (
              <li key={p.codigo} className="text-base">
                Plano <strong className="font-semibold">{p.nome}</strong>: {preco(p.preco_centavos)} a cada {p.periodo_dias} dias
              </li>
            ))}
          </ul>
        )}
        <Botao href={LINK_PLANOS} variante="secundario" larguraTotal>
          Ver planos e preços
        </Botao>
      </div>
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">Ajuda</h1>
        <p className="text-base text-texto-suave">Respostas rápidas e dicas para negociar com segurança.</p>
      </header>

      {ajuda.perguntas.length > 0 ? (
        <ListaAjuda categorias={ajuda.categorias} perguntas={ajuda.perguntas} extras={precosHoje ? { destaques: precosHoje } : {}} />
      ) : (
        <Vazio titulo="A ajuda não abriu agora." texto="Confira sua internet e tente de novo. Se precisar, fale com a equipe aqui embaixo." icone={<LifeBuoy />}>
          <Botao href="/ajuda" variante="secundario" larguraTotal>
            Tentar de novo
          </Botao>
        </Vazio>
      )}

      <ContatoSuporte contato={contato} />

      <nav aria-label="Textos do Mercado da Região" className="flex flex-col gap-1">
        <Link href={LINK_TERMOS} className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-laranja-escuro underline underline-offset-4">
          <FileText className="size-5" aria-hidden /> Termos de uso
        </Link>
        <Link href={LINK_PRIVACIDADE} className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-laranja-escuro underline underline-offset-4">
          <FileText className="size-5" aria-hidden /> Política de privacidade
        </Link>
      </nav>
    </main>
  );
}
