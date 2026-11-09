import type { Metadata } from "next";
import { ConcluirDadosClerk } from "@/components/conta/concluir-dados-clerk";
import { UserProfile } from "@clerk/nextjs";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Confirmar ou trocar celular" };

// Foto e celular são do Clerk (login por celular). A tela pronta do Clerk cuida da troca
// e da confirmação por código; o webhook do Clerk atualiza o perfil no banco.
export default function PaginaFotoCelular() {
  return (
    <PaginaConta larga>
      <TopoConta titulo="Confirmar ou trocar celular" voltar="/minha-conta/dados" textoVoltar="Editar perfil"
        texto="Adicione seu celular brasileiro com +55 e DDD, confirme o código recebido e defina esse número como principal. Depois conclua abaixo para atualizar o contato no OL-AKI." />
      <p className="rounded-card bg-laranja-claro p-4 text-sm">A confirmação usa o código enviado pelo serviço de acesso. Ela não confirma uma conta no WhatsApp. Mantenha uma forma de entrar na conta enquanto troca o número.</p>
      <div className="flex justify-center [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-cardBox]:max-w-none">
        <UserProfile routing="path" path="/minha-conta/dados/foto" fallback={<p role="status" className="p-5">Carregando os dados de acesso...</p>}
          appearance={{ elements: { cardBox: "shadow-none border border-borda", formButtonPrimary: "min-h-12", formFieldInput: "min-h-12 text-base" } }} />
      </div>
      <ConcluirDadosClerk />
    </PaginaConta>
  );
}
