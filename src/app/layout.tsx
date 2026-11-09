import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import { SITE } from "@/lib/formato";
import { AvisoSemInternet } from "@/components/paginas/aviso-sem-internet";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "OLAKI · olha aqui o que você procura", template: "%s · OLAKI" },
  description: "Shopping digital e classificados da sua região. Compre, venda e peça no Radar de Negócios.",
};

export const viewport: Viewport = { themeColor: "#ff6a13", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={ptBR}
      signInUrl="/entrar"
      signUpUrl="/entrar"
      appearance={{
        // Mesmos valores dos tokens de globals.css (o Clerk não lê as classes do Tailwind).
        variables: {
          colorPrimary: "#ff6a13",
          colorPrimaryForeground: "#4b1248", // contraste acessível (texto beringela no laranja)
          colorText: "#4b1248",
          colorMutedForeground: "#5e5266", // texto-suave
          colorDanger: "#b91c1c", // perigo
          colorSuccess: "#0e7a3d", // verde-escuro
          colorWarning: "#b45309", // aviso
          fontFamily: "var(--font-poppins), system-ui, sans-serif",
          // Campo com 16px (evita o zoom do iPhone) e nada menor que 13px
          fontSize: { xs: "0.8125rem", sm: "0.875rem", md: "1rem", lg: "1.25rem", xl: "1.5rem" },
          // A Poppins só é carregada em 400, 600 e 700
          fontWeight: { normal: 400, medium: 600, semibold: 600, bold: 700 },
          borderRadius: "0.75rem",
        },
      }}
    >
      <html lang="pt-BR" className={poppins.variable}>
        <body className="font-sans antialiased">
          {children}
          <AvisoSemInternet />
        </body>
      </html>
    </ClerkProvider>
  );
}
