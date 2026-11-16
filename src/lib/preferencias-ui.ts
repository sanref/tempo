/**
 * Preferencias locales del dispositivo (tamaño de texto y estado del pie).
 *
 * Viven en `localStorage` y no en la base a propósito: el tamaño de letra
 * depende del teléfono o monitor concreto que se tiene en la mano, y tiene que
 * funcionar incluso en `/login` y `/offline` sin sesión ni red.
 */

export type EscalaTexto = "normal" | "grande" | "muy-grande";

export const CLAVE_ESCALA_TEXTO = "tempo:escala-texto";
export const CLAVE_PIE_OCULTO = "tempo:pie-oculto";
export const EVENTO_INSTALABLE = "tempo:instalable";

export function esEscalaTexto(v: string | null): v is EscalaTexto {
  return v === "normal" || v === "grande" || v === "muy-grande";
}

export function leerEscalaTexto(): EscalaTexto {
  if (typeof window === "undefined") return "normal";
  try {
    const guardado = localStorage.getItem(CLAVE_ESCALA_TEXTO);
    return esEscalaTexto(guardado) ? guardado : "normal";
  } catch {
    return "normal";
  }
}

export function aplicarEscalaTextoDom(escala: EscalaTexto) {
  if (typeof document === "undefined") return;
  if (escala === "normal") {
    delete document.documentElement.dataset.texto;
  } else {
    document.documentElement.dataset.texto = escala;
  }
}

export function guardarEscalaTexto(escala: EscalaTexto) {
  aplicarEscalaTextoDom(escala);
  try {
    if (escala === "normal") {
      localStorage.removeItem(CLAVE_ESCALA_TEXTO);
    } else {
      localStorage.setItem(CLAVE_ESCALA_TEXTO, escala);
    }
  } catch {
    // Modo privado estricto o cuota llena: al menos queda aplicado en sesión.
  }
}

export function leerPieOculto(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLAVE_PIE_OCULTO) === "1";
  } catch {
    return false;
  }
}

export function aplicarPieOcultoDom(oculto: boolean) {
  if (typeof document === "undefined") return;
  if (oculto) {
    document.documentElement.dataset.pie = "oculto";
  } else {
    delete document.documentElement.dataset.pie;
  }
}

export function guardarPieOculto(oculto: boolean) {
  aplicarPieOcultoDom(oculto);
  try {
    if (oculto) {
      localStorage.setItem(CLAVE_PIE_OCULTO, "1");
    } else {
      localStorage.removeItem(CLAVE_PIE_OCULTO);
    }
  } catch {
    // Igual que arriba: el estado en memoria sigue funcionando.
  }
}

/**
 * Evento no estándar de Chromium para disparar el diálogo nativo de instalar
 * la PWA. Se guarda en `window.__tempoInstallPrompt` desde el script inicial
 * del `<head>` porque el navegador puede emitirlo antes de que React hidrate.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __tempoInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}
