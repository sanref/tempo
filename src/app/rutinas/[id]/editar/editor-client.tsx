"use client";

import { GripVertical, Minus, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  anadirEjercicio,
  borrarDia,
  crearDia,
  guardarDia,
  quitarEjercicio,
  reordenarEjercicios,
} from "@/app/actions";
import { ExerciseForm } from "@/components/exercise-form";
import { kg } from "@/lib/format";
import type { DiaConEjercicios } from "@/db/queries";

/** Prescripción editable de un ejercicio dentro del día. */
type Presc = { series: number; tipo: "reps" | "tiempo"; reps: string; carga: string };

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
 * Dos velocidades a propósito:
 *
 *   · Estructura (añadir y quitar ejercicios, crear y borrar días) va al
 *     servidor en el acto. Necesita los ids que genera la base y son cambios
 *     que el usuario entiende como definitivos.
 *   · Ajustes (nombre, orden, series, descanso, progresión, notas) se editan
 *     en local y se mandan con "Guardar".
 *
 * Por eso `dias` vive en estado: tras una mutación de estructura el editor se
 * actualiza con lo que devuelve la acción, sin recargar la página y sin perder
 * lo que hubiera a medio ajustar.
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

  const [dias, setDias] = useState(diasIniciales);
  const [nombre, setNombre] = useState(nombreInicial);
  const [i, setI] = useState(0);
  const dia = dias[i];

  const [orden, setOrden] = useState<string[]>(diasIniciales[0]?.ejercicios.map((e) => e.id) ?? []);
  const [presc, setPresc] = useState<Record<string, Presc>>(
    Object.fromEntries(diasIniciales.flatMap((d) => d.ejercicios.map((e) => [e.id, prescDe(e)]))),
  );
  const [descanso, setDescanso] = useState(diasIniciales[0]?.descansoDefectoS ?? 90);
  const [progresion, setProgresion] = useState<"lineal" | "doble" | "manual">(
    diasIniciales[0]?.progresion ?? "lineal",
  );
  const [notas, setNotas] = useState("");
  const [arrastrado, setArrastrado] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState(catalogoInicial);
  const [modal, setModal] = useState<null | "biblioteca" | "borrar-dia">(null);
  const [modoPicker, setModoPicker] = useState<"lista" | "nuevo">("lista");
  const [busqueda, setBusqueda] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  /** Envoltorio de las mutaciones de estructura: bloquea y cuenta el fallo. */
  const mutar = async (fn: () => Promise<void>) => {
    setProcesando(true);
    setFallo(null);
    try {
      await fn();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo aplicar el cambio.");
    } finally {
      setProcesando(false);
    }
  };

  /** Coloca el editor sobre un día: su orden y sus ajustes. */
  const abrirDia = (idx: number, lista = dias) => {
    const d = lista[idx];
    setI(idx);
    setOrden(d?.ejercicios.map((e) => e.id) ?? []);
    setDescanso(d?.descansoDefectoS ?? 90);
    setProgresion(d?.progresion ?? "lineal");
    setNotas("");
  };

  // ── Estructura ───────────────────────────────────────────────────────────

  const agregarEjercicio = (exerciseId: string) =>
    mutar(async () => {
      if (!dia) return;
      const nuevo = await anadirEjercicio(dia.id, exerciseId);
      setDias((ds) =>
        ds.map((d) => (d.id === dia.id ? { ...d, ejercicios: [...d.ejercicios, nuevo] } : d)),
      );
      setOrden((o) => [...o, nuevo.id]);
      setPresc((p) => ({ ...p, [nuevo.id]: prescDe(nuevo) }));
    });

  const eliminarEjercicio = (id: string) =>
    mutar(async () => {
      if (!dia) return;
      await quitarEjercicio(id);
      setDias((ds) =>
        ds.map((d) =>
          d.id === dia.id ? { ...d, ejercicios: d.ejercicios.filter((e) => e.id !== id) } : d,
        ),
      );
      setOrden((o) => o.filter((x) => x !== id));
    });

  const agregarDia = () =>
    mutar(async () => {
      const nuevo = await crearDia(routineId);
      const lista = [...dias, nuevo];
      setDias(lista);
      abrirDia(lista.length - 1, lista);
    });

  const eliminarDia = () =>
    mutar(async () => {
      if (!dia) return;
      await borrarDia(dia.id);
      const lista = dias.filter((d) => d.id !== dia.id);
      setDias(lista);
      abrirDia(Math.max(0, Math.min(i, lista.length - 1)), lista);
      setModal(null);
    });

  // ── Orden ────────────────────────────────────────────────────────────────

  const mover = (id: string, delta: number) => {
    setOrden((o) => {
      const from = o.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= o.length) return o;
      const copia = [...o];
      copia.splice(to, 0, ...copia.splice(from, 1));
      return copia;
    });
  };

  const soltarSobre = (id: string) => {
    if (!arrastrado || arrastrado === id) return;
    setOrden((o) => {
      const copia = o.filter((x) => x !== arrastrado);
      copia.splice(o.indexOf(id), 0, arrastrado);
      return copia;
    });
    setArrastrado(null);
  };

  const guardar = () => {
    iniciarGuardado(async () => {
      if (dia) await reordenarEjercicios(dia.id, orden);
      await guardarDia({
        routineId,
        routineDayId: dia?.id,
        nombreRutina: nombre,
        descansoDefectoS: descanso,
        progresion,
        notas,
        series: orden.map((id) => {
          const p = presc[id] ?? { series: 3, tipo: "reps" as const, reps: "10", carga: "" };
          return { id, series: p.series, tipo: p.tipo, reps: p.reps, carga: p.carga };
        }),
      });
    });
  };

  /** Cambio puntual de la prescripción de un ejercicio. */
  const ajustar = (id: string, cambio: Partial<Presc>) =>
    setPresc((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { series: 3, tipo: "reps", reps: "10", carga: "" }), ...cambio },
    }));

  // ── Derivados ────────────────────────────────────────────────────────────

  const porId = new Map(dia?.ejercicios.map((e) => [e.id, e]) ?? []);
  const lista = orden.map((id) => porId.get(id)).filter((e) => e !== undefined);

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
          <button className="btn btn-secondary" onClick={() => router.push(`/rutinas/${routineId}`)}>
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
            onClick={() => abrirDia(idx)}
          >
            {d.codigo} · {d.nombre}
          </button>
        ))}
        <button className="day-tab" onClick={agregarDia} disabled={procesando}>
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
                      onChange={(ev) => ajustar(e.id, { reps: ev.target.value })}
                      placeholder={(presc[e.id]?.tipo ?? e.tipo) === "tiempo" ? "45 s" : "8-12"}
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
                    disabled={procesando}
                    onClick={() => void eliminarEjercicio(e.id)}
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn btn-secondary btn-block"
              onClick={() => setModal("biblioteca")}
              disabled={procesando}
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
                      checked={descanso === d}
                      onChange={() => setDescanso(d)}
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
                      checked={progresion === p.valor}
                      onChange={() => setProgresion(p.valor)}
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
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
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
              disabled={procesando}
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
                onGuardado={async (creado) => {
                  setCatalogo((c) => [...c, creado]);
                  setModoPicker("lista");
                  setBusqueda("");
                  await agregarEjercicio(creado.id);
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
                          disabled={puesto || procesando}
                          onClick={() => void agregarEjercicio(e.id)}
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
                onClick={() => void eliminarDia()}
                disabled={procesando}
              >
                {procesando ? "Borrando…" : "Borrar día"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
