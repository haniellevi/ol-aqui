import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { minhaVitrineCompleta, vitrineNovaAtiva } from "@/lib/dados/vitrine-completa";
import { minhaMelhoriaIA } from "@/lib/dados/melhoria-ia";
import { LINK_LOJA_DESEMPENHO } from "@/lib/rotas";
import { urlPasso } from "@/components/anunciar/passos";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { PedirMelhoria, SugestaoMelhoria } from "@/components/conta/melhoria-ia";

export const metadata: Metadata = { title: "Melhorar com IA" };
export const dynamic = "force-dynamic";

// Vitrine com IA, etapa 5b: sugestão de título e descrição e dicas de foto para um produto da loja.
// Só com a vitrine nova e a melhoria com IA ligadas (vitrine_ia.ativa e vitrine_ia.melhoria_ativa).

type Props = { params: Promise<{ id: string }> };

export default async function PaginaMelhorarComIA({ params }: Props) {
  const v = await minhaVitrineCompleta();
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Melhorar com IA" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para receber sugestões da IA nos seus produtos.">
          <Botao href="/quero-vender/loja" larguraTotal>Abrir minha loja</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  if (!(await vitrineNovaAtiva(v.microrregiao_id).catch(() => false))) notFound();
  const { id } = await params;
  const t = await minhaMelhoriaIA(id);
  if (!t || !t.ativa) notFound();
  const restam = Math.max(t.limite - t.usadas, 0);

  return (
    <PaginaConta>
      <TopoConta
        titulo="Melhorar com IA"
        texto={t.anuncio.titulo}
        voltar={LINK_LOJA_DESEMPENHO}
        textoVoltar="Desempenho da loja"
      />
      {t.anuncio.status !== "ativo" ? (
        <Aviso tipo="atencao">Este produto não está no ar. Só dá para melhorar produtos no ar.</Aviso>
      ) : t.melhoria?.estado === "pronta" ? (
        <SugestaoMelhoria m={t.melhoria} anuncioId={t.anuncio.id} fotos={t.anuncio.fotos} />
      ) : t.melhoria?.estado === "processando" ? (
        <p role="status" className="flex items-center gap-2 rounded-card bg-cartao p-4 text-base shadow-1">
          <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          A IA está preparando a sugestão. Atualize a página em alguns segundos.
        </p>
      ) : (
        <PedirMelhoria anuncioId={t.anuncio.id} restam={restam} limite={t.limite} />
      )}
      <Botao href={urlPasso("detalhes", t.anuncio.id, true)} variante="texto">Editar o anúncio por conta própria</Botao>
    </PaginaConta>
  );
}
