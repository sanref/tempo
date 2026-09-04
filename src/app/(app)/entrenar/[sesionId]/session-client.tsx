"use client";

import { Check, Maximize2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  anadirSerie,
  descartarSesion,
  guardarCorreccion,
  guardarSeries,
  terminarSesion,
  type SerieEntrada,
} from "@/app/actions";
import { ExerciseName, nombreVisible } from "@/components/exercise-name";
import { ExercisePhoto } from "@/components/exercise-photo";
import { MuscleDiagram } from "@/components/muscle-diagram";
import { conFecha, fechaInput, miles, mmss } from "@/lib/format";

type Serie = {
  id: string;
  orden: number;
  kg: string;
  reps: string;
  /** Solo en bloques por tiempo; vacío en los de repeticiones. */
  segundos: string;
  hecha: boolean;
  anterior: string;
};

type Bloque = {
  bloque: number;
  exerciseId: string;
  nombre: string;
  /** El de quien entrena, o el de quien le escribió la rutina. */
  alias: string | null;
  equipo: string;
  imagenUrl: string | null;
  fedbId: string | null;
  musculosPrimarios: string[] | null;
  musculosSecundarios: string[] | null;
  descansoS: number;
  tipo: "reps" | "tiempo";
  series: Serie[];
};

type Props = {
  sesionId: string;
  titulo: string;
  /** Corrigiendo un entrenamiento ya cerrado: sin reloj y sin descansos. */
  corrigiendo?: boolean;
  /** Epoch ms del inicio, calculado en el servidor. */
  startedAt: number;
  /** Epoch ms del render en servidor: evita el desajuste de hidratación. */
  ahora: number;
  bloques: Bloque[];
};

const n = (v: string) => {
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

/**
 * ── Pantalla de sesión ─────────────────────────────────────────────────────
 *
 * Todo el registro pasa por aquí y en el gimnasio no hay cobertura, así que
 * la regla es: la interfaz nunca espera al servidor.
 *
 *   1. Cada cambio se aplica al estado local al instante.
 *   2. Se apila en una cola (última escritura gana por serie).
 *   3. La cola se persiste en localStorage y se vacía con debounce.
 *   4. Si el envío falla, la cola se queda y se reintenta; se avisa arriba.
 *
 * Los cronómetros se derivan de marcas de tiempo absolutas, nunca de contar
 * ticks: cerrar la pestaña a mitad de serie no debe perder el tiempo.
 */
export function SessionClient({
  sesionId,
  titulo,
  corrigiendo = false,
  startedAt,
  ahora,
  bloques: inicial,
}: Props) {
  const [bloques, setBloques] = useState<Bloque[]>(inicial);
  const [ahoraMs, setAhoraMs] = useState(ahora);
  const [descansoHasta, setDescansoHasta] = useState<number | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /** Bloque cuya foto se está viendo en grande, o null. */
  const [verFoto, setVerFoto] = useState<number | null>(null);
  const [terminando, iniciarTerminar] = useTransition();

  // El día del entrenamiento y el que trae la sesión, para saber si se movió.
  // Los dos vacíos hasta montar: el día depende de la zona horaria de quien
  // entrena y formatearlo al renderizar daría un desajuste de hidratación.
  const [fecha, setFecha] = useState("");
  const [fechaOriginal, setFechaOriginal] = useState("");
  const [hoy, setHoy] = useState("");

  const claveCola = `tempo:sesion:${sesionId}:cola`;
  const claveDescanso = `tempo:sesion:${sesionId}:descanso`;
  const claveFecha = `tempo:sesion:${sesionId}:fecha`;

  const cola = useRef(new Map<string, SerieEntrada>());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Rehidratación: la cola pendiente manda sobre lo que trajo el servidor ──
  useEffect(() => {
    const propia = fechaInput(new Date(startedAt));
    setFechaOriginal(propia);
    setFecha(propia);
    setHoy(fechaInput(new Date()));

    try {
      // Un día elegido y no aplicado todavía: se manda al cerrar, así que si
      // la pestaña murió antes hay que recuperarlo como el resto de la cola.
      const elegida = localStorage.getItem(claveFecha);
      if (elegida) setFecha(elegida);

      const guardada = localStorage.getItem(claveCola);
      if (guardada) {
        const entradas: SerieEntrada[] = JSON.parse(guardada);
        for (const e of entradas) cola.current.set(e.id, e);
        if (entradas.length > 0) {
          setBloques((bs) =>
            bs.map((b) => ({
              ...b,
              series: b.series.map((s) => {
                const p = cola.current.get(s.id);
                return p
                  ? {
                      ...s,
                      kg: String(p.kg),
                      reps: String(p.reps),
                      segundos: p.segundos == null ? "" : String(p.segundos),
                      hecha: p.hecha,
                    }
                  : s;
              }),
            })),
          );
          void vaciarCola();
        }
      }

      const rest = localStorage.getItem(claveDescanso);
      if (rest && Number(rest) > Date.now()) setDescansoHasta(Number(rest));
    } catch {
      // localStorage puede estar bloqueado (modo privado): se sigue sin caché.
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reloj ────────────────────────────────────────────────────────────────
  // Corrigiendo no corre: `ahora` viene con el `ended_at` real de la sesión.
  useEffect(() => {
    if (corrigiendo) return;
    const t = setInterval(() => setAhoraMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [corrigiendo]);

  // Al volver a la pestaña, reintentar lo pendiente.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible" && cola.current.size > 0) void vaciarCola();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolver);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistirCola = useCallback(() => {
    try {
      localStorage.setItem(claveCola, JSON.stringify([...cola.current.values()]));
    } catch {
      /* sin caché */
    }
  }, [claveCola]);

  const vaciarCola = useCallback(async () => {
    if (cola.current.size === 0) return;
    const lote = [...cola.current.values()];

    try {
      await guardarSeries(sesionId, lote);
      // Solo se descarta lo que no volvió a cambiar mientras iba en vuelo.
      for (const enviada of lote) {
        const actual = cola.current.get(enviada.id);
        if (
          actual &&
          actual.kg === enviada.kg &&
          actual.reps === enviada.reps &&
          actual.segundos === enviada.segundos &&
          actual.hecha === enviada.hecha
        ) {
          cola.current.delete(enviada.id);
        }
      }
      persistirCola();
      setSinConexion(false);
    } catch {
      setSinConexion(true);
      // Se reintenta al volver a la pestaña, al recuperar red o al siguiente cambio.
    }
  }, [sesionId, persistirCola]);

  const encolar = useCallback(
    (tipo: Bloque["tipo"], serie: Serie) => {
      // En los bloques por tiempo las repeticiones no existen: van a 0 y lo
      // que se guarda son los segundos. El CHECK de la base exige justo eso.
      cola.current.set(serie.id, {
        id: serie.id,
        kg: n(serie.kg),
        reps: tipo === "tiempo" ? 0 : n(serie.reps),
        segundos: tipo === "tiempo" ? n(serie.segundos) : null,
        hecha: serie.hecha,
      });
      persistirCola();

      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => void vaciarCola(), 700);
    },
    [persistirCola, vaciarCola],
  );

  const editarSerie = useCallback(
    (bloque: number, id: string, cambio: Partial<Serie>) => {
      setBloques((bs) =>
        bs.map((b) =>
          b.bloque !== bloque
            ? b
            : {
                ...b,
                series: b.series.map((s) => {
                  if (s.id !== id) return s;
                  const nueva = { ...s, ...cambio };
                  encolar(b.tipo, nueva);
                  return nueva;
                }),
              },
        ),
      );
    },
    [encolar],
  );

  const alternarHecha = useCallback(
    (b: Bloque, serie: Serie) => {
      const hecha = !serie.hecha;
      editarSerie(b.bloque, serie.id, { hecha });

      // Marcar arranca el descanso; desmarcar no lo toca. Corrigiendo no hay
      // descanso que contar: el entrenamiento ya pasó.
      if (hecha && !corrigiendo) {
        const hasta = Date.now() + b.descansoS * 1000;
        setDescansoHasta(hasta);
        try {
          localStorage.setItem(claveDescanso, String(hasta));
        } catch {
          /* sin caché */
        }
      }
    },
    [editarSerie, claveDescanso, corrigiendo],
  );

  const cerrarDescanso = useCallback(
    (hasta: number | null) => {
      setDescansoHasta(hasta);
      try {
        if (hasta) localStorage.setItem(claveDescanso, String(hasta));
        else localStorage.removeItem(claveDescanso);
      } catch {
        /* sin caché */
      }
    },
    [claveDescanso],
  );

  const agregar = useCallback(
    async (bloque: number) => {
      try {
        const nueva = await anadirSerie(sesionId, bloque);
        setBloques((bs) =>
          bs.map((b) =>
            b.bloque === bloque
              ? {
                  ...b,
                  series: [
                    ...b.series,
                    {
                      ...nueva,
                      kg: String(nueva.kg),
                      reps: String(nueva.reps),
                      segundos: nueva.segundos == null ? "" : String(nueva.segundos),
                    },
                  ],
                }
              : b,
          ),
        );
        setSinConexion(false);
      } catch {
        // Añadir una serie sí necesita al servidor: hace falta su id.
        setSinConexion(true);
      }
    },
    [sesionId],
  );

  /**
   * El día elegido, ya resuelto a un instante, o `undefined` si no se movió.
   *
   * Se resuelve aquí y no en el servidor porque la zona horaria que vale es la
   * del navegador: `conFecha()` conserva la hora de la sesión y solo le cambia
   * el día.
   */
  const fechaElegida = () =>
    fecha && fecha !== fechaOriginal
      ? conFecha(new Date(startedAt), fecha).toISOString()
      : undefined;

  /**
   * El día se guarda en local y viaja al cerrar, no al elegirlo.
   *
   * Mientras la sesión corre el reloj es `now() - started_at`: mover esa marca
   * en el acto lo dejaría marcando dos jornadas, y `terminarSesion()` cerraría
   * con una duración de días. Se desplaza todo junto al final.
   */
  const cambiarFecha = (ymd: string) => {
    setFecha(ymd);
    try {
      if (ymd) localStorage.setItem(claveFecha, ymd);
    } catch {
      /* sin caché */
    }
  };

  const finalizar = () => {
    iniciarTerminar(async () => {
      await vaciarCola();
      const iso = fechaElegida();
      try {
        localStorage.removeItem(claveFecha);
      } catch {
        /* sin caché */
      }
      if (corrigiendo) await guardarCorreccion(sesionId, iso);
      else await terminarSesion(sesionId, iso);
    });
  };

  const descartar = () => {
    iniciarTerminar(async () => {
      // Lo que hubiera en la cola se va con la sesión: no se reintenta.
      cola.current.clear();
      try {
        localStorage.removeItem(claveCola);
        localStorage.removeItem(claveDescanso);
        localStorage.removeItem(claveFecha);
      } catch {
        /* sin caché */
      }
      await descartarSesion(sesionId);
    });
  };

  // ── Derivados ────────────────────────────────────────────────────────────
  const { hechas, total, volumen } = useMemo(() => {
    const todas = bloques.flatMap((b) => b.series);
    return {
      hechas: todas.filter((s) => s.hecha).length,
      total: todas.length,
      volumen: todas.filter((s) => s.hecha).reduce((a, s) => a + n(s.kg) * n(s.reps), 0),
    };
  }, [bloques]);

  const segundos = Math.max(0, Math.floor((ahoraMs - startedAt) / 1000));
  const restante = descansoHasta ? Math.ceil((descansoHasta - ahoraMs) / 1000) : 0;

  useEffect(() => {
    if (descansoHasta && restante <= 0) cerrarDescanso(null);
  }, [descansoHasta, restante, cerrarDescanso]);

  return (
    <div className="session">
      <div className="session-topbar">
        <div>
          <div className="eyebrow">
            {corrigiendo ? "Corrigiendo" : "En curso"} · {titulo}
          </div>
          <div className="session-clock">{mmss(segundos)}</div>
        </div>
        <div className="session-meta">
          <div>
            <div className="session-meta-label">Series</div>
            <div className="session-meta-value">
              {hechas}/{total}
            </div>
          </div>
          <div>
            <div className="session-meta-label">Volumen</div>
            <div className="session-meta-value">{miles(volumen)} kg</div>
          </div>
          <button className="btn btn-primary" onClick={finalizar} disabled={terminando}>
            {terminando ? "Guardando…" : corrigiendo ? "Guardar" : "Terminar"}
          </button>
        </div>
      </div>

      <div className="session-progress">
        <div style={{ width: `${total ? Math.round((hechas / total) * 100) : 0}%` }} />
      </div>

      {sinConexion && (
        <p className="offline-note">
          Sin conexión. Tus series se están guardando en el teléfono y se subirán solas.
        </p>
      )}

      {/* En una línea y no como campo con etiqueta encima: esta pantalla ya
          lleva siete a nueve bloques y cada fila de más alarga el scroll.
          Sale hoy por defecto, que es cuando se abrió la sesión. */}
      <div className="session-fecha">
        <label htmlFor="fecha-sesion">Fecha del entrenamiento</label>
        <input
          id="fecha-sesion"
          className="input"
          type="date"
          value={fecha}
          max={hoy || undefined}
          onChange={(ev) => cambiarFecha(ev.target.value)}
        />
        {fecha !== "" && fecha !== fechaOriginal && (
          <span className="session-fecha-nota">
            {corrigiendo ? "Se aplica al guardar" : "Se aplica al terminar"}
          </span>
        )}
      </div>

      {bloques.map((b) => {
        const hechasBloque = b.series.filter((s) => s.hecha).length;
        const completo = hechasBloque === b.series.length && b.series.length > 0;

        return (
          <section className="exercise-block" key={b.bloque}>
            <div className="exercise-head">
              {/* La miniatura es el recordatorio; la guía de verdad está a un
                  toque, en el diálogo. Así la cabecera no crece —entre serie y
                  serie lo que se quiere es llegar rápido a los campos— pero
                  quien no conoce el movimiento lo puede ver grande.

                  Si no hay nada que enseñar no se pinta el botón: sin foto ni
                  músculos, abrir el diálogo daría una caja vacía. */}
              {(b.fedbId || b.imagenUrl || b.musculosPrimarios?.length) && (
                <button
                  type="button"
                  className="exercise-thumb"
                  onClick={() => setVerFoto(b.bloque)}
                  aria-label={`Ver ${nombreVisible(b)} en grande`}
                >
                  <ExercisePhoto
                    fedbId={b.fedbId}
                    imagenUrl={b.imagenUrl}
                    nombre={nombreVisible(b)}
                    placeholder="vacio"
                  />
                  <span className="exercise-thumb-lupa" aria-hidden="true">
                    <Maximize2 size={13} strokeWidth={3} />
                  </span>
                </button>
              )}
              <div className="exercise-name">
                <h4>{nombreVisible(b)}</h4>
                {/* Con alias, el nombre del catálogo se cuela en la línea del
                    equipamiento en vez de abrir una tercera: con siete a nueve
                    bloques, cada línea de más alarga el scroll justo donde se
                    quiere llegar rápido a los campos. En grande se ve en el
                    diálogo de la foto. */}
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {b.alias && `${b.nombre} · `}
                  {b.equipo}
                  {b.tipo === "tiempo" && " · por tiempo"}
                </span>
              </div>
              <span className="exercise-badge" data-done={completo}>
                {completo ? "Completado" : `${hechasBloque} de ${b.series.length}`}
              </span>
            </div>

            <div className="set-grid set-head">
              <div>Ser</div>
              <div>Anterior</div>
              <div>Kg</div>
              <div>{b.tipo === "tiempo" ? "Seg" : "Reps"}</div>
              <div />
            </div>

            {b.series.map((s) => (
              <div className="set-grid set-row" key={s.id} data-done={s.hecha}>
                <div className="set-n">{s.orden}</div>
                <div className="set-prev text-muted">{s.anterior}</div>
                <div>
                  <input
                    className="input"
                    inputMode="decimal"
                    aria-label={`Kilos de la serie ${s.orden} de ${nombreVisible(b)}`}
                    value={s.kg}
                    onChange={(e) => editarSerie(b.bloque, s.id, { kg: e.target.value })}
                  />
                </div>
                <div>
                  {b.tipo === "tiempo" ? (
                    <input
                      className="input"
                      inputMode="numeric"
                      aria-label={`Segundos de la serie ${s.orden} de ${nombreVisible(b)}`}
                      value={s.segundos}
                      onChange={(e) => editarSerie(b.bloque, s.id, { segundos: e.target.value })}
                    />
                  ) : (
                    <input
                      className="input"
                      inputMode="numeric"
                      aria-label={`Repeticiones de la serie ${s.orden} de ${nombreVisible(b)}`}
                      value={s.reps}
                      onChange={(e) => editarSerie(b.bloque, s.id, { reps: e.target.value })}
                    />
                  )}
                </div>
                <div>
                  <button
                    className="set-check"
                    data-done={s.hecha}
                    aria-pressed={s.hecha}
                    aria-label={s.hecha ? "Desmarcar serie" : "Confirmar serie"}
                    onClick={() => alternarHecha(b, s)}
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => void agregar(b.bloque)}
            >
              <Plus size={14} strokeWidth={3} /> Añadir serie
            </button>
          </section>
        );
      })}

      {/* Salir de un entrenamiento empezado por error. Abajo y en secundario:
          es lo último que uno quiere pulsar sin querer a mitad de serie. */}
      {!corrigiendo && (
        <div style={{ padding: "18px var(--pad-x)" }}>
          <button className="btn btn-ghost" onClick={() => setConfirmando(true)}>
            <Trash2 size={14} /> Descartar este entrenamiento
          </button>
        </div>
      )}

      {/* Ver el ejercicio en grande. Se busca el bloque por su número en vez de
          guardarlo entero en el estado: así no queda una copia vieja si las
          series cambian mientras el diálogo está abierto. */}
      {verFoto !== null && (
        <VerEjercicio bloque={bloques.find((b) => b.bloque === verFoto)} onCerrar={() => setVerFoto(null)} />
      )}

      {confirmando && (
        <div className="dialog-backdrop" onClick={() => setConfirmando(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Descartar entrenamiento"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Descartar el entrenamiento?</div>
            <p className="dialog-body">
              {hechas === 0
                ? "No confirmaste ninguna serie, así que no se pierde nada."
                : `Se pierden las ${hechas} ${hechas === 1 ? "serie confirmada" : "series confirmadas"}. No cuenta para el volumen ni para la adherencia.`}
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmando(false)}>
                Seguir entrenando
              </button>
              <button className="btn btn-primary" onClick={descartar} disabled={terminando}>
                {terminando ? "Descartando…" : "Descartar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {descansoHasta && restante > 0 && (
        <div className="rest-bar">
          <div>
            <span className="rest-label">Descanso</span>
            <span className="rest-count">{mmss(restante)}</span>
            <span className="rest-actions">
              <button
                className="btn btn-secondary"
                onClick={() => cerrarDescanso(descansoHasta + 30_000)}
              >
                +30 s
              </button>
              <button className="btn btn-secondary" onClick={() => cerrarDescanso(null)}>
                Saltar
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * El ejercicio en grande, sin salir del entrenamiento.
 *
 * Vive en un diálogo y no en la propia cabecera a propósito: entre serie y
 * serie lo que se quiere es llegar a los campos, y una foto grande fija en
 * cada uno de los nueve bloques convertiría la pantalla en un scroll largo.
 * Aquí se paga solo cuando se pide.
 *
 * No trae acciones ni escribe nada — es una lectura sobre una pantalla que
 * tiene una cola de escritura detrás, y conviene que siga siendo así.
 */
function VerEjercicio({ bloque, onCerrar }: { bloque?: Bloque; onCerrar: () => void }) {
  // Puede no estar si el bloque desapareció entre el clic y el render.
  if (!bloque) return null;

  return (
    <div
      className="dialog-backdrop"
      onClick={onCerrar}
      onKeyDown={(ev) => ev.key === "Escape" && onCerrar()}
    >
      <div
        className="dialog dialog--ancho"
        role="dialog"
        aria-modal="true"
        aria-label={nombreVisible(bloque)}
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Aquí sí a dos líneas: en el diálogo sobra sitio y es el momento en
            que alguien va a comprobar de qué movimiento se trata. */}
        <div className="dialog-title">
          <ExerciseName nombre={bloque.nombre} alias={bloque.alias} />
        </div>

        <div className="ver-ejercicio">
          <div className="ver-foto">
            <ExercisePhoto
              fedbId={bloque.fedbId}
              imagenUrl={bloque.imagenUrl}
              nombre={nombreVisible(bloque)}
            />
          </div>

          {bloque.musculosPrimarios?.length ? (
            <MuscleDiagram
              primarios={bloque.musculosPrimarios}
              secundarios={bloque.musculosSecundarios}
            />
          ) : null}
        </div>

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
