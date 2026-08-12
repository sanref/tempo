import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import "./design-system.css";
import "./app.css";

import { SiteHeader } from "@/components/site-header";
import { SwRegister } from "@/components/sw-register";
import { TabBar } from "@/components/tab-bar";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tempo — planes de entrenamiento",
  description: "Sigue tu plan, registra tus series y mira cómo progresas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tempo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f3f2f2",
  width: "device-width",
  initialScale: 1,
  // El registro de series usa inputs numéricos pequeños; sin esto iOS hace
  // zoom en cada foco y saca al usuario del sitio.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>
        <SiteHeader />
        <div className="app-shell">{children}</div>
        <TabBar />
        <SwRegister />
      </body>
    </html>
  );
}
