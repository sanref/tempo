import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import "./design-system.css";
import "./app.css";

import { SwRegister } from "@/components/sw-register";

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

/**
 * Solo el documento: fuentes, estilos y el registro del service worker.
 *
 * Aquí no se lee la sesión a propósito. Tocar cookies en el layout raíz vuelve
 * dinámica *toda* la app, y con ella /offline — que es la pantalla que el
 * service worker sirve cuando no hay red, y no puede depender ni de la base ni
 * de que el servidor conteste. La cabecera y las pestañas viven en el layout
 * del grupo (app), que sí exige sesión.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
