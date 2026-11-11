import type { Metadata } from "next";
import { ConcluirDadosClerk } from "@/components/conta/concluir-dados-clerk";
import { UserProfile } from "@clerk/nextjs";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Dados de acesso" };

// Preferências da conta e formas de acesso continuam disponíveis no Clerk.
export default function PaginaFotoCelular() {
  return (
    <PaginaConta larga>
      <TopoConta titulo="Dados de acesso" voltar="/minha-conta/dados" textoVoltar="Editar perfil"
        texto="Gerencie sua foto e as formas de entrar na conta. Para confirmar o WhatsApp de contato, volte a Editar perfil." />
      <div className="flex justify-center [&_.cl-cardBox]:w-full [&_.cl-cardBox]:max-w-none [&_.cl-rootBox]:w-full">
        <UserProfile routing="path" path="/minha-conta/dados/foto" fallback={<p role="status" className="p-5">Carregando os dados de acesso...</p>}
          appearance={{ elements: { cardBox: "shadow-none border border-borda", formButtonPrimary: "min-h-10", formFieldInput: "min-h-10 text-base" } }} />
      </div>
      <ConcluirDadosClerk />
    </PaginaConta>
  );
}
