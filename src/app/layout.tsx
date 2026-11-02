import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { ThemeSelector } from "./theme-selector";
import { THEME_COOKIE, parseTheme } from "./themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mariage pilote ATLAS",
  description: "Page d'un mariage fictif, produit pilote ATLAS v0.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="fr" data-theme={theme}>
      <body>
        <header className="site-header">
          <nav aria-label="Navigation principale">
            <Link href="/">Programme</Link>
            <Link href="/quizz">Quizz</Link>
            <Link href="/cagnotte">Cagnotte</Link>
          </nav>
          <ThemeSelector initial={theme} />
        </header>
        {children}
      </body>
    </html>
  );
}
