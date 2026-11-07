import type { Metadata } from "next";
import { UserProfile } from "@clerk/nextjs";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Foto e celular" };

// Foto e celular são do Clerk (login por celular). A tela pronta do Clerk cuida da troca
// e da confirmação por código; o webhook do Clerk atualiza o perfil no banco.
export default function PaginaFotoCelular() {
  return (
    <PaginaConta larga>
      <TopoConta titulo="Foto e celular" voltar="/minha-conta/dados" textoVoltar="Meus dados" />
      <div className="flex justify-center [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-cardBox]:max-w-none">
        <UserProfile routing="path" path="/minha-conta/dados/foto" />
      </div>
    </PaginaConta>
  );
}
