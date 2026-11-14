import { ArrowLeft } from "lucide-react";
import { comAssistente, tentativaAssistente } from "@/lib/assistente";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { telefone } from "@/lib/formato";
import { montarLinkMaps } from "@/lib/loja-ia/fontes";
import { urlRevisaoMaterial } from "@/lib/loja-ia/imagens";
import type { RascunhoLoja } from "@/lib/loja-ia/tipos";
import { FormLojaIa } from "@/components/anunciar/form-loja-ia";
import { LojaIaConcluida, RevisaoLojaIa } from "@/components/anunciar/revisao-loja-ia";
import { Aviso } from "@/components/conta/aviso";
import { Botao, classesBotao } from "@/components/ui/botao";
import { testeGratis } from "../../_dados";
import { salvarColeta, prepararEnvio, finalizarEnvio, iniciarRascunho, salvarRevisao, retentarFonte, confirmarLojaIa, gerarCapa, revogarWhatsapp } from "./actions";

export const metadata: Metadata = { title: "Criar loja com IA" };
export const dynamic = "force-dynamic";

async function retirarAutorizacao(id: string, assistente?: string) {
  "use server";
  const resultado = await revogarWhatsapp(id);
  redirect(comAssistente(resultado.ok ? "/quero-vender/loja/criar-com-ia" : "/quero-vender/loja/criar-com-ia?aviso=erro", assistente));
}

function consultaWhatsappDisponivel(): boolean {
  const endereco = process.env.LOJA_IA_PERFIL_URL?.trim();
  if (!endereco || (process.env.LOJA_IA_PERFIL_SEGREDO?.trim().length ?? 0) < 32 || (process.env.LOJA_IA_CALLBACK_SEGREDO?.trim().length ?? 0) < 32) return false;
  try { const url = new URL(endereco); return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash; }
  catch { return false; }
}

export default async function CriarLojaIa({ searchParams }: { searchParams: Promise<{ aviso?: string; assistente?: string }> }) {
  const { aviso, assistente: tentativa } = await searchParams;
  const assistente = tentativaAssistente(tentativa);
  const opcoes = comAssistente("/quero-vender/loja", assistente);
  const andamento = comAssistente("/quero-vender/loja/criar-com-ia", assistente);
  const voltar = <Botao href={opcoes} variante="texto" tamanho="toque" icone={<ArrowLeft />} className="-ml-3 self-start">Opções de cadastro</Botao>;
  const db = await createClient();
  const [conta, consulta, convite, cnpj, whatsapp] = await Promise.all([
    meuPerfilEVitrine(), db.rpc("loja_ia_obter"), db.rpc("loja_ia_piloto_autorizado"), db.rpc("loja_ia_cnpj_disponivel"), db.rpc("whatsapp_confirmado"),
  ]);
  if (!conta) redirect(opcoes);
  if (consulta.error || convite.error) return <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7"><Aviso tipo="erro">Não foi possível carregar o rascunho. Tente novamente.</Aviso><Botao tamanho="toque" href="/minha-conta/lojas">Voltar para Minhas lojas</Botao></main>;
  const rascunho = consulta.data as RascunhoLoja | null;
  if (!rascunho) {
    if (conta.vitrine?.tipo !== "loja") redirect(opcoes);
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-4 sm:px-6 sm:py-7">
        <LojaIaConcluida slug={conta.vitrine.slug} assistente={assistente} />
      </main>
    );
  }
  const [cidades, teste] = await Promise.all([listarCidades(conta.perfil.microrregiao_id), testeGratis(conta.perfil.microrregiao_id)]);
  const avisoTeste = (conta.plano?.preco_centavos ?? 0) > 0 ? null : teste.dias
    ? `Seu teste grátis de ${teste.dias} dias começa ao criar a loja.${teste.limite != null ? ` Até ${teste.limite} anúncios no ar.` : ""}`
    : "O teste grátis começa assim que você criar a loja.";
  if (rascunho.estado === "processando") {
    return <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7">
      {voltar}
      <h1 className="text-titulo font-semibold text-beringela">Estamos preparando seu rascunho</h1>
      {aviso === "erro" && <Aviso tipo="erro">Não foi possível retirar a autorização. Tente novamente.</Aviso>}
      <p className="text-sm text-texto-suave">Acompanhe o rascunho aqui ou em Minhas lojas.</p>
      <div className="flex flex-wrap gap-2 [&>*]:flex-1">
        <a href={andamento} className={classesBotao("primario", false, "", "toque")}>Atualizar andamento</a>
        <Botao tamanho="toque" href="/minha-conta/lojas" variante="secundario">Ir para Minhas lojas</Botao>
      </div>
      {(rascunho.entrada.consultarWhatsapp || rascunho.entrada.avisarWhatsapp) &&
        <form action={retirarAutorizacao.bind(null, rascunho.id, assistente)}>
          <Botao type="submit" variante="texto" tamanho="toque">Retirar autorização do WhatsApp</Botao>
        </form>}
    </main>;
  }
  const ids = new Set(rascunho.entrada.materiais);
  for (const campo of ["logo", "capa"] as const) {
    const dado = rascunho.campos[campo];
    if (dado?.valor) ids.add(dado.valor);
    if (dado?.sugestao?.valor) ids.add(dado.sugestao.valor);
  }
  const pares = await Promise.all([...ids].map(async id => {
    try { return [id, await urlRevisaoMaterial(rascunho.id, id)] as const; }
    catch { return null; }
  }));
  const imagens = Object.fromEntries(pares.filter((par): par is readonly [string, string] => par !== null));
  if (rascunho.estado === "coleta") {
    if (convite.data !== true) return <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7"><Aviso tipo="erro">A coleta está indisponível para esta conta.</Aviso><Botao tamanho="toque" href={comAssistente("/quero-vender/loja?manual=1", assistente)}>Preencher manualmente</Botao></main>;
    return <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-4 sm:px-6 sm:py-7">{voltar}<FormLojaIa andamento={andamento} rascunho={rascunho} cidades={cidades} imagens={imagens} whatsappConfirmado={!whatsapp.error && whatsapp.data === true} whatsappConsultaDisponivel={consultaWhatsappDisponivel()} cnpjDisponivel={!cnpj.error && cnpj.data === true} salvar={salvarColeta} prepararEnvio={prepararEnvio} finalizarEnvio={finalizarEnvio} iniciar={iniciarRascunho} /></main>;
  }
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-4 sm:px-6 sm:py-7">{voltar}<RevisaoLojaIa assistente={assistente} rascunho={rascunho} cidades={cidades} whatsappInicial={conta.perfil.whatsapp ? telefone(conta.perfil.whatsapp) : ""} avisoTeste={avisoTeste} salvar={salvarRevisao} retentar={retentarFonte} confirmar={confirmarLojaIa} imagens={imagens} linkMaps={montarLinkMaps({ nome: rascunho.campos.nome.valor ?? rascunho.entrada.nome, cidade: rascunho.campos.cidade.valor ?? rascunho.entrada.cidade, endereco: rascunho.campos.endereco.valor ?? undefined })} gerarCapa={gerarCapa} revogarWhatsapp={revogarWhatsapp} /></main>;
}
