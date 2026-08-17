"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { desvincularAlumno } from "@/app/actions";

/**
 * El entrenador suelta a un alumno.
 *
 * Se avisa de las dos consecuencias que no son obvias: el plan sigue vivo (no
 * se le quita nada) y volver a tenerlo exige otro código, porque `coach_id`
 * solo lo escribe un canje.
 */
export function DesvincularAlumno({
  alumno,
  tienePlan,
}: {
  alumno: { id: string; nombre: string };
  tienePlan: boolean;
}) {
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(false);
    setFallo(null);
  };

  const desvincular = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await desvincularAlumno(alumno.id);
      cerrar();
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo desvincular.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setAbierto(true)}>
        Desvincular
      </button>

      {abierto && (
        <div className="dialog-backdrop" onClick={cerrar}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar desvinculación"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Desvincular a {alumno.nombre}?</div>
            <p className="dialog-body">
              Sale de tu panel y dejás de poder asignarle rutinas.{" "}
              {tienePlan
                ? "Su plan actual sigue en marcha y su historial no se toca: solo se corta el vínculo."
                : "Su historial no se toca."}{" "}
              Para volver a tenerlo como alumno tendrá que canjear un código nuevo.
            </p>

            {fallo && <p className="editor-error">{fallo}</p>}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={cerrar}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void desvincular()}
                disabled={enviando}
              >
                {enviando ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
