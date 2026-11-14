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
import { RevisaoLojaIa } from "@/components/anunciar/revisao-loja-ia";
import { Aviso } from "@/components/conta/aviso";
import { Botao } from "@/components/ui/botao";
import { testeGratis } from "../../_dados";
import { salvarColeta, prepararEnvio, finalizarEnvio, iniciarRascunho, salvarRevisao, retentarFonte, confirmarLojaIa, gerarCapa, revogarWhatsapp } from "./actions";

export const metadata: Metadata = { title: "Criar loja com IA" };
export const dynamic = "force-dynamic";

function consultaWhatsappDisponivel(): boolean {
  const endereco = process.env.LOJA_IA_PERFIL_URL?.trim();
  if (!endereco || (process.env.LOJA_IA_PERFIL_SEGREDO?.trim().length ?? 0) < 32 || (process.env.LOJA_IA_CALLBACK_SEGREDO?.trim().length ?? 0) < 32) return false;
  try { const url = new URL(endereco); return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash; }
  catch { return false; }
}

export default async function CriarLojaIa() {
  const db = await createClient();
  const [conta, consulta, convite, cnpj, whatsapp] = await Promise.all([
    meuPerfilEVitrine(), db.rpc("loja_ia_obter"), db.rpc("loja_ia_piloto_autorizado"), db.rpc("loja_ia_cnpj_disponivel"), db.rpc("whatsapp_confirmado"),
  ]);
  if (!conta) redirect("/quero-vender/loja");
  if (consulta.error || convite.error) return <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6"><Aviso tipo="erro">Não foi possível carregar o rascunho. Tente novamente.</Aviso><Botao href="/minha-conta/lojas">Voltar para Minhas lojas</Botao></main>;
  const rascunho = consulta.data as RascunhoLoja | null;
  if (!rascunho) redirect("/quero-vender/loja");
  const [cidades, teste] = await Promise.all([listarCidades(conta.perfil.microrregiao_id), testeGratis(conta.perfil.microrregiao_id)]);
  const avisoTeste = (conta.plano?.preco_centavos ?? 0) > 0 ? null : teste.dias
    ? `O teste grátis de ${teste.dias} dias começa assim que você criar a loja.${teste.limite != null ? ` Nele você pode ter até ${teste.limite} anúncios no ar.` : ""}`
    : "O teste grátis começa assim que você criar a loja.";
  if (rascunho.estado === "coleta") {
    if (convite.data !== true) return <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6"><Aviso tipo="erro">A coleta está indisponível para esta conta.</Aviso><Botao href="/quero-vender/loja?manual=1">Preencher manualmente</Botao></main>;
    return <main className="mx-auto w-full max-w-xl px-4 py-6"><FormLojaIa rascunho={rascunho} cidades={cidades} whatsappConfirmado={!whatsapp.error && whatsapp.data === true} whatsappConsultaDisponivel={consultaWhatsappDisponivel()} cnpjDisponivel={!cnpj.error && cnpj.data === true} salvar={salvarColeta} prepararEnvio={prepararEnvio} finalizarEnvio={finalizarEnvio} iniciar={iniciarRascunho} /></main>;
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
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">{(rascunho.entrada.consultarWhatsapp || rascunho.entrada.avisarWhatsapp) && <form action={revogarWhatsapp.bind(null, rascunho.id)} className="flex flex-col gap-2 rounded-card bg-fundo p-3"><p className="text-sm text-texto-suave">Você pode retirar a autorização de consulta e o pedido de aviso pelo WhatsApp.</p><Botao type="submit" variante="secundario">Retirar autorização do WhatsApp</Botao></form>}<RevisaoLojaIa rascunho={rascunho} cidades={cidades} whatsappInicial={conta.perfil.whatsapp ? telefone(conta.perfil.whatsapp) : ""} avisoTeste={avisoTeste} salvar={salvarRevisao} retentar={retentarFonte} confirmar={confirmarLojaIa} imagens={imagens} linkMaps={montarLinkMaps({ nome: rascunho.campos.nome.valor ?? rascunho.entrada.nome, cidade: rascunho.campos.cidade.valor ?? rascunho.entrada.cidade, endereco: rascunho.campos.endereco.valor ?? undefined })} gerarCapa={gerarCapa} /></main>;
}
