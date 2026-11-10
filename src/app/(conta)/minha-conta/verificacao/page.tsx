import { createClient } from "@/lib/supabase/server";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { FormVerificacaoVendedor } from "@/components/conta/form-verificacao-vendedor";
import { Botao } from "@/components/ui/botao";
import { LINK_VERIFICACAO_VENDEDOR, MOTIVOS_VERIFICACAO_PF } from "@/lib/verificacao-vendedor";

export const metadata = { title: "Verificação de vendedor", robots: { index: false } };

export default async function VerificacaoVendedorPage() {
  const conta = await meuPerfilEVitrine(true);
  const db = await createClient();
  const pf = conta?.vitrine?.tipo === "pf";
  const estado = pf ? await db.rpc("minha_verificacao_vendedor_pf").maybeSingle<{
    status: string;
    motivo: keyof typeof MOTIVOS_VERIFICACAO_PF | null;
  }>() : null;
  const verificada = estado?.data?.status === "aprovada";
  const pendente = estado?.data?.status === "pendente";
  const motivo = estado?.data?.motivo ? MOTIVOS_VERIFICACAO_PF[estado.data.motivo] : null;
  const celular = conta?.perfil.whatsapp && conta.perfil.whatsapp_verificado_em;

  return (
    <PaginaConta>
      <TopoConta titulo="Verificação de vendedor" texto="Envie seus comprovantes de identidade e endereço para a equipe do OLAKI." />
      <section className="space-y-3 rounded-card bg-cartao p-5 shadow-1">
        {!pf ? <p>O envio está disponível para vendedores individuais cadastrados.</p>
          : estado?.error || !estado?.data ? <p role="alert">Não foi possível consultar sua verificação. Recarregue a página.</p>
            : verificada ? <p className="font-semibold text-verde-escuro">Identidade verificada.</p>
              : pendente ? <p role="status">Documentos em análise. Acompanhe o resultado nesta página.</p>
                : !celular ? <Botao href={`/confirmar-celular?destino=${encodeURIComponent(LINK_VERIFICACAO_VENDEDOR)}`}>Confirmar WhatsApp</Botao>
                  : <>
                    {motivo && <p className="text-sm font-semibold text-perigo">A equipe pediu um novo envio. {motivo}.</p>}
                    {estado.data.status === "desatualizada" && <p>Envie novamente seus documentos para atualizar a verificação.</p>}
                    <FormVerificacaoVendedor />
                  </>}
        <p className="text-sm text-texto-suave">Apenas a equipe autorizada acessa os arquivos durante a análise. Eles são removidos da solicitação quando a equipe decide.</p>
      </section>
    </PaginaConta>
  );
}
