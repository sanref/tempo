"use client";

import { ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { agregarEjercicioARutina, crearRutina } from "@/app/actions";
import type { RutinaParaAgregar } from "@/db/queries";

/**
 * Añadir este ejercicio a un día de una rutina propia, desde la biblioteca.
 *
 * Va en todas las tarjetas, no solo en las propias ni en las del admin: ver
 * un ejercicio ya da derecho a meterlo en tu rutina, sea del catálogo común o
 * tuyo. A diferencia del editor, esto escribe en el acto — no hay nada más
 * que decidir que a qué día, así que forzar un "Guardar" aparte sería un paso
 * de más. El resto (series, reps, carga) se ajusta después, en el editor.
 *
 * Pinta el icono a secas, sin envoltorio: comparte línea con "Mi nombre",
 * "Editar" y "Borrar", y la fila la dibuja la tarjeta.
 */
export function AgregarARutina({
  ejercicio,
  rutinas,
}: {
  ejercicio: { id: string; nombre: string };
  rutinas: RutinaParaAgregar[];
}) {
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [routineId, setRoutineId] = useState("");
  const [dayId, setDayId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const rutina = rutinas.find((r) => r.id === routineId);

  const elegirRutina = (r: RutinaParaAgregar) => {
    setRoutineId(r.id);
    // Con un solo día no hace falta preguntar cuál.
    setDayId(r.dias.length === 1 ? r.dias[0].id : "");
  };

  const cerrar = () => {
    setAbierto(false);
    setRoutineId("");
    setDayId("");
    setFallo(null);
    setHecho(null);
  };

  const enviar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      const r = await agregarEjercicioARutina(dayId, ejercicio.id);
      setHecho(r.dia);
      // El contador de "está en N rutinas" del propio ejercicio depende de
      // esto — igual que hacen editar y borrar tras escribir.
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo añadir.");
    } finally {
      setEnviando(false);
    }
  };

  const etiqueta = `Añadir ${ejercicio.nombre} a una rutina`;

  return (
    <>
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setAbierto(true)}
        title={etiqueta}
        aria-label={etiqueta}
      >
        <ListPlus size={16} />
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
            aria-label={`Añadir ${ejercicio.nombre} a una rutina`}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">Añadir «{ejercicio.nombre}» a…</div>

            {hecho ? (
              <>
                <p className="dialog-body">Se añadió a {hecho}.</p>
                <div className="dialog-actions">
                  <button className="btn btn-primary" onClick={cerrar}>
                    Listo
                  </button>
                </div>
              </>
            ) : rutinas.length === 0 ? (
              <>
                <p className="dialog-body">Todavía no tenés ninguna rutina.</p>
                {/* POST: crear una rutina inserta filas, no puede colgar de un
                    GET que Next prefetchea al pasar el ratón por encima. */}
                <form action={crearRutina}>
                  <button className="btn btn-primary" type="submit">
                    + Nueva rutina
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Rutina</label>
                  <div className="picker-list">
                    {rutinas.map((r) => {
                      const vacia = r.dias.length === 0;
                      const yaEnElUnico = r.dias.length === 1 && r.dias[0].ejercicios.includes(ejercicio.id);
                      return (
                        <button
                          className="picker-row"
                          key={r.id}
                          disabled={vacia || yaEnElUnico}
                          aria-pressed={routineId === r.id}
                          data-elegida={routineId === r.id}
                          onClick={() => elegirRutina(r)}
                        >
                          <span>
                            <strong>{r.nombre}</strong>
                            <small className="text-muted">
                              {vacia
                                ? "Sin días — no se puede añadir"
                                : yaEnElUnico
                                  ? "Ya está en su único día"
                                  : `${r.dias.length} ${r.dias.length === 1 ? "día" : "días"}`}
                            </small>
                          </span>
                          <span className="picker-estado">{routineId === r.id ? "Elegida" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {rutina && rutina.dias.length > 1 && (
                  <div className="field">
                    <label>Día</label>
                    <div className="picker-list">
                      {rutina.dias.map((d) => {
                        const puesto = d.ejercicios.includes(ejercicio.id);
                        return (
                          <button
                            className="picker-row"
                            key={d.id}
                            disabled={puesto}
                            aria-pressed={dayId === d.id}
                            data-elegida={dayId === d.id}
                            onClick={() => setDayId(d.id)}
                          >
                            <span>
                              <strong>
                                {d.codigo} · {d.nombre}
                              </strong>
                            </span>
                            <span className="picker-estado">
                              {puesto ? "Ya está" : dayId === d.id ? "Elegido" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {fallo && <p className="editor-error">{fallo}</p>}

                <div className="dialog-actions">
                  <button className="btn btn-secondary" onClick={cerrar}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void enviar()}
                    disabled={enviando || !routineId || !dayId}
                  >
                    {enviando ? "Añadiendo…" : "Añadir"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
