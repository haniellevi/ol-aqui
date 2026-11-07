import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Login pelo Clerk. Áreas que exigem conta: painel, Radar e a área da conta
// (anunciar, quero vender, minha conta, destacar). O resto do site é público.
const exigeLogin = createRouteMatcher([
  "/admin(.*)",
  "/radar(.*)",
  "/anunciar(.*)",
  "/quero-vender(.*)",
  "/minha-conta(.*)",
  "/destacar(.*)",
]);

export default clerkMiddleware(
  async (auth, req) => {
    if (exigeLogin(req)) await auth.protect();
  },
  // padrão no código: a integração do Clerk não cria NEXT_PUBLIC_CLERK_SIGN_IN_URL
  { signInUrl: "/entrar", signUpUrl: "/entrar" },
);

export const config = {
  matcher: [
    // tudo, menos arquivos estáticos e internos do Next
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
