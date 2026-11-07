import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://olaki.com.br"),
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
        variables: {
          colorPrimary: "#ff6a13",
          colorPrimaryForeground: "#4b1248", // contraste acessível (texto beringela no laranja)
          colorText: "#4b1248",
          fontFamily: "var(--font-poppins), system-ui, sans-serif",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html lang="pt-BR" className={poppins.variable}>
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
