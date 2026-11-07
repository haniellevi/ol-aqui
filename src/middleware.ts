import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Login pelo Clerk. Áreas que exigem conta: painel e Radar. O resto do site é público.
const exigeLogin = createRouteMatcher(["/admin(.*)", "/radar(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (exigeLogin(req)) await auth.protect();
});

export const config = {
  matcher: [
    // tudo, menos arquivos estáticos e internos do Next
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
