"use client";

import { Copy, GripVertical, Minus, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { guardarRutina } from "@/app/actions";
import { ExerciseForm } from "@/components/exercise-form";
import { ExerciseName, nombreVisible } from "@/components/exercise-name";
import { ExercisePhoto } from "@/components/exercise-photo";
import { kg, seriesEnReps, tramosReps } from "@/lib/format";
import type { DiaConEjercicios } from "@/db/queries";

/** Prescripción editable de un ejercicio dentro del día. */
type Presc = { series: number; tipo: "reps" | "tiempo"; reps: string; carga: string };

/**
 * Lo mismo que trae la base, más lo que el editor necesita para llevar la
 * cuenta de lo que todavía no existe allí.
 *
 * `nuevo` marca lo que hay que insertar al guardar. Lo demás —notas incluidas—
 * sale tal cual de `DiaConEjercicios`.
 */
type EjercicioEditable = DiaConEjercicios["ejercicios"][number] & { nuevo?: boolean };
type DiaEditable = Omit<DiaConEjercicios, "ejercicios"> & {
  ejercicios: EjercicioEditable[];
  nuevo?: boolean;
};

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Una letra que no esté usada, o `D<n>` si se acabaron las 26.
 *
 * `(routine_id, codigo)` es único, así que el fallback también tiene que
 * buscar hueco: con 26 días, dos altas seguidas daban el mismo `D27` y el
 * guardado se llevaba la violación de índice.
 */
const codigoLibre = (dias: { codigo: string }[]) => {
  const usados = new Set(dias.map((d) => d.codigo));
  const letra = [...LETRAS].find((l) => !usados.has(l));
  if (letra) return letra;
  let n = dias.length + 1;
  while (usados.has(`D${n}`)) n++;
  return `D${n}`;
};

/**
 * El prefijo del título de un día.
 *
 * El título se guarda entero —'Día D — Torso completo'— pero se edita sin él:
 * «Día D» lo pone el código, no una cadena escrita a mano que se quedaría
 * mintiendo en cuanto el día cambiara de letra. Duplicar ya le da otra.
 */
const prefijoTitulo = (codigo: string) => `Día ${codigo} — `;

/** La parte editable de un título. Lo que no lleve el prefijo esperado, va entero. */
const tituloCorto = (d: { codigo: string; titulo: string }) =>
  d.titulo.startsWith(prefijoTitulo(d.codigo))
    ? d.titulo.slice(prefijoTitulo(d.codigo).length)
    : d.titulo;

/** Del registro de la base al campo único de carga que ve el entrenador. */
const cargaInicial = (e: DiaConEjercicios["ejercicios"][number]) =>
  e.cargaTexto ?? (e.cargaKg && Number(e.cargaKg) > 0 ? kg(e.cargaKg) : "");

const prescDe = (e: DiaConEjercicios["ejercicios"][number]): Presc => ({
  series: e.series,
  tipo: e.tipo,
  reps: e.reps,
  carga: cargaInicial(e),
});

/**
 * Huella de todo lo editable, para saber si hay algo sin guardar.
 *
 * Antes el aviso solo miraba altas y bajas, así que renombrar un día, mover el
 * descanso o escribir una nota y pulsar "Cancelar" se perdía sin avisar. Como
 * la prescripción cae en `prescDe()` cuando no se tocó, la huella inicial sale
 * de los días tal como llegaron y un mapa vacío.
 */
const huella = (
  dias: DiaEditable[],
  nombreRutina: string,
  presc: Record<string, Presc>,
) =>
  JSON.stringify([
    nombreRutina,
    dias.map((d) => [
      d.id,
      d.codigo,
      d.nombre,
      d.titulo,
      d.subtitulo,
      d.descansoDefectoS,
      d.progresion,
      d.notas,
      d.ejercicios.map((e) => [e.id, e.exerciseId, presc[e.id] ?? prescDe(e)]),
    ]),
  ]);

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
  /** Ya resuelto por `getCatalogoLigero()`: el mío, o el del autor de la rutina. */
  alias?: string | null;
  grupo: string;
  equipo: string;
  // La miniatura del picker: reconocer el movimiento de un vistazo es más
  // rápido que leer el nombre, sobre todo entre variantes que se llaman casi
  // igual (press banca con barra / con mancuernas / inclinado…).
  imagenUrl?: string | null;
  fedbId?: string | null;
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

  const [dias, setDias] = useState<DiaEditable[]>(() => diasIniciales.map((d) => ({ ...d })));
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

  /**
   * Hay algo sin guardar: lo usa el aviso al salir.
   *
   * Se compara contra cómo llegó, no se buscan marcas de `nuevo`: eso solo veía
   * altas y bajas y dejaba pasar en silencio cualquier ajuste sobre lo que ya
   * existía. Los borrados entran solos — la fila desaparece del array.
   */
  const huellaInicial = useState(() =>
    huella(diasIniciales as DiaEditable[], nombreInicial, {}),
  )[0];
  const sucio = huella(dias, nombre, presc) !== huellaInicial;

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
      alias: fuente.alias ?? null,
      equipo: fuente.equipo,
      imagenUrl: fuente.imagenUrl ?? null,
      fedbId: fuente.fedbId ?? null,
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
    const codigo = codigoLibre(dias);
    const nombreDia = `Día ${dias.length + 1}`;

    const nuevo: DiaEditable = {
      id: crypto.randomUUID(),
      codigo,
      nombre: nombreDia,
      titulo: prefijoTitulo(codigo) + nombreDia,
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

  /**
   * Duplica el día abierto con todos sus ejercicios.
   *
   * Local como el resto del editor: el clon es un día `nuevo` con ids recién
   * hechos, así que "Cancelar" lo descarta y no queda nada en la base. Es lo
   * que evita la alternativa obvia y peor —clonar en el servidor y
   * recargar—, que además pisaría los cambios sin guardar de los otros días.
   *
   * Copia la prescripción **como está en pantalla**, no la que trajo la base:
   * si acabás de subir las series a 4, el clon también va a 4. Clonar es "otra
   * vez esto", y "esto" es lo que se está viendo.
   */
  const clonarDia = () => {
    if (!dia) return;

    const codigo = codigoLibre(dias);
    const nombreDia = `${dia.nombre} (copia)`;
    // El título va aparte del nombre y hay que conservarlo: el día D se llama
    // «Torso» en la pestaña y «Torso completo» en el encabezado.
    const corto = `${tituloCorto(dia)} (copia)`;

    // El par origen→clon: `presc` está indexado por id de routine_exercise y
    // los del clon son otros, así que hay que llevarla a mano.
    const pares = dia.ejercicios.map((origen) => ({
      origen,
      clon: { ...origen, id: crypto.randomUUID(), nuevo: true },
    }));

    setPresc((p) => ({
      ...p,
      ...Object.fromEntries(
        pares.map(({ origen, clon }) => [clon.id, { ...(p[origen.id] ?? prescDe(origen)) }]),
      ),
    }));

    setDias([
      ...dias,
      {
        ...dia,
        id: crypto.randomUUID(),
        codigo,
        nombre: nombreDia,
        titulo: prefijoTitulo(codigo) + corto,
        ejercicios: pares.map(({ clon }) => clon),
        nuevo: true,
      },
    ]);
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
          dias: dias.map((d) => {
            // El título se rearma aquí y no se manda tal cual del estado: así
            // el prefijo siempre concuerda con el código, y un campo vacío cae
            // en el nombre en vez de guardar un encabezado en blanco.
            const nombreDia = d.nombre.trim() || `Día ${d.codigo}`;
            const corto = tituloCorto(d).trim() || nombreDia;

            return {
              id: d.id,
              nuevo: Boolean(d.nuevo),
              codigo: d.codigo,
              nombre: nombreDia,
              titulo: prefijoTitulo(d.codigo) + corto,
              subtitulo: d.subtitulo.trim(),
              duracionMin: d.duracionMin,
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
            };
          }),
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

  // Sin buscar no se listan los 656+: sería la biblioteca entera cargada de
  // golpe en el picker, y de eso es de lo que sirve escribir. Se muestran los
  // primeros y se pide que escriba para llegar al resto.
  const SIN_BUSQUEDA = 24;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo.slice(0, SIN_BUSQUEDA);
    // El alias entra en la búsqueda igual que en /ejercicios: si lo llamás
    // "Jalón al pecho", escribir eso tiene que encontrarlo.
    return catalogo.filter((e) =>
      `${e.nombre} ${e.alias ?? ""} ${e.grupo} ${e.equipo}`.toLowerCase().includes(q),
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
                  aria-label={`Mover ${nombreVisible(e)}. Usá las flechas arriba y abajo.`}
                  onKeyDown={(ev) => {
                    if (ev.key === "ArrowUp") { ev.preventDefault(); mover(e.id, -1); }
                    if (ev.key === "ArrowDown") { ev.preventDefault(); mover(e.id, 1); }
                  }}
                  style={{ border: 0, background: "transparent", padding: 0 }}
                >
                  <GripVertical size={16} />
                </button>

                <div>
                  <strong>
                    <ExerciseName nombre={e.nombre} alias={e.alias} />
                  </strong>

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
                          ? `Tiempo por serie de ${nombreVisible(e)}`
                          : `Repeticiones de ${nombreVisible(e)}`
                      }
                    />

                    <input
                      className="input"
                      value={presc[e.id]?.carga ?? cargaInicial(e)}
                      onChange={(ev) => ajustar(e.id, { carga: ev.target.value })}
                      placeholder="kg"
                      aria-label={`Carga de ${nombreVisible(e)}`}
                    />
                  </div>
                </div>

                <div className="editor-actions">
                  <div className="stepper">
                    <button
                      aria-label={`Quitar una serie de ${nombreVisible(e)}`}
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
                      aria-label={`Añadir una serie a ${nombreVisible(e)}`}
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
                    aria-label={`Quitar ${nombreVisible(e)} del día`}
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

            {/* Lo que el día *es* va antes que cómo se entrena. Son tres
                cadenas distintas y visibles en sitios distintos: el nombre en
                la pestaña, el título en el encabezado de la sesión y el
                subtítulo en la línea de debajo. */}
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Nombre corto</label>
              <input
                className="input"
                value={dia.nombre}
                onChange={(e) => cambiarDia({ nombre: e.target.value })}
                placeholder="Torso"
                aria-label="Nombre corto del día, el de la pestaña"
              />
              <p className="campo-pista">
                La pestaña: {dia.codigo} · {dia.nombre.trim() || "…"}
              </p>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Título</label>
              <input
                className="input"
                value={tituloCorto(dia)}
                onChange={(e) =>
                  cambiarDia({ titulo: prefijoTitulo(dia.codigo) + e.target.value })
                }
                placeholder="Torso completo"
                aria-label="Título del día, el del encabezado"
              />
              <p className="campo-pista">
                El encabezado: {prefijoTitulo(dia.codigo)}
                {tituloCorto(dia).trim() || dia.nombre.trim() || "…"}
              </p>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Descripción</label>
              <input
                className="input"
                value={dia.subtitulo}
                onChange={(e) => cambiarDia({ subtitulo: e.target.value })}
                placeholder="Volumen medio, series al fallo controlado"
                aria-label="Descripción del día"
              />
            </div>

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

            {/* Secundario y no ghost: el rojo del sistema es para la acción
                primaria y el énfasis pequeño, y abajo ya lo gasta "Borrar". */}
            <button className="btn btn-secondary btn-block" onClick={clonarDia}>
              <Copy size={14} strokeWidth={3} /> Duplicar este día
            </button>

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
          // Con el alta abierta hay un formulario a medio rellenar: ahí ni el
          // fondo ni Escape cierran, solo sus botones. En la lista no hay nada
          // que perder y se sigue cerrando como siempre.
          onClick={() => modoPicker !== "nuevo" && cerrarModal()}
          onKeyDown={(ev) => ev.key === "Escape" && modoPicker !== "nuevo" && cerrarModal()}
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
                          <span className="picker-thumb">
                            <ExercisePhoto
                              fedbId={e.fedbId ?? null}
                              imagenUrl={e.imagenUrl ?? null}
                              nombre={nombreVisible(e)}
                              placeholder="vacio"
                            />
                          </span>
                          <span className="picker-texto">
                            <strong>
                              <ExerciseName nombre={e.nombre} alias={e.alias} />
                            </strong>
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

                {!busqueda.trim() && catalogo.length > SIN_BUSQUEDA && (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Mostrando {SIN_BUSQUEDA} de {catalogo.length}. Escribí para buscar en el resto.
                  </p>
                )}

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
