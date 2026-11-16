import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import "./design-system.css";
import "./app.css";

import { SwRegister } from "@/components/sw-register";
import {
  CLAVE_ESCALA_TEXTO,
  CLAVE_PIE_OCULTO,
  EVENTO_INSTALABLE,
} from "@/lib/preferencias-ui";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Tempo",
  title: "Tempo — planes de entrenamiento",
  description: "Sigue tu plan, registra tus series y mira cómo progresas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tempo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f2f2",
  width: "device-width",
  initialScale: 1,
  // El registro de series usa inputs numéricos pequeños; sin esto iOS hace
  // zoom en cada foco y saca al usuario del sitio.
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * Corre de forma síncrona antes de la primera pintura:
 *   1. Aplica la escala de texto y si el pie estaba minimizado, sin parpadeo.
 *   2. Captura `beforeinstallprompt` aunque el navegador lo dispare antes de
 *      que hidrate el componente del pie.
 */
const SCRIPT_INICIAL = `(function(){try{var d=document.documentElement;var t=localStorage.getItem(${JSON.stringify(CLAVE_ESCALA_TEXTO)});if(t==="grande"||t==="muy-grande")d.dataset.texto=t;if(localStorage.getItem(${JSON.stringify(CLAVE_PIE_OCULTO)})==="1")d.dataset.pie="oculto"}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__tempoInstallPrompt=e;window.dispatchEvent(new Event(${JSON.stringify(EVENTO_INSTALABLE)}))});window.addEventListener("appinstalled",function(){window.__tempoInstallPrompt=null;window.dispatchEvent(new Event(${JSON.stringify(EVENTO_INSTALABLE)}))})})()`;

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
    <html lang="es" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_INICIAL }} />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
