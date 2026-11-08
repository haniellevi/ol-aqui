import Image from "next/image";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LINK_ENTRAR_PERFIL, LINK_PRIVACIDADE, LINK_TERMOS } from "@/lib/rotas";

export const metadata = { title: "Entrar" };

// Tela de login do Clerk: Google ou celular com código (configurados no painel do Clerk).
// withSignUp junta "entrar" e "criar conta" no mesmo lugar. Conta nova passa por /entrar/perfil
// (aceite dos termos e da privacidade na versão que está no ar).
export default function EntrarPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4 py-10">
      <Image src="/logo/olaki-opcao1-pin.svg" alt="OLAKI" width={200} height={101} priority />
      <SignIn path="/entrar" routing="path" withSignUp fallbackRedirectUrl="/" signUpFallbackRedirectUrl={LINK_ENTRAR_PERFIL} />
      <p className="text-center text-sm text-texto-suave">
        Ao criar sua conta, você vai ler e aceitar os{" "}
        <Link href={LINK_TERMOS} className="font-semibold text-laranja-escuro underline underline-offset-4">
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link href={LINK_PRIVACIDADE} className="font-semibold text-laranja-escuro underline underline-offset-4">
          Política de privacidade
        </Link>
        .
      </p>
    </main>
  );
}
