"use client";

import { GripVertical, Minus, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { guardarRutina } from "@/app/actions";
import { ExerciseForm } from "@/components/exercise-form";
import { kg, seriesEnReps, tramosReps } from "@/lib/format";
import type { DiaConEjercicios } from "@/db/queries";

/** Prescripción editable de un ejercicio dentro del día. */
type Presc = { series: number; tipo: "reps" | "tiempo"; reps: string; carga: string };

/**
 * Lo mismo que trae la base, más lo que el editor necesita para llevar la
 * cuenta de lo que todavía no existe allí.
 *
 * `nuevo` marca lo que hay que insertar al guardar; `notas` vive aquí porque
 * el editor las edita por día y `DiaConEjercicios` no las trae.
 */
type EjercicioEditable = DiaConEjercicios["ejercicios"][number] & { nuevo?: boolean };
type DiaEditable = Omit<DiaConEjercicios, "ejercicios"> & {
  ejercicios: EjercicioEditable[];
  nuevo?: boolean;
  notas: string;
};

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Del registro de la base al campo único de carga que ve el entrenador. */
const cargaInicial = (e: DiaConEjercicios["ejercicios"][number]) =>
  e.cargaTexto ?? (e.cargaKg && Number(e.cargaKg) > 0 ? kg(e.cargaKg) : "");

const prescDe = (e: DiaConEjercicios["ejercicios"][number]): Presc => ({
  series: e.series,
  tipo: e.tipo,
  reps: e.reps,
  carga: cargaInicial(e),
});

const DESCANSOS = [60, 90, 120] as const;

const PROGRESIONES = [
  { valor: "lineal", label: "Lineal · +2,5 kg al completar" },
  { valor: "doble", label: "Doble progresión por rango" },
  { valor: "manual", label: "Manual" },
] as const;

/** Fila del catálogo que pinta el selector. */
export type EjercicioCatalogo = {
  id: string;
  nombre: string;
  grupo: string;
  equipo: string;
  esMio?: boolean;
};

/**
 * ── Editor de rutinas ──────────────────────────────────────────────────────
 *
 * Nada se escribe hasta "Guardar". Añadir y quitar ejercicios, crear y borrar
 * días, reordenar y ajustar: todo se acumula en `dias` y sale de una vez, en
 * una transacción. Así "Cancelar" significa lo que dice.
 *
 * Antes la estructura iba al servidor en el acto, porque hacían falta los ids
 * que genera la base. Ya no: los pone el cliente con `crypto.randomUUID()` —
 * las columnas son uuid y aceptan uno hecho — y el editor puede indexar su
 * estado local sin haber hablado con el servidor.
 *
 * Todo el estado editable vive dentro de `dias`, no en variables sueltas por
 * día: si el descanso o el orden colgaran del día abierto, cambiar de pestaña
 * y volver los perdería.
 */
export function EditorClient({
  routineId,
  nombreInicial,
  dias: diasIniciales,
  alumnos,
  catalogo: catalogoInicial,
  grupos,
  equipos,
}: {
  routineId: string;
  nombreInicial: string;
  dias: DiaConEjercicios[];
  alumnos: string;
  catalogo: EjercicioCatalogo[];
  grupos: string[];
  equipos: string[];
}) {
  const router = useRouter();
  const [guardando, iniciarGuardado] = useTransition();

  const [dias, setDias] = useState<DiaEditable[]>(() =>
    diasIniciales.map((d) => ({ ...d, notas: "" })),
  );
  const [nombre, setNombre] = useState(nombreInicial);
  const [i, setI] = useState(0);
  const dia = dias[i];

  const [presc, setPresc] = useState<Record<string, Presc>>(
    Object.fromEntries(diasIniciales.flatMap((d) => d.ejercicios.map((e) => [e.id, prescDe(e)]))),
  );
  // Lo que hay que borrar en el servidor al guardar. Lo que se añadió y se
  // quitó sin llegar a guardarse no entra: nunca existió allí.
  const [borradosEj, setBorradosEj] = useState<string[]>([]);
  const [borradosDias, setBorradosDias] = useState<string[]>([]);
  const [arrastrado, setArrastrado] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState(catalogoInicial);
  const [modal, setModal] = useState<null | "biblioteca" | "borrar-dia">(null);
  const [modoPicker, setModoPicker] = useState<"lista" | "nuevo">("lista");
  const [busqueda, setBusqueda] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);

  /** Hay algo sin guardar: lo usa el aviso al salir. */
  const sucio =
    borradosEj.length > 0 ||
    borradosDias.length > 0 ||
    dias.some((d) => d.nuevo || d.ejercicios.some((e) => e.nuevo));

  /** Reemplaza el día abierto. Todo el estado editable vive dentro de él. */
  const cambiarDia = (cambio: Partial<DiaEditable>) =>
    setDias((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...cambio } : d)));

  // ── Estructura (local hasta "Guardar") ───────────────────────────────────

  const agregarEjercicio = (fuente: EjercicioCatalogo) => {
    if (!dia) return;
    const nuevo: EjercicioEditable = {
      id: crypto.randomUUID(),
      exerciseId: fuente.id,
      orden: dia.ejercicios.length,
      nombre: fuente.nombre,
      equipo: fuente.equipo,
      series: 3,
      tipo: "reps",
      reps: "10",
      cargaKg: null,
      cargaTexto: null,
      descansoS: null,
      nuevo: true,
    };
    cambiarDia({ ejercicios: [...dia.ejercicios, nuevo] });
    setPresc((p) => ({ ...p, [nuevo.id]: prescDe(nuevo) }));
  };

  const eliminarEjercicio = (id: string) => {
    if (!dia) return;
    const e = dia.ejercicios.find((x) => x.id === id);
    if (e && !e.nuevo) setBorradosEj((b) => [...b, id]);
    cambiarDia({ ejercicios: dia.ejercicios.filter((x) => x.id !== id) });
  };

  const agregarDia = () => {
    const usados = new Set(dias.map((d) => d.codigo));
    const codigo = [...LETRAS].find((l) => !usados.has(l)) ?? `D${dias.length + 1}`;
    const nombreDia = `Día ${dias.length + 1}`;

    const nuevo: DiaEditable = {
      id: crypto.randomUUID(),
      codigo,
      nombre: nombreDia,
      titulo: `Día ${codigo} — ${nombreDia}`,
      subtitulo: "",
      duracionMin: null,
      descansoDefectoS: 90,
      progresion: "lineal",
      notas: "",
      ejercicios: [],
      nuevo: true,
    };
    setDias([...dias, nuevo]);
    setI(dias.length);
  };

  const eliminarDia = () => {
    if (!dia) return;
    if (!dia.nuevo) setBorradosDias((b) => [...b, dia.id]);
    const lista = dias.filter((d) => d.id !== dia.id);
    setDias(lista);
    setI(Math.max(0, Math.min(i, lista.length - 1)));
    setModal(null);
  };

  // ── Orden ────────────────────────────────────────────────────────────────
  // El orden ES el orden del array; no hay una lista de ids aparte que pueda
  // desincronizarse de los ejercicios.

  const mover = (id: string, delta: number) => {
    if (!dia) return;
    const from = dia.ejercicios.findIndex((e) => e.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= dia.ejercicios.length) return;
    const copia = [...dia.ejercicios];
    copia.splice(to, 0, ...copia.splice(from, 1));
    cambiarDia({ ejercicios: copia });
  };

  const soltarSobre = (id: string) => {
    if (!dia || !arrastrado || arrastrado === id) return;
    const copia = dia.ejercicios.filter((e) => e.id !== arrastrado);
    const movido = dia.ejercicios.find((e) => e.id === arrastrado);
    if (movido) copia.splice(copia.findIndex((e) => e.id === id), 0, movido);
    cambiarDia({ ejercicios: copia });
    setArrastrado(null);
  };

  const guardar = () => {
    setFallo(null);
    iniciarGuardado(async () => {
      try {
        await guardarRutina({
          routineId,
          nombreRutina: nombre,
          diasBorrados: borradosDias,
          ejerciciosBorrados: borradosEj,
          dias: dias.map((d) => ({
            id: d.id,
            nuevo: Boolean(d.nuevo),
            codigo: d.codigo,
            nombre: d.nombre,
            titulo: d.titulo,
            subtitulo: d.subtitulo,
            descansoDefectoS: d.descansoDefectoS,
            progresion: d.progresion,
            notas: d.notas,
            ejercicios: d.ejercicios.map((e) => {
              const p = presc[e.id] ?? prescDe(e);
              return {
                id: e.id,
                nuevo: Boolean(e.nuevo),
                exerciseId: e.exerciseId,
                series: p.series,
                tipo: p.tipo,
                reps: p.reps,
                carga: p.carga,
              };
            }),
          })),
        });
        router.push(`/rutinas/${routineId}`);
      } catch (e) {
        setFallo(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  /** "Cancelar" ya no escribió nada: solo hay que avisar de lo que se pierde. */
  const cancelar = () => {
    if (sucio && !window.confirm("Se van a descartar los cambios sin guardar. ¿Salir?")) return;
    router.push(`/rutinas/${routineId}`);
  };

  /** Cambio puntual de la prescripción de un ejercicio. */
  const ajustar = (id: string, cambio: Partial<Presc>) =>
    setPresc((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { series: 3, tipo: "reps", reps: "10", carga: "" }), ...cambio },
    }));

  /**
   * El texto de reps, y con él el contador de series si describe varias.
   *
   * Escribir "15/12/10/10" pone el contador en 4 solo. Es lo que hace que la
   * sintaxis se explique al usarla: no hay que saberla de antemano, se ve el
   * efecto. Un valor único no toca el contador — "10" con 4 series sigue
   * siendo 4×10.
   */
  const ajustarReps = (id: string, texto: string) => {
    const tramos = tramosReps(texto).length;
    ajustar(id, tramos > 1 ? { reps: texto, series: seriesEnReps(texto) } : { reps: texto });
  };

  // ── Derivados ────────────────────────────────────────────────────────────

  const lista = dia?.ejercicios ?? [];

  const yaEnElDia = useMemo(
    () => new Set(dia?.ejercicios.map((e) => e.exerciseId) ?? []),
    [dia],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((e) =>
      `${e.nombre} ${e.grupo} ${e.equipo}`.toLowerCase().includes(q),
    );
  }, [busqueda, catalogo]);

  const cerrarModal = () => {
    setModal(null);
    setModoPicker("lista");
    setBusqueda("");
  };

  return (
    <div>
      <div className="editor-head">
        <div>
          <div className="eyebrow">Editando rutina</div>
          <input
            className="input input--title"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre de la rutina"
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={cancelar}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {fallo && <p className="editor-error">{fallo}</p>}

      <div className="day-tabs">
        {dias.map((d, idx) => (
          <button
            key={d.id}
            className="day-tab"
            data-active={idx === i}
            onClick={() => setI(idx)}
          >
            {d.codigo} · {d.nombre}
          </button>
        ))}
        <button className="day-tab" onClick={agregarDia}>
          + Día
        </button>
      </div>

      {!dia ? (
        <p className="empty">
          Esta rutina no tiene días. Añadí uno con «+ Día» o{" "}
          <Link href={`/rutinas/${routineId}`}>volvé al detalle</Link>.
        </p>
      ) : (
        <div className="editor-grid">
          <section>
            <h6>{dia.titulo}</h6>

            {lista.length === 0 && (
              <p className="text-muted" style={{ fontSize: 13 }}>
                Este día todavía no tiene ejercicios.
              </p>
            )}

            {lista.map((e) => (
              <div
                className="editor-row"
                key={e.id}
                draggable
                onDragStart={() => setArrastrado(e.id)}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={() => soltarSobre(e.id)}
                style={{ opacity: arrastrado === e.id ? 0.5 : 1 }}
              >
                {/* Reordenación por ratón y por teclado: el asa es un botón real
                    y responde a ↑/↓, no solo a drag & drop. */}
                <button
                  className="drag-handle"
                  aria-label={`Mover ${e.nombre}. Usá las flechas arriba y abajo.`}
                  onKeyDown={(ev) => {
                    if (ev.key === "ArrowUp") { ev.preventDefault(); mover(e.id, -1); }
                    if (ev.key === "ArrowDown") { ev.preventDefault(); mover(e.id, 1); }
                  }}
                  style={{ border: 0, background: "transparent", padding: 0 }}
                >
                  <GripVertical size={16} />
                </button>

                <div>
                  <strong>{e.nombre}</strong>

                  {/* La prescripción se edita aquí mismo. Sale con "Guardar",
                      como el resto de ajustes. */}
                  <div className="editor-presc">
                    <div className="seg">
                      {(["reps", "tiempo"] as const).map((t) => (
                        <label className="seg-opt" key={t}>
                          <input
                            type="radio"
                            name={`tipo-${e.id}`}
                            checked={(presc[e.id]?.tipo ?? e.tipo) === t}
                            onChange={() =>
                              ajustar(e.id, {
                                tipo: t,
                                // El texto de reps deja de tener sentido al
                                // cambiar de tipo: se propone uno del tipo nuevo.
                                reps: t === "tiempo" ? "45 s" : "10",
                              })
                            }
                          />
                          <span>{t === "reps" ? "Reps" : "Tiempo"}</span>
                        </label>
                      ))}
                    </div>

                    <input
                      className="input"
                      value={presc[e.id]?.reps ?? e.reps}
                      onChange={(ev) => ajustarReps(e.id, ev.target.value)}
                      placeholder={
                        (presc[e.id]?.tipo ?? e.tipo) === "tiempo"
                          ? "45 s · 45 s/30 s"
                          : "10 · 8-12 · 15/12/10/10"
                      }
                      aria-label={
                        (presc[e.id]?.tipo ?? e.tipo) === "tiempo"
                          ? `Tiempo por serie de ${e.nombre}`
                          : `Repeticiones de ${e.nombre}`
                      }
                    />

                    <input
                      className="input"
                      value={presc[e.id]?.carga ?? cargaInicial(e)}
                      onChange={(ev) => ajustar(e.id, { carga: ev.target.value })}
                      placeholder="kg"
                      aria-label={`Carga de ${e.nombre}`}
                    />
                  </div>
                </div>

                <div className="editor-actions">
                  <div className="stepper">
                    <button
                      aria-label={`Quitar una serie de ${e.nombre}`}
                      onClick={() =>
                        ajustar(e.id, {
                          series: Math.max(1, (presc[e.id]?.series ?? e.series) - 1),
                        })
                      }
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span>{presc[e.id]?.series ?? e.series}</span>
                    <button
                      aria-label={`Añadir una serie a ${e.nombre}`}
                      onClick={() =>
                        ajustar(e.id, {
                          series: Math.min(8, (presc[e.id]?.series ?? e.series) + 1),
                        })
                      }
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>

                  <button
                    className="row-remove"
                    aria-label={`Quitar ${e.nombre} del día`}
                    onClick={() => eliminarEjercicio(e.id)}
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn btn-secondary btn-block"
              onClick={() => setModal("biblioteca")}
            >
              <Plus size={14} strokeWidth={3} /> Añadir ejercicio desde la biblioteca
            </button>
          </section>

          <section>
            <h6>Ajustes del día</h6>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Descanso por defecto</label>
              <div className="seg">
                {DESCANSOS.map((d) => (
                  <label className="seg-opt" key={d}>
                    <input
                      type="radio"
                      name="rest"
                      checked={dia.descansoDefectoS === d}
                      onChange={() => cambiarDia({ descansoDefectoS: d })}
                    />
                    <span>{d} s</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Progresión</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PROGRESIONES.map((p) => (
                  <label className="radio" key={p.valor}>
                    <input
                      type="radio"
                      name="prog"
                      checked={dia.progresion === p.valor}
                      onChange={() => cambiarDia({ progresion: p.valor })}
                    />
                    <span className="dot" />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Notas para el alumno</label>
              <textarea
                className="input"
                value={dia.notas}
                onChange={(e) => cambiarDia({ notas: e.target.value })}
                placeholder="Controla la bajada en 3 s y para a un dedo del pecho."
              />
            </div>

            <div className="field">
              <label>Asignar a</label>
              <input className="input" defaultValue={alumnos} readOnly />
            </div>

            <button
              className="btn btn-ghost"
              style={{ marginTop: 16 }}
              onClick={() => setModal("borrar-dia")}
            >
              <Trash2 size={14} /> Borrar este día
            </button>
          </section>
        </div>
      )}

      {modal === "biblioteca" && dia && (
        <div
          className="dialog-backdrop"
          onClick={cerrarModal}
          onKeyDown={(ev) => ev.key === "Escape" && cerrarModal()}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Biblioteca de ejercicios"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">
              {modoPicker === "nuevo" ? "Nuevo ejercicio" : `Añadir a ${dia.titulo}`}
            </div>

            {modoPicker === "nuevo" ? (
              /* El alta vive dentro del mismo diálogo, no en otro encima: se
                 llega buscando algo que no está, y al crearlo entra directo en
                 el día, que es lo que se venía a hacer. */
              <ExerciseForm
                grupos={grupos}
                equipos={equipos}
                nombreInicial={busqueda.trim()}
                textoEnvio="Crear y añadir"
                onCancelar={() => setModoPicker("lista")}
                onGuardado={(creado) => {
                  setCatalogo((c) => [...c, creado]);
                  setModoPicker("lista");
                  setBusqueda("");
                  agregarEjercicio(creado);
                }}
              />
            ) : (
              <>
                <input
                  className="input"
                  type="search"
                  autoFocus
                  value={busqueda}
                  onChange={(ev) => setBusqueda(ev.target.value)}
                  placeholder="Buscar ejercicio, grupo o equipamiento"
                  aria-label="Buscar en la biblioteca"
                />

                <div className="picker-list">
                  {filtrados.length === 0 ? (
                    <p className="empty">Ningún ejercicio coincide con la búsqueda.</p>
                  ) : (
                    filtrados.map((e) => {
                      const puesto = yaEnElDia.has(e.id);
                      return (
                        <button
                          className="picker-row"
                          key={e.id}
                          disabled={puesto}
                          onClick={() => agregarEjercicio(e)}
                        >
                          <span>
                            <strong>{e.nombre}</strong>
                            <small className="text-muted">
                              {e.grupo} · {e.equipo}
                              {e.esMio && " · mío"}
                            </small>
                          </span>
                          <span className="picker-estado">{puesto ? "Añadido" : "Añadir"}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => setModoPicker("nuevo")}
                >
                  <Plus size={14} strokeWidth={3} />
                  {busqueda.trim() ? `Crear «${busqueda.trim()}»` : "Crear un ejercicio nuevo"}
                </button>

                {/* Se queda abierto tras cada alta: un día son varios ejercicios
                    y abrir y cerrar el diálogo cinco veces seguidas es absurdo. */}
                <div className="dialog-actions">
                  <button className="btn btn-secondary" onClick={cerrarModal}>
                    Listo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {modal === "borrar-dia" && dia && (
        <div className="dialog-backdrop" onClick={cerrarModal}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar borrado"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Borrar {dia.titulo}?</div>
            <p className="dialog-body">
              {dia.ejercicios.length === 0
                ? "El día está vacío."
                : `Se van a quitar sus ${dia.ejercicios.length} ejercicios de la rutina.`}{" "}
              Los entrenamientos ya registrados no se tocan.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={cerrarModal}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={eliminarDia}
              >
                Borrar día
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
