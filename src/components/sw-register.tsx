"use client";

import { useEffect, useLayoutEffect } from "react";

import {
  aplicarEscalaTextoDom,
  aplicarPieOcultoDom,
  leerEscalaTexto,
  leerPieOculto,
} from "@/lib/preferencias-ui";

/**
 * Registra `public/sw.js` y reaplica los atributos de `<html>` tras el remount
 * del Strict Mode en desarrollo. No pinta nada.
 *
 * Solo registra el SW en producción: en `next dev` un service worker se pelea
 * con el HMR y sirve chunks viejos. Y como el registro sobrevive al cambio de
 * modo, en dev además se desregistra lo que haya quedado de un `next start`
 * anterior — si no, arrancás el dev server y ves la app de la última build sin
 * entender por qué tus cambios no aparecen.
 */
export function SwRegister() {
  // En producción el script inline del <head> ya dejó puestos los atributos
  // antes de pintar; en desarrollo Strict Mode remonta <html> y los limpia.
  useLayoutEffect(() => {
    aplicarEscalaTextoDom(leerEscalaTexto());
    aplicarPieOcultoDom(leerPieOculto());
  }, []);

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
    // competir por ancho de banda con la primera pintura. `updateViaCache:
    // "none"` fuerza a comprobar `/sw.js` contra red sin pasar por caché HTTP.
    const registrar = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
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
