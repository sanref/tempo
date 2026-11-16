"use client";

import { ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";

import {
  aplicarPieOcultoDom,
  type BeforeInstallPromptEvent,
  EVENTO_INSTALABLE,
  type EscalaTexto,
  guardarEscalaTexto,
  guardarPieOculto,
  leerEscalaTexto,
  leerPieOculto,
} from "@/lib/preferencias-ui";

const OPCIONES_TEXTO: { valor: EscalaTexto; etiqueta: string }[] = [
  { valor: "normal", etiqueta: "Normal" },
  { valor: "grande", etiqueta: "Grande" },
  { valor: "muy-grande", etiqueta: "Muy grande" },
];

function detectarStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}

function detectarIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iDispositivo = /iPad|iPhone|iPod/.test(ua);
  // iPadOS de escritorio se anuncia como MacIntel pero tiene pantalla táctil.
  const iPadEscritorio =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iDispositivo || iPadEscritorio;
}

/**
 * Pie de las pantallas con sesión: versión de la app más un bloque plegable
 * con el tamaño de texto y la instalación de la PWA.
 *
 * Minimizado se reduce a una única línea menuda (`Tempo X.Y.Z · Texto y app`)
 * del mismo alto que tenía la versión sola, para no estorbar.
 */
export function PieApp({ version }: { version: string }) {
  const [escala, setEscala] = useState<EscalaTexto>("normal");
  const [oculto, setOculto] = useState(false);
  const [promptInstalacion, setPromptInstalacion] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [esIos, setEsIos] = useState(false);
  const [instalada, setInstalada] = useState(true);
  const [ayudaIos, setAyudaIos] = useState(false);

  // Sincroniza el estado de React con lo que el script del <head> ya aplicó al
  // DOM antes de la primera pintura.
  useLayoutEffect(() => {
    setEscala(leerEscalaTexto());
    const estabaOculto = leerPieOculto();
    setOculto(estabaOculto);
    aplicarPieOcultoDom(estabaOculto);
  }, []);

  useEffect(() => {
    const actualizarInstalacion = () => {
      const standalone = detectarStandalone();
      setInstalada(standalone);
      setEsIos(!standalone && detectarIos());
      setPromptInstalacion(standalone ? null : (window.__tempoInstallPrompt ?? null));
      if (standalone) setAyudaIos(false);
    };

    actualizarInstalacion();

    const mql = window.matchMedia("(display-mode: standalone)");
    window.addEventListener(EVENTO_INSTALABLE, actualizarInstalacion);
    mql.addEventListener("change", actualizarInstalacion);

    return () => {
      window.removeEventListener(EVENTO_INSTALABLE, actualizarInstalacion);
      mql.removeEventListener("change", actualizarInstalacion);
    };
  }, []);

  function cambiarEscala(nueva: EscalaTexto) {
    setEscala(nueva);
    guardarEscalaTexto(nueva);
  }

  function cambiarOculto(nuevo: boolean) {
    setOculto(nuevo);
    guardarPieOculto(nuevo);
    if (nuevo) setAyudaIos(false);
  }

  async function instalar() {
    if (promptInstalacion) {
      await promptInstalacion.prompt();
      const decision = await promptInstalacion.userChoice;
      if (decision.outcome === "accepted") {
        window.__tempoInstallPrompt = null;
        setPromptInstalacion(null);
      }
      return;
    }

    if (esIos) {
      setAyudaIos((v) => !v);
    }
  }

  const mostrarBotonInstalar = !instalada && (promptInstalacion !== null || esIos);

  return (
    <footer className="version-app">
      <div id="pie-opciones" className="pie-panel">
        <div className="pie-controles">
          <div className="pie-grupo">
            <span className="pie-etiqueta">Texto</span>
            <div className="seg" role="radiogroup" aria-label="Tamaño del texto">
              {OPCIONES_TEXTO.map((op) => (
                <label className="seg-opt" key={op.valor}>
                  <input
                    type="radio"
                    name="escala-texto"
                    value={op.valor}
                    checked={escala === op.valor}
                    onChange={() => cambiarEscala(op.valor)}
                  />
                  {op.etiqueta}
                </label>
              ))}
            </div>
          </div>

          {mostrarBotonInstalar && (
            <button
              type="button"
              className="btn btn-secondary pie-instalar"
              onClick={() => void instalar()}
              aria-expanded={esIos && !promptInstalacion ? ayudaIos : undefined}
            >
              <Download size={14} aria-hidden="true" />
              Instalar app
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost pie-minimizar"
            onClick={() => cambiarOculto(true)}
            aria-label="Minimizar opciones del pie de página"
          >
            <ChevronDown size={14} aria-hidden="true" />
            Minimizar
          </button>
        </div>

        {ayudaIos && !promptInstalacion && (
          <p className="aviso-comun pie-ayuda-ios">
            En Safari, tocá el botón <strong>Compartir</strong> y elegí{" "}
            <strong>Añadir a pantalla de inicio</strong> para abrir Tempo como aplicación.
          </p>
        )}
      </div>

      <div className="pie-resumen">
        <span>Tempo {version}</span>
        <button
          type="button"
          className="pie-mostrar"
          aria-expanded={!oculto}
          aria-controls="pie-opciones"
          onClick={() => cambiarOculto(false)}
        >
          <span aria-hidden="true">·</span>
          <SlidersHorizontal size={12} aria-hidden="true" />
          Texto y app
        </button>
      </div>
    </footer>
  );
}
