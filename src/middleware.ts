import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { COOKIE_MANUTENCAO, PAGINA_MANUTENCAO, decidirManutencao, liberacaoValida, manutencaoLigada } from "@/lib/manutencao";

// Login pelo Clerk. Áreas que exigem conta: painel, Radar (menos a página que explica)
// e a área da conta (anunciar, quero vender, minha conta, destacar). O resto do site é público.
const exigeLogin = createRouteMatcher([
  "/admin(.*)",
  "/confirmar-celular(.*)",
  "/radar/(.*)",
  "/anunciar(.*)",
  "/quero-vender(.*)",
  "/minha-conta(.*)",
  "/destacar(.*)",
]);

const comClerk = clerkMiddleware(
  async (auth, req) => {
    if (exigeLogin(req)) await auth.protect();
  },
  // padrão no código: a integração do Clerk não cria NEXT_PUBLIC_CLERK_SIGN_IN_URL
  { signInUrl: "/entrar", signUpUrl: "/entrar" },
);

// Em manutenção (MANUTENCAO=1) ninguém entra nem cria perfil: a checagem vem antes do Clerk
// (nem o "handshake" do Clerk acontece). Só quem tem o cookie da equipe segue para o site.
const VOLTA_EM_S = "600";

export default async function middleware(req: NextRequest, evento: NextFetchEvent) {
  if (manutencaoLigada()) {
    const equipe = await liberacaoValida(req.cookies.get(COOKIE_MANUTENCAO)?.value, Date.now());
    const decisao = decidirManutencao(req.nextUrl.pathname, true, equipe);
    if (decisao === "livre") return NextResponse.next();
    // 503 de propósito também nos webhooks e nas rotas do pg_cron: eles tentam de novo depois.
    if (decisao === "api") {
      return NextResponse.json({ ok: false, manutencao: true }, { status: 503, headers: { "Retry-After": VOLTA_EM_S } });
    }
    if (decisao === "pagina") {
      return NextResponse.rewrite(new URL(PAGINA_MANUTENCAO, req.url), {
        status: 503,
        headers: { "Retry-After": VOLTA_EM_S, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  }
  return comClerk(req, evento);
}

export const config = {
  matcher: [
    // tudo, menos arquivos estáticos e internos do Next. A extensão precisa estar no FIM do caminho:
    // senão /loja/x.png/... pularia o middleware (e a manutenção).
    "/((?!_next/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)$).*)",
    "/(api|trpc)(.*)",
  ],
};
