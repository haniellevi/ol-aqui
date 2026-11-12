import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { minhaVitrineCompleta } from "@/lib/dados/vitrine-completa";
import { createClient } from "@/lib/supabase/server";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { FormVerificacaoLoja } from "@/components/conta/form-verificacao-loja";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { LINK_LOJA_VERIFICAR, LINK_MINHA_LOJA } from "@/lib/rotas";
import { LINK_VERIFICACAO_VENDEDOR } from "@/lib/verificacao-vendedor";
import { textoMotivoVerificacaoLoja } from "@/lib/verificacao-loja/constantes";

export const metadata: Metadata = { title: "Verificar minha loja", robots: { index: false } };

type Envio = { status: string; motivo: string | null; whatsapp_ok: boolean };

// Modo fácil: letra 18px, uma pergunta por tela (o assistente fica em FormVerificacaoLoja).
export default async function VerificarLojaPage() {
  const v = await minhaVitrineCompleta(true);
  if (!v) {
    return (
      <PaginaConta>
        <TopoConta titulo="Verificar minha loja" voltar={LINK_MINHA_LOJA} textoVoltar="Minha loja" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Com uma loja você pode pedir o selo de loja verificada.">
          <Botao href="/quero-vender/loja" tamanho="grande" larguraTotal>Abrir minha loja</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  if (v.ajudante) {
    return (
      <Moldura>
        <Aviso tipo="atencao"><span className="text-facil">Só quem criou a loja pode pedir a verificação.</span></Aviso>
      </Moldura>
    );
  }
  if (v.tipo !== "loja") redirect(LINK_VERIFICACAO_VENDEDOR);

  const db = await createClient();
  const { data, error } = await db.rpc("minha_verificacao_loja_envio").maybeSingle<Envio>();
  const envio = error ? null : data;
  if (!envio) {
    return (
      <Moldura>
        <p role="alert" className="text-facil font-semibold text-perigo">Não foi possível consultar a verificação. Recarregue a página.</p>
      </Moldura>
    );
  }

  if (envio.status === "conferindo") {
    return (
      <Moldura>
        <p role="status" className="text-facil font-semibold">Conferindo seus dados… Isso leva poucos minutos.</p>
        <p className="text-facil text-texto-suave">Volte a esta página em alguns minutos: o resultado aparece aqui.</p>
      </Moldura>
    );
  }
  if (envio.status === "equipe") {
    return (
      <Moldura>
        <p className="text-facil font-semibold">Com a equipe. Respondemos em até 1 dia útil.</p>
      </Moldura>
    );
  }
  if (envio.status === "aprovada") {
    return (
      <Moldura>
        <Aviso tipo="ok"><span className="text-facil">Loja verificada.</span></Aviso>
      </Moldura>
    );
  }

  // nao_enviada, correcao, recusada e obsoleta: a loja pode mandar (ou mandar de novo) os documentos.
  const motivo = textoMotivoVerificacaoLoja(envio.motivo);
  return (
    <Moldura>
      {motivo && (
        <Aviso tipo="atencao"><span className="text-facil">{motivo}</span></Aviso>
      )}
      {envio.whatsapp_ok ? (
        <FormVerificacaoLoja />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-facil">Para pedir a verificação, primeiro confirme o seu celular.</p>
          <Botao href={`/confirmar-celular?destino=${encodeURIComponent(LINK_LOJA_VERIFICAR)}`} tamanho="grande" larguraTotal>
            Confirmar meu celular
          </Botao>
        </div>
      )}
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <PaginaConta>
      <TopoConta titulo="Verificar minha loja" voltar={LINK_MINHA_LOJA} textoVoltar="Minha loja" />
      <section className="flex flex-col gap-4 rounded-card bg-cartao p-5 shadow-1">{children}</section>
    </PaginaConta>
  );
}
