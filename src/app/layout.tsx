import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
    <html lang="pt-BR" className={poppins.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
