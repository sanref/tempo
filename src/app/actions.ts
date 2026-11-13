"use server";

import { randomInt } from "node:crypto";

import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assignments,
  coachInvites,
  exerciseAliases,
  exercises,
  muscleGroup,
  personalRecords,
  routineDays,
  routineExercises,
  routines,
  setLogs,
  users,
  workoutSessions,
} from "@/db/schema";
import { getProximoDia, getSesionEnCurso, type DiaConEjercicios } from "@/db/queries";
import { esAdmin, esEntrenador, getCurrentUser } from "@/lib/auth";
import { buscarEnCatalogo, entradaDeCatalogo } from "@/lib/catalogo-externo";
import { repsPlanificadas, segundosPlanificados } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Mutaciones. Todas verifican que la fila pertenece al usuario actual.
 *
 * No es redundante con RLS: la app entra por DATABASE_URL con el rol dueño de
 * las tablas, que salta las políticas. Estas guardas son la única protección
 * del web.
 */

// ── Guardas de propiedad ──────────────────────────────────────────────────

/** La rutina, si es del usuario actual. Si no, corta. */
async function rutinaPropia(routineId: string) {
  const user = await getCurrentUser();

  const rutina = await db.query.routines.findFirst({
    where: and(eq(routines.id, routineId), eq(routines.ownerId, user.id)),
  });
  if (!rutina) throw new Error("Rutina no encontrada o sin permisos");

  return rutina;
}

/** El día, si cuelga de una rutina del usuario actual. Si no, corta. */
async function diaPropio(routineDayId: string) {
  const user = await getCurrentUser();

  const [fila] = await db
    .select({ dia: routineDays })
    .from(routineDays)
    .innerJoin(routines, eq(routines.id, routineDays.routineId))
    .where(and(eq(routineDays.id, routineDayId), eq(routines.ownerId, user.id)))
    .limit(1);

  if (!fila) throw new Error("Día no encontrado o sin permisos");
  return fila.dia;
}

// ── Empezar / reanudar una sesión ─────────────────────────────────────────

/**
 * El día, si el usuario tiene derecho a entrenarlo. Si no, undefined.
 *
 * Vale por dos vías: la rutina es suya (`routines.owner_id`) o la tiene
 * asignada y viva. Sin esta comprobación, `empezarSesion(idAjeno)` abría una
 * sesión sobre la rutina de otro y materializaba sus `set_logs` — con lo que
 * los ejercicios y las cargas planificadas de esa persona acababan en la
 * pantalla de quien llamara. Es una server action: el argumento lo elige quien
 * la invoca, no la pantalla.
 */
async function diaEntrenable(routineDayId: string, userId: string) {
  const [fila] = await db
    .select({ dia: routineDays })
    .from(routineDays)
    .innerJoin(routines, eq(routines.id, routineDays.routineId))
    .leftJoin(
      assignments,
      and(
        eq(assignments.routineId, routines.id),
        eq(assignments.clientId, userId),
        isNull(assignments.endedOn),
      ),
    )
    .where(
      and(
        eq(routineDays.id, routineDayId),
        or(eq(routines.ownerId, userId), isNotNull(assignments.id)),
      ),
    )
    .limit(1);

  return fila?.dia;
}

export async function empezarSesion(routineDayId?: string) {
  const user = await getCurrentUser();

  // Nunca abrir dos: si hay una en curso, se reanuda.
  const enCurso = await getSesionEnCurso(user.id);
  if (enCurso) redirect(`/entrenar/${enCurso}`);

  const dia = routineDayId
    ? await diaEntrenable(routineDayId, user.id)
    : await getProximoDia(user.id).then((d) => (d ? diaEntrenable(d.id, user.id) : undefined));

  if (!dia) {
    throw new Error("No hay ningún día de rutina que empezar. Asigná o creá una rutina primero.");
  }

  const rutina = await db.query.routines.findFirst({ where: eq(routines.id, dia.routineId) });

  const ejercicios = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.routineDayId, dia.id))
    .orderBy(asc(routineExercises.orden));

  const sesionId = await db.transaction(async (tx) => {
    const [sesion] = await tx
      .insert(workoutSessions)
      .values({
        userId: user.id,
        routineId: rutina?.id,
        routineDayId: dia.id,
        titulo: dia.titulo,
        status: "en_curso",
      })
      .returning({ id: workoutSessions.id });

    // Se materializan las series planificadas: así la pantalla arranca con la
    // tabla completa y marcar una serie es un UPDATE, no un INSERT.
    //
    // El trabajo por tiempo no lleva repeticiones: `reps` se queda en 0 (y con
    // él el volumen) y lo planificado va a `segundos`. Un rango como '8-12' se
    // resuelve por el extremo bajo — quitar los no-dígitos daría 812, que
    // además revienta contra el CHECK de set_logs.reps.
    //
    // `i` es el índice de la serie dentro del bloque, y va a las funciones de
    // formato: con '15/12/10/10' cada serie pide lo suyo. Con un valor único
    // devuelven lo mismo para todas, que es el caso de siempre.
    const filas = ejercicios.flatMap((e, bloque) =>
      Array.from({ length: e.series }, (_, i) => ({
        sessionId: sesion.id,
        exerciseId: e.exerciseId,
        routineExerciseId: e.id,
        bloque,
        orden: i + 1,
        kg: e.cargaKg ?? "0",
        reps: e.tipo === "tiempo" ? 0 : repsPlanificadas(e.reps, i),
        segundos: e.tipo === "tiempo" ? segundosPlanificados(e.reps, i) : null,
      })),
    );

    if (filas.length > 0) await tx.insert(setLogs).values(filas);
    return sesion.id;
  });

  redirect(`/entrenar/${sesionId}`);
}

// ── Registro de series ────────────────────────────────────────────────────

export type SerieEntrada = {
  id: string;
  kg: number;
  reps: number;
  /** Solo en bloques por tiempo; en esos, `reps` va a 0. */
  segundos?: number | null;
  hecha: boolean;
};

/**
 * Guarda un lote de series. El cliente escribe primero en local y va vaciando
 * su cola contra esto; por eso acepta varias de golpe y es idempotente.
 */
export async function guardarSeries(sesionId: string, series: SerieEntrada[]) {
  if (series.length === 0) return { ok: true as const };

  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Sesión no encontrada");

  await db.transaction(async (tx) => {
    for (const s of series) {
      // El CHECK de la base exige reps = 0 cuando hay segundos; se fuerza aquí
      // para que un cliente desincronizado no tumbe el lote entero.
      const porTiempo = s.segundos != null;

      await tx
        .update(setLogs)
        .set({
          kg: String(Math.max(0, Math.round(s.kg * 10) / 10)),
          reps: porTiempo ? 0 : Math.min(100, Math.max(0, Math.round(s.reps))),
          segundos: porTiempo ? Math.min(3600, Math.max(0, Math.round(s.segundos!))) : null,
          // Solo se sella la primera vez: reeditar los kg no debe mover la hora.
          doneAt: s.hecha ? sql`coalesce(${setLogs.doneAt}, now())` : null,
        })
        .where(and(eq(setLogs.id, s.id), eq(setLogs.sessionId, sesionId)));
    }
  });

  return { ok: true as const };
}

/** "+ Añadir serie": copia kg y reps de la última del bloque. */
export async function anadirSerie(sesionId: string, bloque: number) {
  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Sesión no encontrada");

  const [ultima] = await db
    .select()
    .from(setLogs)
    .where(and(eq(setLogs.sessionId, sesionId), eq(setLogs.bloque, bloque)))
    .orderBy(desc(setLogs.orden))
    .limit(1);

  if (!ultima) throw new Error("Ese ejercicio no existe en la sesión");

  const [nueva] = await db
    .insert(setLogs)
    .values({
      sessionId: sesionId,
      exerciseId: ultima.exerciseId,
      routineExerciseId: ultima.routineExerciseId,
      bloque,
      orden: ultima.orden + 1,
      kg: ultima.kg,
      reps: ultima.reps,
      segundos: ultima.segundos,
    })
    .returning({
      id: setLogs.id,
      orden: setLogs.orden,
      kg: setLogs.kg,
      reps: setLogs.reps,
      segundos: setLogs.segundos,
    });

  return {
    id: nueva.id,
    orden: nueva.orden,
    kg: Number(nueva.kg),
    reps: nueva.reps,
    segundos: nueva.segundos,
    hecha: false,
    anterior: "—",
  };
}

// ── Cerrar la sesión ──────────────────────────────────────────────────────

/**
 * El día al que se manda una sesión, o `null` si se queda donde está.
 *
 * Llega un instante ya resuelto —no un 'YYYY-MM-DD'— porque la zona horaria
 * que importa es la de quien entrena y el servidor no la conoce: a las diez de
 * la noche en UTC-3 el servidor ya está en el día siguiente. El día lo elige
 * el cliente con `conFecha()`; aquí solo se comprueba que sea sensato.
 */
function inicioDesplazado(fechaIso: string | undefined, actual: Date): Date | null {
  if (!fechaIso) return null;

  const nuevo = new Date(fechaIso);
  if (Number.isNaN(nuevo.getTime())) throw new Error("Esa fecha no es válida.");

  // Un día de margen: el cliente manda su medianoche local y puede ir por
  // delante de la del servidor. Más allá ya es un entrenamiento del futuro,
  // que descuadraría el gráfico semanal y la adherencia.
  if (nuevo.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new Error("No se puede fechar un entrenamiento en el futuro.");
  }

  return nuevo.getTime() === actual.getTime() ? null : nuevo;
}

/**
 * Cierra la sesión en curso.
 *
 * `fechaIso` mueve el entrenamiento a otro día —se entrenó el sábado y se
 * registra el lunes—. Se aplica aquí y no en el momento de elegirlo a
 * propósito: mientras la sesión corre, el reloj es `now() - started_at` y
 * mover esa marca lo dejaría marcando dos jornadas. La duración se mide
 * siempre contra el inicio de verdad y se traslada entera.
 */
export async function terminarSesion(sesionId: string, fechaIso?: string) {
  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Sesión no encontrada");

  const fin = new Date();
  const inicio = inicioDesplazado(fechaIso, sesion.startedAt);
  const duracionMs = fin.getTime() - sesion.startedAt.getTime();

  await db.transaction(async (tx) => {
    // Las series que quedaron sin confirmar no se guardan como hechas.
    //
    // El desplazamiento va antes que `registrar_prs()`: la marca se fecha con
    // `coalesce(ended_at, now())` y tiene que salir con el día definitivo.
    await tx
      .update(workoutSessions)
      .set({
        status: "terminada",
        ...(inicio
          ? { startedAt: inicio, endedAt: new Date(inicio.getTime() + duracionMs) }
          : { endedAt: fin }),
      })
      .where(eq(workoutSessions.id, sesionId));

    await tx.execute(sql`SELECT registrar_prs(${sesionId})`);

    // Progresión lineal: si completó todas las series del día, sube la carga.
    if (sesion.routineDayId) {
      await tx.execute(sql`
        WITH completos AS (
          SELECT l.routine_exercise_id AS id
          FROM set_logs l
          WHERE l.session_id = ${sesionId} AND l.routine_exercise_id IS NOT NULL
          GROUP BY l.routine_exercise_id
          HAVING count(*) FILTER (WHERE l.done_at IS NULL) = 0
        )
        UPDATE routine_exercises re
        SET carga_kg = re.carga_kg + d.incremento_kg
        FROM routine_days d, completos c
        WHERE re.id = c.id
          AND d.id = re.routine_day_id
          AND d.id = ${sesion.routineDayId}
          AND d.progresion = 'lineal'
          AND re.carga_kg IS NOT NULL
          AND re.carga_kg > 0
      `);
    }
  });

  revalidatePath("/", "layout");
  redirect("/historial");
}

export async function descartarSesion(sesionId: string) {
  const user = await getCurrentUser();
  await db
    .update(workoutSessions)
    .set({ status: "abandonada", endedAt: new Date() })
    .where(and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)));

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Borra un entrenamiento del historial.
 *
 * Se lleva por delante sus series (cascade) y las marcas personales que salieron
 * de él: una marca que cita un entrenamiento que ya no existe no se sostiene.
 *
 * Lo que NO deshace es la progresión lineal que se aplicó al cerrarlo. La carga
 * de la rutina pudo haberse tocado a mano después, y restar 2,5 kg a ciegas
 * haría más daño que dejarla quieta.
 */
export async function borrarSesion(sesionId: string) {
  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Entrenamiento no encontrado");

  await db.transaction(async (tx) => {
    await tx.delete(personalRecords).where(eq(personalRecords.sessionId, sesionId));
    await tx.delete(workoutSessions).where(eq(workoutSessions.id, sesionId));
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Cierra la corrección de un entrenamiento ya terminado.
 *
 * Las series se guardan por la vía de siempre (`guardarSeries`, con su cola);
 * esto solo rehace las marcas. Se borran las de la sesión y se vuelven a
 * calcular, porque `registrar_prs()` solo inserta cuando se supera lo anterior:
 * si la corrección fue a la baja, la marca vieja se quedaría puesta.
 *
 * No se vuelve a aplicar la progresión lineal — ya se aplicó al cerrar la
 * sesión y volver a hacerlo subiría la carga dos veces.
 */
export async function guardarCorreccion(sesionId: string, fechaIso?: string) {
  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Entrenamiento no encontrado");

  const inicio = inicioDesplazado(fechaIso, sesion.startedAt);

  await db.transaction(async (tx) => {
    // Primero el día, después las marcas: `registrar_prs()` fecha por
    // `coalesce(ended_at, now())`, así que si se corrigiera después, el PR
    // quedaría con el día viejo. La duración se traslada entera — se corrige
    // cuándo fue el entrenamiento, no cuánto duró.
    if (inicio) {
      const duracionMs = (sesion.endedAt?.getTime() ?? sesion.startedAt.getTime())
        - sesion.startedAt.getTime();
      await tx
        .update(workoutSessions)
        .set({
          startedAt: inicio,
          endedAt: sesion.endedAt ? new Date(inicio.getTime() + duracionMs) : null,
        })
        .where(eq(workoutSessions.id, sesionId));
    }

    await tx.delete(personalRecords).where(eq(personalRecords.sessionId, sesionId));
    await tx.execute(sql`SELECT registrar_prs(${sesionId})`);
  });

  revalidatePath("/", "layout");
  redirect("/historial");
}

// ── Rutinas ───────────────────────────────────────────────────────────────

/** Crea un borrador vacío con un primer día y abre su editor. */
export async function crearRutina() {
  const user = await getCurrentUser();

  const id = await db.transaction(async (tx) => {
    const [rutina] = await tx
      .insert(routines)
      .values({
        nombre: "Rutina sin título",
        descripcion: "",
        status: "borrador",
        ownerId: user.id,
        semanas: 8,
      })
      .returning({ id: routines.id });

    await tx.insert(routineDays).values({
      routineId: rutina.id,
      orden: 0,
      codigo: "A",
      nombre: "Día 1",
      titulo: "Día A — Día 1",
      subtitulo: "",
    });

    return rutina.id;
  });

  revalidatePath("/rutinas");
  redirect(`/rutinas/${id}/editar`);
}

export async function duplicarRutina(routineId: string) {
  const user = await getCurrentUser();

  const original = await db.query.routines.findFirst({ where: eq(routines.id, routineId) });
  if (!original) throw new Error("Rutina no encontrada");

  const nuevaId = await db.transaction(async (tx) => {
    const [nueva] = await tx
      .insert(routines)
      .values({
        nombre: `${original.nombre} (copia)`,
        descripcion: original.descripcion,
        nivel: original.nivel,
        semanas: original.semanas,
        status: "borrador",
        ownerId: user.id,
        authorId: null,
      })
      .returning({ id: routines.id });

    const dias = await tx
      .select()
      .from(routineDays)
      .where(eq(routineDays.routineId, routineId))
      .orderBy(asc(routineDays.orden));

    for (const d of dias) {
      const [nuevoDia] = await tx
        .insert(routineDays)
        .values({ ...d, id: undefined, routineId: nueva.id })
        .returning({ id: routineDays.id });

      const ejercicios = await tx
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineDayId, d.id));

      if (ejercicios.length > 0) {
        await tx
          .insert(routineExercises)
          .values(ejercicios.map((e) => ({ ...e, id: undefined, routineDayId: nuevoDia.id })));
      }
    }

    return nueva.id;
  });

  revalidatePath("/rutinas");
  redirect(`/rutinas/${nuevaId}`);
}

/**
 * La carga se escribe en un solo campo y se reparte en dos columnas.
 *
 *   '72,5'      → carga_kg 72.5, sin texto
 *   '+17,5 kg'  → carga_kg 17.5 y el texto tal cual: el texto es lo que se
 *                 pinta, y el número es lo que sube la progresión lineal
 *   'Peso corp' → solo texto, sin número que progresar
 *   ''          → ninguna de las dos
 */
function parsearCarga(entrada: string): { cargaKg: string | null; cargaTexto: string | null } {
  const t = entrada.trim();
  if (!t) return { cargaKg: null, cargaTexto: null };

  const normalizado = t.replace(",", ".");
  const acotar = (n: number) => String(Math.min(9999.99, Math.max(0, n)));

  if (/^\d+(\.\d+)?$/.test(normalizado)) {
    return { cargaKg: acotar(Number(normalizado)), cargaTexto: null };
  }

  const n = normalizado.match(/\d+(\.\d+)?/)?.[0];
  return { cargaKg: n ? acotar(Number(n)) : null, cargaTexto: t };
}

/**
 * Editor: guarda la rutina entera de una vez.
 *
 * El editor no escribe nada hasta que se pulsa "Guardar": ni al quitar un
 * ejercicio, ni al añadirlo, ni al borrar un día. Antes sí lo hacía —la
 * estructura iba al servidor en el acto— y el botón "Cancelar" acababa
 * mintiendo: descartaba los ajustes pero no las bajas, que ya estaban
 * cometidas.
 *
 * Los ids de lo nuevo los pone el cliente (`crypto.randomUUID()`): la base los
 * genera por defecto, pero nada impide mandarlos hechos, y así el editor puede
 * indexar su estado local sin haber hablado con el servidor todavía.
 *
 * Todo va en una transacción: o entra el día entero o no entra nada.
 */
export async function guardarRutina(input: {
  routineId: string;
  nombreRutina: string;
  dias: {
    id: string;
    nuevo: boolean;
    codigo: string;
    nombre: string;
    titulo: string;
    subtitulo: string;
    /** Se manda siempre: sin esto un día nuevo o clonado nacía en NULL y
        perdía el «~45 min» de las pestañas y de la home. */
    duracionMin: number | null;
    descansoDefectoS: number;
    progresion: "lineal" | "doble" | "manual";
    notas: string;
    ejercicios: {
      id: string;
      nuevo: boolean;
      exerciseId: string;
      series: number;
      tipo: "reps" | "tiempo";
      /** Texto tal cual lo escribe el entrenador; vacío = sin carga fijada. */
      carga: string;
      reps: string;
    }[];
  }[];
  diasBorrados: string[];
  ejerciciosBorrados: string[];
}) {
  const rutina = await rutinaPropia(input.routineId);

  await db.transaction(async (tx) => {
    await tx
      .update(routines)
      .set({ nombre: input.nombreRutina.trim() || rutina.nombre })
      .where(eq(routines.id, input.routineId));

    // ── Bajas ────────────────────────────────────────────────────────────
    // Acotadas a esta rutina: los ids vienen del cliente. Borrar no toca el
    // historial — set_logs.routine_exercise_id y workout_sessions.routine_day_id
    // son ON DELETE SET NULL.
    const diasDeLaRutina = tx
      .select({ id: routineDays.id })
      .from(routineDays)
      .where(eq(routineDays.routineId, input.routineId));

    if (input.ejerciciosBorrados.length > 0) {
      await tx
        .delete(routineExercises)
        .where(
          and(
            inArray(routineExercises.id, input.ejerciciosBorrados),
            inArray(routineExercises.routineDayId, diasDeLaRutina),
          ),
        );
    }

    if (input.diasBorrados.length > 0) {
      await tx
        .delete(routineDays)
        .where(
          and(
            inArray(routineDays.id, input.diasBorrados),
            eq(routineDays.routineId, input.routineId),
          ),
        );
    }

    // ── Días ─────────────────────────────────────────────────────────────
    // El orden se escribe en dos pasadas, desplazado por encima de lo que hay:
    // (routine_id, orden) es único y no admite estados intermedios. Lo mismo
    // que hacía `reordenarEjercicios`.
    const desplazado = input.dias.length + 1000;

    for (const [i, d] of input.dias.entries()) {
      if (d.nuevo) {
        await tx.insert(routineDays).values({
          id: d.id,
          routineId: input.routineId,
          orden: desplazado + i,
          codigo: d.codigo,
          nombre: d.nombre,
          titulo: d.titulo,
          subtitulo: d.subtitulo,
          duracionMin: d.duracionMin,
          descansoDefectoS: d.descansoDefectoS,
          progresion: d.progresion,
          notas: d.notas,
        });
      } else {
        await tx
          .update(routineDays)
          .set({
            orden: desplazado + i,
            // Nombre, título y subtítulo también en el UPDATE: el editor los
            // edita y sin esto solo se aplicaban a los días recién creados,
            // sin dar ningún error. `codigo` no, que lo reparte el editor y
            // es único por rutina.
            nombre: d.nombre,
            titulo: d.titulo,
            subtitulo: d.subtitulo,
            duracionMin: d.duracionMin,
            descansoDefectoS: d.descansoDefectoS,
            progresion: d.progresion,
            notas: d.notas,
          })
          .where(and(eq(routineDays.id, d.id), eq(routineDays.routineId, input.routineId)));
      }
    }
    for (const [i, d] of input.dias.entries()) {
      await tx
        .update(routineDays)
        .set({ orden: i })
        .where(and(eq(routineDays.id, d.id), eq(routineDays.routineId, input.routineId)));
    }

    // ── Ejercicios ───────────────────────────────────────────────────────
    for (const d of input.dias) {
      const tope = d.ejercicios.length + 1000;

      for (const [j, e] of d.ejercicios.entries()) {
        const presc = {
          series: Math.min(8, Math.max(1, e.series)),
          tipo: e.tipo,
          reps: e.reps.trim() || (e.tipo === "tiempo" ? "30 s" : "10"),
          ...parsearCarga(e.carga),
        };

        if (e.nuevo) {
          await tx
            .insert(routineExercises)
            .values({ id: e.id, routineDayId: d.id, exerciseId: e.exerciseId, orden: tope + j, ...presc });
        } else {
          await tx
            .update(routineExercises)
            .set({ orden: tope + j, ...presc })
            .where(and(eq(routineExercises.id, e.id), eq(routineExercises.routineDayId, d.id)));
        }
      }
      for (const [j, e] of d.ejercicios.entries()) {
        await tx
          .update(routineExercises)
          .set({ orden: j })
          .where(and(eq(routineExercises.id, e.id), eq(routineExercises.routineDayId, d.id)));
      }
    }
  });

  revalidatePath(`/rutinas/${input.routineId}`);
  revalidatePath("/rutinas");
  return { ok: true as const };
}

/**
 * Añade un ejercicio a un día, desde la biblioteca.
 *
 * A diferencia de `guardarRutina`, esto escribe en el acto: no hay una
 * sesión de edición más larga detrás que "Cancelar" pueda descartar, solo
 * una decisión (a qué día) que ya se tomó al elegirlo en el diálogo. La
 * prescripción sale con los valores por defecto de la tabla, como cualquier
 * alta desde el picker del editor — se ajusta después, ahí mismo.
 *
 * El orden es el conteo de lo que ya hay en el día: mismo criterio que usa
 * el editor en local (`dia.ejercicios.length`) antes de guardar.
 */
export async function agregarEjercicioARutina(routineDayId: string, exerciseId: string) {
  const dia = await diaPropio(routineDayId);
  const user = await getCurrentUser();

  // Público o mío: lo mismo que decide qué se ve en /ejercicios. Sin esto,
  // el id de un ejercicio privado ajeno se podría colar a mano.
  const ejercicio = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, exerciseId),
      or(eq(exercises.esPublico, true), eq(exercises.createdBy, user.id)),
    ),
  });
  if (!ejercicio) throw new Error("Ese ejercicio no existe o no podés verlo.");

  const [{ n }] = await db
    .select({ n: count() })
    .from(routineExercises)
    .where(eq(routineExercises.routineDayId, routineDayId));

  await db.insert(routineExercises).values({ routineDayId, exerciseId, orden: n });

  revalidatePath(`/rutinas/${dia.routineId}`);
  revalidatePath(`/rutinas/${dia.routineId}/editar`);
  revalidatePath("/ejercicios");

  return { ok: true as const, dia: dia.titulo };
}

// ── Asignaciones ──────────────────────────────────────────────────────────

/**
 * Asigna una rutina a un alumno y cierra el plan que tuviera abierto.
 *
 * Las dos cosas van en la misma transacción a propósito. El índice único solo
 * impide repetir la *misma* rutina viva, así que dejar la anterior abierta
 * dejaría al alumno con dos planes y `getPlanActivo()` eligiendo por
 * `started_on` — con empate el mismo día, arbitrariamente.
 */
export async function asignarRutina(routineId: string, clientId: string) {
  const coach = await getCurrentUser();

  if (!esEntrenador(coach)) {
    throw new Error("Solo un entrenador puede asignar rutinas.");
  }

  // El alumno tiene que ser suyo.
  const alumno = await db.query.users.findFirst({
    where: and(eq(users.id, clientId), eq(users.coachId, coach.id)),
  });
  if (!alumno) throw new Error("Ese alumno no es tuyo o no existe.");

  // La rutina, suya o escrita por él: en el prototipo los planes del
  // entrenador quedan a nombre del alumno (`owner_id`) y con el entrenador en
  // `author_id`, así que valen las dos vías.
  const rutina = await db.query.routines.findFirst({
    where: and(
      eq(routines.id, routineId),
      or(eq(routines.ownerId, coach.id), eq(routines.authorId, coach.id)),
    ),
  });
  if (!rutina) throw new Error("Esa rutina no es tuya.");

  const dias = await db
    .select({ n: count() })
    .from(routineDays)
    .where(eq(routineDays.routineId, routineId));

  if ((dias[0]?.n ?? 0) === 0) {
    throw new Error("Esa rutina no tiene días todavía: el alumno no podría entrenar.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(assignments)
      .set({ endedOn: sql`current_date` })
      .where(and(eq(assignments.clientId, clientId), isNull(assignments.endedOn)));

    await tx.insert(assignments).values({
      routineId,
      coachId: coach.id,
      clientId,
    });
  });

  // La asignación mueve el inicio del alumno, /entrenar y el panel del coach.
  revalidatePath("/", "layout");
  return { ok: true as const, plan: rutina.nombre, alumno: alumno.nombre };
}

// ── Catálogo de ejercicios ────────────────────────────────────────────────

export type EjercicioNuevo = {
  id: string;
  nombre: string;
  grupo: string;
  equipo: string;
  descripcion: string;
  imagenUrl: string | null;
  fedbId: string | null;
  nombreEn: string | null;
  esPublico: boolean;
  esMio: boolean;
};

const DESCRIPCION_MAX = 2000;

/**
 * La descripción tal como se guarda. Al revés que el nombre, aquí los saltos
 * de línea son contenido —separan los pasos— y no se aplastan: solo se
 * normalizan los de Windows, se recortan los bordes y se limita a un párrafo
 * en blanco seguido.
 */
function limpiarDescripcion(texto: string) {
  const descripcion = texto
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (descripcion.length > DESCRIPCION_MAX) {
    throw new Error(`La descripción no puede pasar de ${DESCRIPCION_MAX} caracteres.`);
  }
  return descripcion;
}

/**
 * Alta de un ejercicio del usuario.
 *
 * Nace privado a propósito: el índice único de `exercises` solo cubre los
 * públicos (`... WHERE es_publico`), así que lo privado puede repetir nombre
 * sin chocar con el catálogo común ni con el de otro usuario. Publicar uno es
 * una decisión aparte que hoy no existe.
 */
export async function crearEjercicio(input: {
  nombre: string;
  grupo: string;
  equipo: string;
  descripcion?: string;
  /** Enlace al catálogo externo, si se eligió uno en el alta. */
  fedbId?: string | null;
}): Promise<EjercicioNuevo> {
  const user = await getCurrentUser();

  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  const equipo = input.equipo.trim().replace(/\s+/g, " ");

  if (nombre.length < 2) throw new Error("Poné un nombre de al menos dos letras.");
  if (equipo.length < 2) throw new Error("Indicá con qué se hace (barra, mancuernas, polea…).");

  const grupos: readonly string[] = muscleGroup.enumValues;
  if (!grupos.includes(input.grupo)) throw new Error("Ese grupo muscular no existe.");
  const grupo = input.grupo as (typeof muscleGroup.enumValues)[number];

  // Duplicado contra lo que este usuario ya ve: el catálogo común y lo suyo.
  // La base solo impide repetir entre públicos, así que esto lo cubre.
  const repetido = await nombreRepetido({
    nombre,
    duenoId: user.id,
    esPublicoDestino: false,
  });

  if (repetido) throw new Error(`Ya existe un ejercicio llamado «${nombre}».`);

  const enlace = resolverEnlace(input.fedbId ?? undefined, { fedbId: null, nombreEn: null });
  const descripcion = limpiarDescripcion(input.descripcion ?? "");

  const [fila] = await db
    .insert(exercises)
    .values({
      nombre,
      grupo,
      equipo,
      descripcion,
      esPublico: false,
      createdBy: user.id,
      ...enlace,
    })
    .returning();

  revalidatePath("/ejercicios");

  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: fila.grupo,
    equipo: fila.equipo,
    descripcion: fila.descripcion,
    imagenUrl: fila.imagenUrl,
    fedbId: fila.fedbId,
    nombreEn: fila.nombreEn,
    esPublico: fila.esPublico,
    esMio: true,
  };
}

/**
 * El ejercicio, si este usuario puede tocarlo. Si no, corta.
 *
 * Dos permisos distintos con la misma puerta:
 *
 *   · Cualquiera puede editar y borrar **lo suyo y privado**. Es su rincón del
 *     catálogo y nadie más lo ve.
 *   · Un **admin puede tocar cualquiera**, el catálogo común incluido. Es la
 *     única forma de arreglar una errata o una foto mal enlazada de una fila
 *     que no tiene dueño (`created_by` es NULL en todo lo que vino del seed),
 *     y hasta ahora había que entrar por SQL.
 *
 * Devuelve también `esComun` para que quien llama sepa que está tocando algo
 * que ve todo el mundo, y pueda avisar antes en vez de después.
 */
async function ejercicioEditable(exerciseId: string) {
  const user = await getCurrentUser();

  const fila = await db.query.exercises.findFirst({ where: eq(exercises.id, exerciseId) });
  if (!fila) throw new Error("Ese ejercicio no existe.");

  const admin = esAdmin(user);
  if (!admin) {
    if (fila.createdBy !== user.id) throw new Error("Ese ejercicio no es tuyo o no existe.");
    if (fila.esPublico) throw new Error("Los ejercicios del catálogo común no se tocan.");
  }

  return { fila, user, admin, esComun: fila.esPublico };
}

/**
 * Nombre repetido entre lo que se vería junto.
 *
 * El índice único de la base solo cubre los públicos, así que la comprobación
 * se hace aquí y **desde el punto de vista del dueño de la fila**, no de quien
 * edita: cuando un admin corrige el ejercicio privado de otra persona, lo que
 * no puede repetirse es contra el catálogo común y contra lo de *esa* persona.
 *
 * `esPublicoDestino` es lo que la fila va a ser al terminar, no lo que es
 * ahora: al publicar hay que mirar contra todos los públicos aunque hoy sea
 * privada, que es justo el choque que da el índice parcial.
 */
async function nombreRepetido(opts: {
  nombre: string;
  excluirId?: string;
  duenoId: string | null;
  esPublicoDestino: boolean;
}) {
  const visiblesJunto = opts.esPublicoDestino
    ? eq(exercises.esPublico, true)
    : or(
        eq(exercises.esPublico, true),
        opts.duenoId ? eq(exercises.createdBy, opts.duenoId) : undefined,
      );

  const [choque] = await db
    .select({ id: exercises.id, esPublico: exercises.esPublico })
    .from(exercises)
    .where(
      and(
        sql`lower(${exercises.nombre}) = lower(${opts.nombre})`,
        opts.excluirId ? sql`${exercises.id} <> ${opts.excluirId}` : undefined,
        visiblesJunto,
      ),
    )
    .limit(1);

  return choque ?? null;
}

/**
 * Renombrar o recolocar un ejercicio propio.
 *
 * Se permite aunque esté en uso: `routine_exercises` y `set_logs` apuntan por
 * id, así que corregir una errata arregla el nombre en todas partes a la vez —
 * que es justo por qué el catálogo es una tabla y no texto suelto.
 */
export async function editarEjercicio(
  exerciseId: string,
  input: {
    nombre: string;
    grupo: string;
    equipo: string;
    /** `''` la borra; `undefined` la deja como estaba. */
    descripcion?: string;
    /** `null` desenlaza y lo deja sin foto; `undefined` no toca el enlace. */
    fedbId?: string | null;
    /** Solo lo puede mandar un admin; `undefined` no toca la visibilidad. */
    esPublico?: boolean;
  },
): Promise<EjercicioNuevo> {
  const { fila: antes, user, admin } = await ejercicioEditable(exerciseId);

  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  const equipo = input.equipo.trim().replace(/\s+/g, " ");

  if (nombre.length < 2) throw new Error("Poné un nombre de al menos dos letras.");
  if (equipo.length < 2) throw new Error("Indicá con qué se hace (barra, mancuernas, polea…).");

  const grupos: readonly string[] = muscleGroup.enumValues;
  if (!grupos.includes(input.grupo)) throw new Error("Ese grupo muscular no existe.");
  const grupo = input.grupo as (typeof muscleGroup.enumValues)[number];

  // Publicar y despublicar es cosa de admin. Se ignora en silencio para el
  // resto en vez de reventar: el formulario ni siquiera les enseña el control,
  // así que si llega es porque alguien lo mandó a mano.
  const esPublico = admin && input.esPublico !== undefined ? input.esPublico : antes.esPublico;

  // Despublicar algo sin dueño lo dejaría invisible para todos, admin incluido:
  // `getEjercicios()` filtra por público-o-mío, y `created_by` es NULL en todo
  // lo que vino del seed. En vez de negarlo, lo adopta quien lo despublica —
  // así sigue existiendo, en su biblioteca, y se puede volver a publicar.
  const adoptaHuerfano = antes.esPublico && !esPublico && antes.createdBy === null;
  const createdBy = adoptaHuerfano ? user.id : antes.createdBy;

  const choque = await nombreRepetido({
    nombre,
    excluirId: exerciseId,
    duenoId: createdBy,
    esPublicoDestino: esPublico,
  });

  if (choque) {
    throw new Error(
      esPublico && !antes.esPublico
        ? `No se puede publicar: ya hay un ejercicio público llamado «${nombre}».`
        : `Ya existe un ejercicio llamado «${nombre}».`,
    );
  }

  // El enlace al catálogo arrastra el nombre en inglés y los músculos: son
  // suyos, no nuestros, así que se copian de él y nunca se escriben a mano.
  const enlace = resolverEnlace(input.fedbId, antes);

  const descripcion =
    input.descripcion === undefined ? antes.descripcion : limpiarDescripcion(input.descripcion);

  const [fila] = await db
    .update(exercises)
    .set({ nombre, grupo, equipo, descripcion, esPublico, createdBy, ...enlace })
    .where(eq(exercises.id, exerciseId))
    .returning();

  // El nombre viaja a las rutinas y al historial, que lo leen por join.
  revalidatePath("/", "layout");

  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: fila.grupo,
    equipo: fila.equipo,
    descripcion: fila.descripcion,
    imagenUrl: fila.imagenUrl,
    fedbId: fila.fedbId,
    nombreEn: fila.nombreEn,
    esPublico: fila.esPublico,
    esMio: fila.createdBy === user.id,
  };
}

/**
 * Qué columnas del catálogo externo escribir según lo que llegue del
 * formulario. Los tres casos son distintos y conviene tenerlos a la vista:
 *
 *   `undefined` → no se tocó el enlace; se deja como estaba.
 *   `null`      → se desenlazó a mano; se limpia todo y vuelve al placeholder.
 *   un id       → se copian nombre en inglés y músculos desde el catálogo.
 */
function resolverEnlace(
  fedbId: string | null | undefined,
  antes: { fedbId: string | null; nombreEn: string | null },
) {
  if (fedbId === undefined) return {};
  if (fedbId === null) {
    return { fedbId: null, nombreEn: null, musculosPrimarios: null, musculosSecundarios: null };
  }

  const entrada = entradaDeCatalogo(fedbId);
  if (!entrada) throw new Error("Ese ejercicio del catálogo externo no existe.");

  return {
    fedbId: entrada.id,
    nombreEn: entrada.name,
    musculosPrimarios: entrada.primarios,
    musculosSecundarios: entrada.secundarios,
  };
}

/**
 * Buscador del catálogo externo para el formulario.
 *
 * Es una server action y no un import del cliente por una razón concreta: el
 * catálogo son 139 KB y tiene que quedarse en el servidor. Lo que viaja al
 * navegador son los ocho resultados.
 */
export async function buscarCatalogo(termino: string) {
  await getCurrentUser();

  const t = termino.trim();
  if (t.length < 3) return [];

  return buscarEnCatalogo(t).map((e) => ({
    id: e.id,
    nombre: e.name,
    primarios: e.primarios,
    secundarios: e.secundarios,
  }));
}

/**
 * Borra un ejercicio propio, solo si no lo usa nadie.
 *
 * La base ya lo protege con ON DELETE RESTRICT en `routine_exercises` y
 * `set_logs`; esto lo comprueba antes para poder decir en qué está metido en
 * vez de soltar una violación de clave ajena.
 */
export async function borrarEjercicio(exerciseId: string) {
  await ejercicioEditable(exerciseId);

  const [uso] = await db.execute<{ rutinas: string; series: string }>(sql`
    SELECT (SELECT count(DISTINCT d.routine_id)
              FROM routine_exercises re
              JOIN routine_days d ON d.id = re.routine_day_id
             WHERE re.exercise_id = ${exerciseId})::text AS rutinas,
           (SELECT count(*) FROM set_logs l WHERE l.exercise_id = ${exerciseId})::text AS series
  `).then((r) => r.rows);

  const rutinas = Number(uso?.rutinas ?? 0);
  const series = Number(uso?.series ?? 0);

  if (rutinas > 0 || series > 0) {
    const partes = [
      rutinas > 0 && `está en ${rutinas} ${rutinas === 1 ? "rutina" : "rutinas"}`,
      series > 0 && `tiene ${series} ${series === 1 ? "serie registrada" : "series registradas"}`,
    ].filter(Boolean);

    throw new Error(
      `No se puede borrar: ${partes.join(" y ")}. Quitalo de ahí primero o dejalo como está.`,
    );
  }

  await db.delete(exercises).where(eq(exercises.id, exerciseId));

  revalidatePath("/ejercicios");
  return { ok: true as const };
}

/**
 * Cómo llama este usuario a un ejercicio.
 *
 * No toca el catálogo: es una fila aparte que solo ve quien la puso, más sus
 * alumnos dentro de las rutinas que él escribió. Devolver el alias vacío lo
 * quita, y entonces se vuelve a ver el nombre del catálogo.
 *
 * No pasa por `ejercicioEditable()` a propósito. Esa puerta es para *modificar
 * el catálogo* —lo propio y privado, o cualquier cosa si sos admin— y aquí no
 * se modifica el catálogo: cualquiera puede ponerle su nombre a una fila común,
 * que es justo el caso principal.
 */
export async function guardarAlias(exerciseId: string, entrada: string) {
  const user = await getCurrentUser();

  // Mismo criterio de visibilidad que `getEjercicios()`. Sin esto, poner alias
  // a un id ajeno sería una forma de confirmar que existe el ejercicio privado
  // de otra persona.
  const [ejercicio] = await db
    .select({ id: exercises.id, nombre: exercises.nombre })
    .from(exercises)
    .where(
      and(
        eq(exercises.id, exerciseId),
        or(eq(exercises.esPublico, true), eq(exercises.createdBy, user.id)),
      ),
    )
    .limit(1);

  if (!ejercicio) throw new Error("Ese ejercicio no existe.");

  const alias = entrada.trim().replace(/\s+/g, " ");
  const propio = and(
    eq(exerciseAliases.userId, user.id),
    eq(exerciseAliases.exerciseId, exerciseId),
  );

  // Vaciar el campo quita el alias. Escribir el nombre del catálogo tal cual,
  // también: guardarlo solo añadiría una línea gris repitiendo lo de arriba.
  const quitar = alias === "" || alias.toLowerCase() === ejercicio.nombre.toLowerCase();

  if (quitar) {
    await db.delete(exerciseAliases).where(propio);
  } else {
    if (alias.length < 2) throw new Error("Poné un nombre de al menos dos letras.");
    if (alias.length > 80) throw new Error("Ese nombre es demasiado largo.");

    await db
      .insert(exerciseAliases)
      .values({ userId: user.id, exerciseId, alias })
      .onConflictDoUpdate({
        target: [exerciseAliases.userId, exerciseAliases.exerciseId],
        set: { alias },
      });
  }

  // El nombre viaja a la biblioteca, las rutinas, la sesión y el progreso.
  revalidatePath("/", "layout");

  return { alias: quitar ? null : alias };
}

// ── Sesión ────────────────────────────────────────────────────────────────
//
// El proveedor es Supabase Auth, el mismo que tempo_mobile. Estas acciones son
// lo único que escribe la cookie de sesión: durante el render de un Server
// Component ya no se pueden tocar cabeceras.

export type EstadoAuth = { error: string } | null;

/**
 * Los mensajes de Supabase vienen en inglés y la app entera está en es-ES.
 * Lo que no esté en la tabla se muestra tal cual antes que tragarse el error.
 */
function traducirError(mensaje: string): string {
  const tabla: Record<string, string> = {
    "Invalid login credentials": "Email o contraseña incorrectos.",
    "Email not confirmed": "Confirmá tu email antes de entrar.",
    "User already registered": "Ya existe una cuenta con ese email.",
    "Password should be at least 6 characters.":
      "La contraseña necesita al menos 6 caracteres.",
    "Unable to validate email address: invalid format": "Ese email no es válido.",
    "Signup requires a valid password": "Escribí una contraseña.",
  };
  return tabla[mensaje] ?? mensaje;
}

/**
 * A dónde ir después de entrar.
 *
 * `volver` sale de la query string, que la escribe quien quiera: sin este
 * filtro, un enlace a /login?volver=https://otro.sitio convierte el login en
 * un redirector abierto. Solo se aceptan rutas internas, y `//` queda fuera
 * porque el navegador lo lee como protocolo relativo.
 */
function destino(volver: FormDataEntryValue | null): string {
  const ruta = typeof volver === "string" ? volver : "";
  return ruta.startsWith("/") && !ruta.startsWith("//") ? ruta : "/";
}

export async function iniciarSesion(
  _prev: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Completá email y contraseña." };

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: traducirError(error.message) };

  // La cabecera y la barra de pestañas dependen del usuario: sin esto se
  // sirven desde el caché del router con la sesión anterior.
  revalidatePath("/", "layout");
  redirect(destino(formData.get("volver")));
}

/**
 * Alta de cuenta.
 *
 * La fila de `users` no se inserta aquí: la crea el trigger
 * `on_auth_user_created` a partir de `raw_user_meta_data`, igual que en el
 * móvil. Duplicarlo desde la app abriría la puerta a que un alta se quede a
 * medias si falla la segunda escritura.
 */
export async function registrarse(
  _prev: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!email || !password || !nombre) {
    return { error: "Completá nombre, email y contraseña." };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

  if (error) return { error: traducirError(error.message) };

  // Con la confirmación por email activada no hay sesión todavía: la cuenta
  // existe pero no se entra hasta pulsar el enlace del correo.
  if (!data.session) {
    return { error: "Cuenta creada. Revisá tu email para confirmarla y volvé a entrar." };
  }

  revalidatePath("/", "layout");
  redirect(destino(formData.get("volver")));
}

export async function cerrarSesion() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Invitaciones de entrenador ────────────────────────────────────────────
//
// `users.coach_id` no se escribe en ningún otro sitio. El vínculo lo hacen las
// dos partes: el entrenador genera un código y el alumno lo canjea, así que
// nadie acaba con entrenador sin haber escrito nada.

/**
 * Sin 0/O ni 1/I/L: el código se dicta en voz alta o se copia de una pantalla,
 * y esos pares se confunden. 31 símbolos en 8 huecos son de sobra.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LARGO_CODIGO = 8;
const DIAS_VALIDEZ = 7;

function generarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

/** Como lo teclee quien lo recibe: con guiones, en minúscula o con espacios. */
function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** El usuario actual, si puede repartir invitaciones. Si no, corta. */
async function entrenadorActual() {
  const user = await getCurrentUser();
  if (!esEntrenador(user)) throw new Error("Solo un entrenador puede invitar alumnos");
  return user;
}

export async function crearInvitacion() {
  const coach = await entrenadorActual();

  const expiresAt = new Date(Date.now() + DIAS_VALIDEZ * 24 * 60 * 60 * 1000);

  // El índice único es quien decide: si dos peticiones sacan el mismo código,
  // una de las dos falla y se reintenta. Comprobar antes con un SELECT no
  // cerraría la ventana entre la lectura y el INSERT.
  for (let intento = 0; intento < 5; intento++) {
    try {
      const [invitacion] = await db
        .insert(coachInvites)
        .values({ codigo: generarCodigo(), coachId: coach.id, expiresAt })
        .returning();

      revalidatePath("/coach");
      return { codigo: invitacion.codigo };
    } catch (e) {
      const duplicado = e instanceof Error && e.message.includes("coach_invites_codigo");
      if (!duplicado) throw e;
    }
  }
  throw new Error("No se pudo generar un código libre. Probá otra vez.");
}

/** Solo se revocan los que no se han usado: un canje ya hecho es historial. */
export async function revocarInvitacion(invitacionId: string) {
  const coach = await entrenadorActual();

  const borradas = await db
    .delete(coachInvites)
    .where(
      and(
        eq(coachInvites.id, invitacionId),
        eq(coachInvites.coachId, coach.id),
        isNull(coachInvites.usedAt),
      ),
    )
    .returning();

  if (borradas.length === 0) throw new Error("Ese código no existe o ya se usó");

  revalidatePath("/coach");
  return { ok: true as const };
}

/**
 * Canjear un código: vincula al usuario actual con quien lo generó.
 *
 * Se lee primero para poder decir *por qué* no sirve, y se escribe después con
 * un UPDATE condicionado a `used_at IS NULL`. Esa condición es la que resuelve
 * la carrera: si dos personas canjean a la vez, el segundo UPDATE no toca nada
 * y se lleva el error.
 */
export async function canjearInvitacion(entrada: string) {
  const user = await getCurrentUser();
  const codigo = normalizarCodigo(entrada);

  if (!codigo) throw new Error("Escribí un código");

  const invitacion = await db.query.coachInvites.findFirst({
    where: eq(coachInvites.codigo, codigo),
  });

  if (!invitacion) throw new Error("Ese código no existe");
  if (invitacion.usedAt) throw new Error("Ese código ya se usó");
  if (invitacion.expiresAt.getTime() <= Date.now()) throw new Error("Ese código caducó");
  if (invitacion.coachId === user.id) throw new Error("No podés ser tu propio entrenador");
  if (user.coachId === invitacion.coachId) throw new Error("Ya es tu entrenador");

  const coach = await db.query.users.findFirst({ where: eq(users.id, invitacion.coachId) });
  if (!coach) throw new Error("El entrenador de ese código ya no existe");

  await db.transaction(async (tx) => {
    const gastadas = await tx
      .update(coachInvites)
      .set({ usedAt: new Date(), usedBy: user.id })
      .where(and(eq(coachInvites.id, invitacion.id), isNull(coachInvites.usedAt)))
      .returning();

    if (gastadas.length === 0) throw new Error("Ese código ya se usó");

    // Cambiar de entrenador no toca el historial ni las asignaciones: el plan
    // que estuviera activo sigue donde está.
    await tx.update(users).set({ coachId: invitacion.coachId }).where(eq(users.id, user.id));
  });

  revalidatePath("/coach");
  revalidatePath("/", "layout");
  return { ok: true as const, coach: coach.nombre };
}

// ── Administración ────────────────────────────────────────────────────────

async function adminActual() {
  const user = await getCurrentUser();
  if (!esAdmin(user)) throw new Error("Solo un administrador puede hacer esto");
  return user;
}

/**
 * Cambiar el rol de otra persona.
 *
 * No se puede tocar el rol propio: el único camino a admin es un UPDATE a mano
 * en la base, así que un admin que se degrade a sí mismo puede dejar la
 * instalación sin nadie que pueda repartir roles.
 */
export async function cambiarRol(userId: string, role: "alumno" | "entrenador" | "admin") {
  const admin = await adminActual();

  if (userId === admin.id) throw new Error("No podés cambiar tu propio rol");

  const objetivo = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!objetivo) throw new Error("Ese usuario no existe");

  // Degradar a un entrenador con alumnos los dejaría apuntando a alguien que ya
  // no puede asignarles nada. Se corta y se dice, en vez de desvincularlos por
  // nuestra cuenta.
  if (objetivo.role !== "alumno" && role === "alumno") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(users)
      .where(eq(users.coachId, userId));

    if (n > 0) {
      throw new Error(
        `${objetivo.nombre} tiene ${n} ${n === 1 ? "alumno" : "alumnos"}. Reasignalos antes de quitarle el rol.`,
      );
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Un usuario inactivo desaparece del panel del entrenador; no se borra nada. */
export async function cambiarActivo(userId: string, activo: boolean) {
  const admin = await adminActual();

  if (userId === admin.id) throw new Error("No podés desactivarte a vos mismo");

  await db.update(users).set({ activo }).where(eq(users.id, userId));

  revalidatePath("/admin");
  return { ok: true as const };
}

/**
 * Romper el vínculo entrenador ↔ alumno. Dos acciones porque son dos actores
 * con dos guardas distintas, aunque el efecto en la base sea el mismo.
 *
 * **El plan activo no se toca.** Cerrar la asignación dejaría al alumno con una
 * rutina a su nombre (`routines.owner_id` es él) que no puede volver a activar:
 * `asignarRutina()` exige ser entrenador, así que se quedaría sin nada que
 * entrenar y sin forma de arreglarlo. El vínculo se corta, el plan sigue.
 *
 * `assignments` tampoco se limpia: es historial, y ahí consta quién asignó qué
 * y cuándo aunque esa persona ya no lo entrene.
 */
async function romperVinculo(clientId: string) {
  await db.update(users).set({ coachId: null }).where(eq(users.id, clientId));

  revalidatePath("/coach");
  revalidatePath("/", "layout");
}

/** El entrenador suelta a un alumno suyo. */
export async function desvincularAlumno(clientId: string) {
  const coach = await entrenadorActual();

  const alumno = await db.query.users.findFirst({
    where: and(eq(users.id, clientId), eq(users.coachId, coach.id)),
  });
  if (!alumno) throw new Error("Ese alumno no es tuyo o no existe.");

  await romperVinculo(clientId);
  return { ok: true as const, nombre: alumno.nombre };
}

/** El alumno se va de su entrenador. */
export async function dejarEntrenador() {
  const user = await getCurrentUser();

  if (!user.coachId) throw new Error("No tenés entrenador.");

  await romperVinculo(user.id);
  return { ok: true as const };
}

// ── Plan propio ───────────────────────────────────────────────────────────

/**
 * "Usar como mi plan": activa una rutina propia sin pasar por un entrenador.
 *
 * La asignación se escribe con `coach_id = NULL`, que es lo que distingue un
 * plan propio de uno asignado. Así `getPlanActivo()` —y con él /entrenar, la
 * home, la adherencia y el próximo día— sigue leyendo de un solo sitio, con o
 * sin entrenador de por medio.
 *
 * Cierra el plan anterior en la misma transacción, igual que `asignarRutina()`:
 * el índice único solo impide repetir la *misma* rutina viva, así que sin ese
 * cierre el alumno acabaría con dos planes abiertos y `getPlanActivo()`
 * eligiendo por `started_on`.
 */
export async function usarComoMiPlan(routineId: string) {
  const user = await getCurrentUser();

  // Tiene que ser suya: una rutina que te asignaron ya viene con su asignación,
  // y una ajena no es tuya para activarla.
  const rutina = await db.query.routines.findFirst({
    where: and(eq(routines.id, routineId), eq(routines.ownerId, user.id)),
  });
  if (!rutina) throw new Error("Esa rutina no es tuya o no existe.");

  const [{ n }] = await db
    .select({ n: count() })
    .from(routineDays)
    .where(eq(routineDays.routineId, routineId));

  if (n === 0) {
    throw new Error("Esa rutina no tiene días todavía: no podrías entrenar.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(assignments)
      .set({ endedOn: sql`current_date` })
      .where(and(eq(assignments.clientId, user.id), isNull(assignments.endedOn)));

    await tx.insert(assignments).values({
      routineId,
      coachId: null,
      clientId: user.id,
    });
  });

  revalidatePath("/");
  revalidatePath("/entrenar");
  revalidatePath(`/rutinas/${routineId}`);
  return { ok: true as const };
}
