import Image from "next/image";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LINK_ENTRAR_PERFIL, LINK_PRIVACIDADE, LINK_TERMOS } from "@/lib/rotas";
import { caminhoInterno } from "@/lib/caminho-seguro";

export const metadata = { title: "Entrar" };

// Tela de login do Clerk: Google ou celular com código (configurados no painel do Clerk).
// withSignUp junta "entrar" e "criar conta" no mesmo lugar. Conta nova passa por /completar-perfil
// (aceite dos termos e da privacidade na versão que está no ar) e depois volta para onde estava.
// "Force" porque quase toda entrada chega com redirect_url (auth.protect, anúncio, planos, Merc), e
// com redirect_url o Clerk ignoraria o "Fallback".

// A marca já aparece acima do cartão: sem logo repetido dentro dele, sem subtítulo que só repete
// os botões, sem sombra e com títulos menores. Os valores de cor e fonte vêm do ClerkProvider.
const APARENCIA_LOGIN = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "1px solid var(--color-borda)" },
    card: { boxShadow: "none", padding: "1.5rem 1.25rem", gap: "1.25rem" },
    logoBox: { display: "none" },
    headerSubtitle: { display: "none" },
    headerTitle: { fontSize: "1.125rem", fontWeight: 600 },
    socialButtonsBlockButton: { minHeight: "2.75rem" },
    socialButtonsBlockButtonText: { fontSize: "0.875rem", fontWeight: 600 },
    dividerText: { fontSize: "0.8125rem" },
    formFieldLabel: { fontSize: "0.875rem", fontWeight: 600 },
    formButtonPrimary: { minHeight: "2.75rem", fontSize: "0.875rem" },
    footer: { background: "transparent", fontSize: "0.8125rem" },
  },
};

/** redirect_url pode vir como endereço completo (auth.protect manda assim): fica só o caminho. */
function voltarPara(v: string | string[] | undefined): string {
  const t = Array.isArray(v) ? v[0] : v;
  if (!t) return "/";
  let caminho: string | null = null;
  try {
    const u = new URL(t, "https://olaki.invalid");
    caminho = caminhoInterno(u.pathname + u.search + u.hash);
  } catch {
    caminho = null;
  }
  return caminho && !caminho.startsWith("/entrar") && !caminho.startsWith(LINK_ENTRAR_PERFIL) ? caminho : "/";
}

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const destino = voltarPara((await searchParams).redirect_url);
  const depoisDeCriar = destino === "/" ? LINK_ENTRAR_PERFIL : `${LINK_ENTRAR_PERFIL}?redirect_url=${encodeURIComponent(destino)}`;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-4 py-8">
      <Image src="/logo/mercado-da-regiao-logo.svg" alt="Mercado da Região, aqui a sua cidade aparece" width={152} height={73} priority />
      <p className="max-w-xs text-center text-sm text-texto-suave">
        Vai criar uma conta? Use pelo menos 8 caracteres e escolha uma senha que você não usa em outros sites.
      </p>
      <SignIn
        path="/entrar"
        routing="path"
        withSignUp
        forceRedirectUrl={depoisDeCriar}
        signUpForceRedirectUrl={depoisDeCriar}
        appearance={APARENCIA_LOGIN}
      />
      <p className="max-w-xs text-center text-xs leading-relaxed text-texto-suave">
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
