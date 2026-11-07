import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Entrar" };

// Tela de login do Clerk: Google ou celular com código (configurados no painel do Clerk).
// withSignUp junta "entrar" e "criar conta" no mesmo lugar.
export default function EntrarPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4 py-10">
      <Image src="/logo/olaki-opcao1-pin.svg" alt="OLAKI" width={200} height={70} priority />
      <SignIn path="/entrar" routing="path" withSignUp fallbackRedirectUrl="/" />
    </main>
  );
}
