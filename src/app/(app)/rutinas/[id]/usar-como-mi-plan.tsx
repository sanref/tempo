"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usarComoMiPlan } from "@/app/actions";

/**
 * Activar una rutina propia como plan, sin entrenador de por medio.
 *
 * Escribe la asignación con `coach_id = NULL`, que es lo que hace que
 * /entrenar, la home y la adherencia la vean: todas leen de `assignments`.
 *
 * Pide confirmación solo cuando hay un plan vivo, porque activarla cierra el
 * anterior — que es lo único no evidente de la acción.
 */
export function UsarComoMiPlan({
  routineId,
  nombre,
  planActual,
}: {
  routineId: string;
  nombre: string;
  planActual: string | null;
}) {
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const activar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await usarComoMiPlan(routineId);
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo activar el plan.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => (planActual ? setAbierto(true) : void activar())}
        disabled={enviando}
      >
        {enviando ? "Activando…" : "Usar como mi plan"}
      </button>

      {!planActual && fallo && <p className="editor-error">{fallo}</p>}

      {abierto && (
        <div className="dialog-backdrop" onClick={() => setAbierto(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Cambiar de plan"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Usar «{nombre}» como tu plan?</div>
            <p className="dialog-body">
              Se cierra «{planActual}» y empezás «{nombre}» desde la semana 1. El historial no
              se toca.
            </p>

            {fallo && <p className="editor-error">{fallo}</p>}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => void activar()} disabled={enviando}>
                {enviando ? "Activando…" : "Usar como mi plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
