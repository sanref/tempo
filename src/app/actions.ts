"use server";

import { and, asc, count, desc, eq, isNull, max, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assignments,
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
import { esEntrenador, getCurrentUser } from "@/lib/auth";
import { repsPlanificadas, segundosPlanificados } from "@/lib/format";

/**
 * Mutaciones. Todas verifican que la fila pertenece al usuario actual: hoy la
 * sesión es mockeada, pero el día que entre auth real esto ya está cerrado.
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

export async function empezarSesion(routineDayId?: string) {
  const user = await getCurrentUser();

  // Nunca abrir dos: si hay una en curso, se reanuda.
  const enCurso = await getSesionEnCurso(user.id);
  if (enCurso) redirect(`/entrenar/${enCurso}`);

  const dia = routineDayId
    ? await db.query.routineDays.findFirst({ where: eq(routineDays.id, routineDayId) })
    : await getProximoDia(user.id).then((d) =>
        d ? db.query.routineDays.findFirst({ where: eq(routineDays.id, d.id) }) : undefined,
      );

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
    const filas = ejercicios.flatMap((e, bloque) =>
      Array.from({ length: e.series }, (_, i) => ({
        sessionId: sesion.id,
        exerciseId: e.exerciseId,
        routineExerciseId: e.id,
        bloque,
        orden: i + 1,
        kg: e.cargaKg ?? "0",
        reps: e.tipo === "tiempo" ? 0 : repsPlanificadas(e.reps),
        segundos: e.tipo === "tiempo" ? segundosPlanificados(e.reps) : null,
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

export async function terminarSesion(sesionId: string) {
  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Sesión no encontrada");

  await db.transaction(async (tx) => {
    // Las series que quedaron sin confirmar no se guardan como hechas.
    await tx
      .update(workoutSessions)
      .set({ status: "terminada", endedAt: new Date() })
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
export async function guardarCorreccion(sesionId: string) {
  const user = await getCurrentUser();

  const sesion = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, user.id)),
  });
  if (!sesion) throw new Error("Entrenamiento no encontrado");

  await db.transaction(async (tx) => {
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
 * Editor: renombrar la rutina y ajustar series / ajustes del día.
 *
 * `routineDayId` es opcional porque la rutina puede quedarse sin días si se
 * borran todos; en ese caso solo se guarda el nombre.
 */
export async function guardarDia(input: {
  routineId: string;
  routineDayId?: string;
  nombreRutina: string;
  descansoDefectoS: number;
  progresion: "lineal" | "doble" | "manual";
  notas: string;
  /** La prescripción de cada ejercicio del día. */
  series: {
    id: string;
    series: number;
    tipo: "reps" | "tiempo";
    reps: string;
    /** Texto tal cual lo escribe el entrenador; vacío = sin carga fijada. */
    carga: string;
  }[];
}) {
  const rutina = await rutinaPropia(input.routineId);
  const routineDayId = input.routineDayId;

  await db.transaction(async (tx) => {
    await tx
      .update(routines)
      .set({ nombre: input.nombreRutina.trim() || rutina.nombre })
      .where(eq(routines.id, input.routineId));

    if (!routineDayId) return;

    await tx
      .update(routineDays)
      .set({
        descansoDefectoS: input.descansoDefectoS,
        progresion: input.progresion,
        notas: input.notas,
      })
      .where(eq(routineDays.id, routineDayId));

    for (const s of input.series) {
      await tx
        .update(routineExercises)
        .set({
          series: Math.min(8, Math.max(1, s.series)),
          tipo: s.tipo,
          reps: s.reps.trim() || (s.tipo === "tiempo" ? "30 s" : "10"),
          ...parsearCarga(s.carga),
        })
        .where(and(eq(routineExercises.id, s.id), eq(routineExercises.routineDayId, routineDayId)));
    }
  });

  revalidatePath(`/rutinas/${input.routineId}`);
  redirect(`/rutinas/${input.routineId}`);
}

/** Reordenar ejercicios de un día (drag & drop o teclado). */
export async function reordenarEjercicios(routineDayId: string, idsEnOrden: string[]) {
  await diaPropio(routineDayId);

  await db.transaction(async (tx) => {
    // Dos pasadas: el índice único (día, orden) no admite estados intermedios.
    const [{ tope }] = await tx
      .select({ tope: max(routineExercises.orden) })
      .from(routineExercises)
      .where(eq(routineExercises.routineDayId, routineDayId))
      .then((r) => (r.length ? r : [{ tope: 0 }]));

    const offset = (tope ?? 0) + 1;

    for (const [i, id] of idsEnOrden.entries()) {
      await tx
        .update(routineExercises)
        .set({ orden: offset + i })
        .where(eq(routineExercises.id, id));
    }
    for (const [i, id] of idsEnOrden.entries()) {
      await tx.update(routineExercises).set({ orden: i }).where(eq(routineExercises.id, id));
    }
  });

  revalidatePath("/rutinas");
}

// ── Editor: ejercicios de un día ──────────────────────────────────────────

/**
 * Añade un ejercicio del catálogo al final del día.
 *
 * Escribe en el acto, como "+ Añadir serie" en la sesión: hace falta el id que
 * genera la base para poder reordenarlo o quitarlo sin recargar. Devuelve la
 * fila ya montada con nombre y equipo para que el editor la pinte sin ir otra
 * vez al servidor.
 */
export async function anadirEjercicio(
  routineDayId: string,
  exerciseId: string,
): Promise<DiaConEjercicios["ejercicios"][number]> {
  const dia = await diaPropio(routineDayId);

  const ejercicio = await db.query.exercises.findFirst({ where: eq(exercises.id, exerciseId) });
  if (!ejercicio) throw new Error("Ese ejercicio no está en el catálogo");

  const [{ tope }] = await db
    .select({ tope: max(routineExercises.orden) })
    .from(routineExercises)
    .where(eq(routineExercises.routineDayId, routineDayId));

  const [fila] = await db
    .insert(routineExercises)
    .values({ routineDayId, exerciseId, orden: (tope ?? -1) + 1 })
    .returning();

  revalidatePath(`/rutinas/${dia.routineId}`);

  return {
    id: fila.id,
    exerciseId: fila.exerciseId,
    orden: fila.orden,
    nombre: ejercicio.nombre,
    equipo: ejercicio.equipo,
    series: fila.series,
    tipo: fila.tipo,
    reps: fila.reps,
    cargaKg: fila.cargaKg,
    cargaTexto: fila.cargaTexto,
    descansoS: fila.descansoS,
  };
}

/**
 * Quita un ejercicio del día.
 *
 * No toca el historial: `set_logs.routine_exercise_id` es ON DELETE SET NULL y
 * cada serie registrada guarda además su `exercise_id`, así que el progreso
 * por ejercicio sigue saliendo aunque la rutina cambie.
 *
 * Los huecos que deja en `orden` no importan: se lee ordenado y el siguiente
 * "Guardar" recompacta con `reordenarEjercicios`.
 */
export async function quitarEjercicio(routineExerciseId: string) {
  const user = await getCurrentUser();

  const [fila] = await db
    .select({ routineId: routines.id })
    .from(routineExercises)
    .innerJoin(routineDays, eq(routineDays.id, routineExercises.routineDayId))
    .innerJoin(routines, eq(routines.id, routineDays.routineId))
    .where(and(eq(routineExercises.id, routineExerciseId), eq(routines.ownerId, user.id)))
    .limit(1);

  if (!fila) throw new Error("Ejercicio no encontrado o sin permisos");

  await db.delete(routineExercises).where(eq(routineExercises.id, routineExerciseId));

  revalidatePath(`/rutinas/${fila.routineId}`);
  return { ok: true as const };
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
  imagenUrl: string | null;
  esMio: boolean;
};

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
  const repetido = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        sql`lower(${exercises.nombre}) = lower(${nombre})`,
        or(eq(exercises.esPublico, true), eq(exercises.createdBy, user.id)),
      ),
    )
    .limit(1);

  if (repetido.length > 0) throw new Error(`Ya existe un ejercicio llamado «${nombre}».`);

  const [fila] = await db
    .insert(exercises)
    .values({ nombre, grupo, equipo, esPublico: false, createdBy: user.id })
    .returning();

  revalidatePath("/ejercicios");

  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: fila.grupo,
    equipo: fila.equipo,
    imagenUrl: fila.imagenUrl,
    esMio: true,
  };
}

/** El ejercicio, si es uno privado de este usuario. Si no, corta. */
async function ejercicioPropio(exerciseId: string) {
  const user = await getCurrentUser();

  const fila = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.createdBy, user.id)),
  });

  if (!fila) throw new Error("Ese ejercicio no es tuyo o no existe.");
  if (fila.esPublico) throw new Error("Los ejercicios del catálogo común no se tocan.");

  return { fila, user };
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
  input: { nombre: string; grupo: string; equipo: string },
): Promise<EjercicioNuevo> {
  const { user } = await ejercicioPropio(exerciseId);

  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  const equipo = input.equipo.trim().replace(/\s+/g, " ");

  if (nombre.length < 2) throw new Error("Poné un nombre de al menos dos letras.");
  if (equipo.length < 2) throw new Error("Indicá con qué se hace (barra, mancuernas, polea…).");

  const grupos: readonly string[] = muscleGroup.enumValues;
  if (!grupos.includes(input.grupo)) throw new Error("Ese grupo muscular no existe.");
  const grupo = input.grupo as (typeof muscleGroup.enumValues)[number];

  const repetido = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        sql`lower(${exercises.nombre}) = lower(${nombre})`,
        sql`${exercises.id} <> ${exerciseId}`,
        or(eq(exercises.esPublico, true), eq(exercises.createdBy, user.id)),
      ),
    )
    .limit(1);

  if (repetido.length > 0) throw new Error(`Ya existe un ejercicio llamado «${nombre}».`);

  const [fila] = await db
    .update(exercises)
    .set({ nombre, grupo, equipo })
    .where(eq(exercises.id, exerciseId))
    .returning();

  // El nombre viaja a las rutinas y al historial, que lo leen por join.
  revalidatePath("/", "layout");

  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: fila.grupo,
    equipo: fila.equipo,
    imagenUrl: fila.imagenUrl,
    esMio: true,
  };
}

/**
 * Borra un ejercicio propio, solo si no lo usa nadie.
 *
 * La base ya lo protege con ON DELETE RESTRICT en `routine_exercises` y
 * `set_logs`; esto lo comprueba antes para poder decir en qué está metido en
 * vez de soltar una violación de clave ajena.
 */
export async function borrarEjercicio(exerciseId: string) {
  await ejercicioPropio(exerciseId);

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

// ── Editor: días ──────────────────────────────────────────────────────────

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Día nuevo y vacío al final de la rutina. */
export async function crearDia(routineId: string): Promise<DiaConEjercicios> {
  await rutinaPropia(routineId);

  const dias = await db
    .select()
    .from(routineDays)
    .where(eq(routineDays.routineId, routineId))
    .orderBy(asc(routineDays.orden));

  // (routine_id, codigo) y (routine_id, orden) son únicos: el código es la
  // primera letra libre, no la siguiente, para que borrar el B y crear otro
  // día vuelva a dar B en vez de chocar.
  const usados = new Set(dias.map((d) => d.codigo));
  const codigo = [...LETRAS].find((l) => !usados.has(l)) ?? `D${dias.length + 1}`;
  const nombre = `Día ${dias.length + 1}`;

  const [dia] = await db
    .insert(routineDays)
    .values({
      routineId,
      orden: dias.reduce((m, d) => Math.max(m, d.orden), -1) + 1,
      codigo,
      nombre,
      titulo: `Día ${codigo} — ${nombre}`,
      subtitulo: "",
    })
    .returning();

  revalidatePath(`/rutinas/${routineId}`);

  return {
    id: dia.id,
    codigo: dia.codigo,
    nombre: dia.nombre,
    titulo: dia.titulo,
    subtitulo: dia.subtitulo,
    duracionMin: dia.duracionMin,
    descansoDefectoS: dia.descansoDefectoS,
    progresion: dia.progresion,
    ejercicios: [],
  };
}

/**
 * Borra un día con sus ejercicios (cascade).
 *
 * Las sesiones ya entrenadas se quedan: `workout_sessions.routine_day_id` es
 * ON DELETE SET NULL, así que el historial no pierde nada.
 */
export async function borrarDia(routineDayId: string) {
  const dia = await diaPropio(routineDayId);

  await db.delete(routineDays).where(eq(routineDays.id, routineDayId));

  revalidatePath(`/rutinas/${dia.routineId}`);
  return { ok: true as const };
}
