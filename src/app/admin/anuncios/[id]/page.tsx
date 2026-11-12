import { notFound } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { Aviso, Cartao, Titulo, estiloCampo } from "@/components/admin/ui";
import { ROTULO_ANUNCIO } from "@/components/conta/situacao-anuncios";
import { ConversaAtendimento } from "@/components/atendimento/conversa";
import { exigirTela } from "@/lib/admin/equipe";
import { ehUuid, linkAnuncio, preco } from "@/lib/formato";
import { LINK_ADMIN_ANUNCIOS, linkAdminAnuncio } from "@/lib/rotas";
import type { MeuAnuncio } from "@/lib/tipos";
import { abrirAtendimento, administrarAnuncio, delegarAtendimento } from "./actions";
import { Badge } from "@/components/ui/badge";
import { eSuperAdmin } from "@/lib/admin/auth";
import { lerHistorico } from "@/lib/dados/historico";
import { ListaHistorico } from "@/components/conta/lista-historico";
import { FormApagarDeVez, FormLixeiraAnuncio } from "../../lixeira/formularios";

export const metadata = { title: "Gerenciar anúncio" };

type AnuncioAdmin = Pick<MeuAnuncio, "id" | "slug" | "titulo" | "cidade" | "status" | "descricao" | "fotos" | "motivo_analise" | "preco_centavos" | "atualizado_em"> & {
  excluido_com_loja: boolean;
  vitrines_lojas: { nome: string; dono_id: string } | null;
};

export default async function GerenciarAnuncioPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ antes?: string; erro?: string; ok?: string }>;
}) {
  const { supabase, userId } = await exigirTela("anuncios");
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { antes, erro, ok } = await searchParams;
  const { data: a, error } = await supabase.from("anuncios")
    .select("id, slug, titulo, cidade, status, descricao, fotos, motivo_analise, preco_centavos, atualizado_em, excluido_com_loja, vitrines_lojas(nome, dono_id)")
    .eq("id", id).maybeSingle<AnuncioAdmin>();
  if (error) return <Aviso tipo="erro">Não foi possível carregar o anúncio. Atualize a página para tentar novamente.</Aviso>;
  if (!a) notFound();
  const vendedor = a.vitrines_lojas;
  const outro = !!vendedor && vendedor.dono_id !== userId;
  const [conversaR, contatoR] = outro ? await Promise.all([
    supabase.from("atendimentos_anuncio").select("id, aki_ativo, aki_versao, aguarda_equipe").eq("anuncio_id", id).eq("anunciante_id", vendedor.dono_id).maybeSingle(),
    supabase.rpc("admin_whatsapp_anunciante", { p_anuncio: id }),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  const conversa = conversaR.data;
  // Etapa P5a: lixeira e "apagar de vez" só para o super admin; histórico para quem é administrador.
  const [superAdmin, historico] = await Promise.all([eSuperAdmin(supabase), lerHistorico({ anuncio: id }, 20).catch(() => null)]);
  const whatsapp = typeof contatoR.data === "string" ? contatoR.data.replace(/\D/g, "") : "";
  const titulo = a.titulo?.trim() || "Anúncio sem título";
  const situacao = ROTULO_ANUNCIO[a.status];
  const emAnalise = a.status === "em_analise";
  const podeRevisar = a.status === "ativo" || a.status === "pausado";
  const fotos = a.fotos.filter(src => /^https:\/\//i.test(src));

  return <div className="space-y-4">
    <Botao href={LINK_ADMIN_ANUNCIOS} variante="texto" prefetch={false}>Voltar aos anúncios</Botao>
    <Titulo sub={[vendedor?.nome, a.cidade].filter(Boolean).join(" · ")}>{titulo}</Titulo>
    {(erro || ok) && <Aviso tipo={erro ? "erro" : "ok"}>{erro || ok}</Aviso>}
    <Cartao className="space-y-3 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={situacao.cor}>{situacao.texto}</Badge>
        <p className="font-semibold">{preco(a.preco_centavos)}</p>
        {(a.status === "ativo" || a.status === "vendido") && <Botao href={linkAnuncio(id, a.titulo, a.slug)} variante="texto" prefetch={false}>Ver no site</Botao>}
      </div>
      {a.descricao && <p className="whitespace-pre-wrap text-sm">{a.descricao}</p>}
      {fotos.length > 0 && <ul aria-label="Fotos do anúncio" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fotos.map((src, i) => <li key={`${i}-${src}`}>
          <a href={src} target="_blank" rel="noopener noreferrer" className="block rounded-card focus-visible:outline-2 focus-visible:outline-laranja-escuro">
            {/* As fotos são do Storage e abrir o link permite inspecionar a resolução original. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Ampliar foto ${i + 1}`} className="aspect-square w-full rounded-card bg-fundo object-cover" loading="lazy" referrerPolicy="no-referrer" />
          </a>
        </li>)}
      </ul>}
      {a.motivo_analise && <p className="text-sm text-aviso">{a.motivo_analise}</p>}
    </Cartao>

    {(emAnalise || podeRevisar) && <Cartao aria-labelledby="acao-anuncio" className="space-y-3">
      <h2 id="acao-anuncio" className="text-lg text-beringela">Gerenciar situação</h2>
      {emAnalise && <form action={administrarAnuncio.bind(null, id, a.status, a.atualizado_em, "aprovar")}>
        <Botao type="submit">Aprovar e colocar no ar</Botao>
      </form>}
      <form action={administrarAnuncio.bind(null, id, a.status, a.atualizado_em, emAnalise ? "recusar" : "revisar")} className="space-y-2">
        <label htmlFor="motivo-administracao" className="block text-rotulo font-medium">Motivo da decisão</label>
        <textarea id="motivo-administracao" name="motivo" rows={2} required minLength={3} maxLength={280}
          className={`${estiloCampo} h-auto min-h-20 py-2`} aria-describedby="ajuda-motivo-administracao" />
        <p id="ajuda-motivo-administracao" className="text-sm text-texto-suave">O anunciante pode ler o motivo em Meus anúncios.</p>
        <Botao type="submit" variante="secundario">
          {emAnalise ? "Recusar anúncio" : a.status === "ativo" ? "Retirar do ar para revisão" : "Enviar para nova revisão"}
        </Botao>
      </form>
    </Cartao>}

    {outro && <Cartao aria-labelledby="contato-anunciante" className="space-y-3">
      <h2 id="contato-anunciante" className="text-lg text-beringela">Contato com o anunciante</h2>
      <div className="flex flex-wrap gap-2">
        {/^[1-9]\d{9,14}$/.test(whatsapp) && <Botao href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" variante="whatsapp">Abrir WhatsApp</Botao>}
        {conversaR.error ? <Aviso tipo="erro">Não foi possível carregar a conversa. Atualize a página.</Aviso> : conversa ?
          <form action={delegarAtendimento.bind(null, id, conversa.id, !conversa.aki_ativo, conversa.aki_versao)}>
            <Botao type="submit" variante="secundario">{conversa.aki_ativo ? "Retomar atendimento" : "Delegar ao Merc"}</Botao>
          </form> : <form action={abrirAtendimento.bind(null, id)}>
            <Botao type="submit" variante="secundario">Abrir conversa privada</Botao>
          </form>}
      </div>
      {contatoR.error && <p className="text-sm text-perigo">Não foi possível consultar o WhatsApp do anunciante.</p>}
      {conversa && <p className="text-sm text-texto-suave">
        {conversa.aki_ativo ? "O Merc pode responder perguntas de suporte enviadas a ele nesta conversa." : "A equipe está responsável por esta conversa."}
        {conversa.aguarda_equipe && " Há mensagem aguardando atendimento."}
      </p>}
    </Cartao>}
    {superAdmin && !a.excluido_com_loja && <Cartao aria-labelledby="acoes-super-admin" className="space-y-3">
      <h2 id="acoes-super-admin" className="text-lg text-beringela">Ações do super admin</h2>
      {a.status === "excluido"
        ? <FormApagarDeVez tipo="anuncio" id={id} nome={titulo} />
        : <FormLixeiraAnuncio id={id} />}
    </Cartao>}

    {historico && <section aria-labelledby="historico-anuncio" className="space-y-3">
      <h2 id="historico-anuncio" className="text-lg text-beringela">Histórico</h2>
      <ListaHistorico linhas={historico} vazio="As mudanças aparecem aqui depois que o anúncio for publicado." />
    </section>}
    {conversa && <ConversaAtendimento id={conversa.id} caminho={linkAdminAnuncio(id)} antes={antes} equipe aki={conversa.aki_ativo} />}
  </div>;
}
