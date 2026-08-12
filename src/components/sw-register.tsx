"use client";

import { useEffect } from "react";

/**
 * Registra `public/sw.js`. No pinta nada.
 *
 * Solo en producción: en `next dev` un service worker se pelea con el HMR y
 * sirve chunks viejos. Y como el registro sobrevive al cambio de modo, en dev
 * además se desregistra lo que haya quedado de un `next start` anterior —
 * si no, arrancás el dev server y ves la app de la última build sin entender
 * por qué tus cambios no aparecen.
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    // Después del load: instalar el SW descarga el shell entero y no debe
    // competir por ancho de banda con la primera pintura.
    const registrar = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app funciona igual, solo pierde el offline.
      });
    };

    if (document.readyState === "complete") {
      registrar();
      return;
    }

    window.addEventListener("load", registrar);
    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
