"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { asignarRutina } from "@/app/actions";

export type RutinaAsignable = {
  id: string;
  nombre: string;
  nivel: string;
  semanas: number;
  dias: number;
};

export type AlumnoDestino = { id: string; nombre: string; plan: string };

/**
 * Asignar un plan.
 *
 * Se usa en dos sitios de la misma pantalla: el botón de la cabecera, que pide
 * elegir alumno, y el de cada fila, que ya lo trae puesto. Es el mismo diálogo
 * con el selector de alumno escondido cuando no hace falta.
 */
export function AsignarRutina({
  alumnos,
  rutinas,
  alumnoFijo,
  etiqueta,
  variante = "btn-primary",
}: {
  alumnos: AlumnoDestino[];
  rutinas: RutinaAsignable[];
  alumnoFijo?: AlumnoDestino;
  etiqueta: string;
  variante?: "btn-primary" | "btn-ghost";
}) {
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [clientId, setClientId] = useState(alumnoFijo?.id ?? alumnos[0]?.id ?? "");
  const [routineId, setRoutineId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const alumno = alumnoFijo ?? alumnos.find((a) => a.id === clientId);
  const elegida = rutinas.find((r) => r.id === routineId);

  const cerrar = () => {
    setAbierto(false);
    setRoutineId("");
    setFallo(null);
  };

  const enviar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await asignarRutina(routineId, clientId);
      cerrar();
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo asignar.");
    } finally {
      setEnviando(false);
    }
  };

  if (alumnos.length === 0) return null;

  return (
    <>
      <button className={`btn ${variante}`} onClick={() => setAbierto(true)}>
        {etiqueta}
      </button>

      {abierto && (
        <div
          className="dialog-backdrop"
          onClick={cerrar}
          onKeyDown={(ev) => ev.key === "Escape" && cerrar()}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Asignar rutina"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">
              {alumnoFijo ? `Asignar plan a ${alumnoFijo.nombre}` : "Asignar rutina"}
            </div>

            {!alumnoFijo && (
              <div className="field">
                <label htmlFor="asignar-alumno">Alumno</label>
                <div className="picker-list" id="asignar-alumno">
                  {alumnos.map((a) => (
                    <button
                      className="picker-row"
                      key={a.id}
                      aria-pressed={clientId === a.id}
                      data-elegida={clientId === a.id}
                      onClick={() => setClientId(a.id)}
                    >
                      <span>
                        <strong>{a.nombre}</strong>
                        <small className="text-muted">{a.plan}</small>
                      </span>
                      <span className="picker-estado">{clientId === a.id ? "Elegido" : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <label>Rutina</label>
              <div className="picker-list">
                {rutinas.map((r) => {
                  const vacia = r.dias === 0;
                  return (
                    <button
                      className="picker-row"
                      key={r.id}
                      disabled={vacia}
                      aria-pressed={routineId === r.id}
                      data-elegida={routineId === r.id}
                      onClick={() => setRoutineId(r.id)}
                    >
                      <span>
                        <strong>{r.nombre}</strong>
                        <small className="text-muted">
                          {vacia
                            ? "Sin días — no se puede asignar"
                            : `${r.dias} ${r.dias === 1 ? "día" : "días"} · ${r.semanas} sem · ${r.nivel}`}
                        </small>
                      </span>
                      <span className="picker-estado">{routineId === r.id ? "Elegida" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* El plan anterior se cierra solo; decirlo antes evita la sorpresa. */}
            {alumno && elegida && (
              <p className="dialog-body">
                {alumno.plan === "Sin plan"
                  ? `${alumno.nombre} empezará «${elegida.nombre}» desde la semana 1.`
                  : `Se cierra «${alumno.plan}» y ${alumno.nombre} empieza «${elegida.nombre}» desde la semana 1. El historial no se toca.`}
              </p>
            )}

            {fallo && <p className="editor-error">{fallo}</p>}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={cerrar}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void enviar()}
                disabled={enviando || !routineId || !clientId}
              >
                {enviando ? "Asignando…" : "Asignar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
