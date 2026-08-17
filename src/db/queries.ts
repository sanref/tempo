import "server-only";

import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  assignments,
  coachInvites,
  exercises,
  personalRecords,
  routineDays,
  routineExercises,
  routines,
  setLogs,
  users,
  workoutSessions,
} from "@/db/schema";

/**
 * Capa de lectura. Cada función corresponde a un bloque de una pantalla.
 * Lo agregable pesado (volumen semanal, adherencia, "anterior") vive en
 * funciones SQL de db/01_schema.sql — es más rápido y no viaja por la red.
 */

const num = (v: unknown) => Number(v ?? 0);

// ── Inicio ────────────────────────────────────────────────────────────────

export type ResumenSemana = {
  sesionesHechas: number;
  sesionesPlan: number;
  volumenKg: number;
  rachaSemanas: number;
  tiempoS: number;
};

export async function getResumenSemana(userId: string): Promise<ResumenSemana> {
  const { rows } = await db.execute<{
    sesiones: string;
    plan: string;
    volumen: string;
    tiempo: string;
    racha: string;
  }>(sql`
    WITH semana AS (
      SELECT s.id, s.started_at, s.ended_at
      FROM workout_sessions s
      WHERE s.user_id = ${userId}
        AND s.status = 'terminada'
        AND s.started_at >= date_trunc('week', now())
    ),
    activas AS (
      SELECT count(*) AS n
      FROM assignments a
      JOIN routine_days d ON d.routine_id = a.routine_id
      WHERE a.client_id = ${userId} AND a.ended_on IS NULL
    ),
    semanas_con_sesion AS (
      SELECT DISTINCT date_trunc('week', started_at)::date AS w
      FROM workout_sessions
      WHERE user_id = ${userId} AND status = 'terminada'
    ),
    -- Racha: semanas consecutivas hacia atrás desde la actual (o la pasada,
    -- si la actual todavía no tiene ninguna sesión).
    racha AS (
      SELECT count(*) AS n FROM (
        SELECT w, row_number() OVER (ORDER BY w DESC) AS i,
               (SELECT max(w) FROM semanas_con_sesion) AS tope
        FROM semanas_con_sesion
      ) t
      WHERE t.w = t.tope - make_interval(weeks => (t.i - 1)::int)
    )
    SELECT
      (SELECT count(*) FROM semana)::text AS sesiones,
      (SELECT n FROM activas)::text AS plan,
      (SELECT coalesce(sum(l.volumen_kg), 0) FROM set_logs l
         WHERE l.done_at IS NOT NULL AND l.session_id IN (SELECT id FROM semana))::text AS volumen,
      (SELECT coalesce(sum(EXTRACT(EPOCH FROM (ended_at - started_at))), 0)
         FROM semana WHERE ended_at IS NOT NULL)::text AS tiempo,
      (SELECT n FROM racha)::text AS racha
  `);

  const r = rows[0];
  return {
    sesionesHechas: num(r?.sesiones),
    sesionesPlan: num(r?.plan),
    volumenKg: num(r?.volumen),
    rachaSemanas: num(r?.racha),
    tiempoS: num(r?.tiempo),
  };
}

export type PlanActivo = {
  routineId: string;
  routineNombre: string;
  semanas: number;
  semanaActual: number;
  coachNombre: string | null;
};

export async function getPlanActivo(userId: string): Promise<PlanActivo | null> {
  const rows = await db
    .select({
      routineId: routines.id,
      routineNombre: routines.nombre,
      semanas: routines.semanas,
      startedOn: assignments.startedOn,
      coachNombre: users.nombre,
    })
    .from(assignments)
    .innerJoin(routines, eq(routines.id, assignments.routineId))
    .leftJoin(users, eq(users.id, assignments.coachId))
    .where(and(eq(assignments.clientId, userId), isNull(assignments.endedOn)))
    .orderBy(desc(assignments.startedOn))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const inicio = new Date(r.startedOn);
  const transcurridas = Math.floor((Date.now() - inicio.getTime()) / (7 * 86_400_000)) + 1;

  return {
    routineId: r.routineId,
    routineNombre: r.routineNombre,
    semanas: r.semanas,
    semanaActual: Math.min(Math.max(transcurridas, 1), r.semanas),
    coachNombre: r.coachNombre,
  };
}

export type DiaConEjercicios = {
  id: string;
  codigo: string;
  nombre: string;
  titulo: string;
  subtitulo: string;
  duracionMin: number | null;
  descansoDefectoS: number;
  progresion: "lineal" | "doble" | "manual";
  ejercicios: {
    id: string;
    exerciseId: string;
    orden: number;
    nombre: string;
    equipo: string;
    series: number;
    tipo: "reps" | "tiempo";
    reps: string;
    cargaKg: string | null;
    cargaTexto: string | null;
    descansoS: number | null;
  }[];
};

async function cargarDias(routineId: string): Promise<DiaConEjercicios[]> {
  const dias = await db
    .select()
    .from(routineDays)
    .where(eq(routineDays.routineId, routineId))
    .orderBy(asc(routineDays.orden));

  if (dias.length === 0) return [];

  const ejercicios = await db
    .select({
      id: routineExercises.id,
      routineDayId: routineExercises.routineDayId,
      exerciseId: routineExercises.exerciseId,
      orden: routineExercises.orden,
      series: routineExercises.series,
      tipo: routineExercises.tipo,
      reps: routineExercises.reps,
      cargaKg: routineExercises.cargaKg,
      cargaTexto: routineExercises.cargaTexto,
      descansoS: routineExercises.descansoS,
      nombre: exercises.nombre,
      equipo: exercises.equipo,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .innerJoin(routineDays, eq(routineDays.id, routineExercises.routineDayId))
    .where(eq(routineDays.routineId, routineId))
    .orderBy(asc(routineExercises.orden));

  return dias.map((d) => ({
    id: d.id,
    codigo: d.codigo,
    nombre: d.nombre,
    titulo: d.titulo,
    subtitulo: d.subtitulo,
    duracionMin: d.duracionMin,
    descansoDefectoS: d.descansoDefectoS,
    progresion: d.progresion,
    ejercicios: ejercicios
      .filter((e) => e.routineDayId === d.id)
      .map(({ routineDayId: _ignored, ...e }) => e),
  }));
}

/** El día que toca: el siguiente al último completado, rotando. */
export async function getProximoDia(userId: string): Promise<DiaConEjercicios | null> {
  const plan = await getPlanActivo(userId);
  if (!plan) return null;

  const dias = await cargarDias(plan.routineId);
  if (dias.length === 0) return null;

  const ultima = await db
    .select({ routineDayId: workoutSessions.routineDayId })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, "terminada")))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);

  const i = dias.findIndex((d) => d.id === ultima[0]?.routineDayId);
  return dias[(i + 1) % dias.length];
}

export async function getVolumenSemanal(userId: string, semanas = 12) {
  const { rows } = await db.execute<{ semana: string; volumen_kg: string }>(
    sql`SELECT semana::text, volumen_kg::text FROM volumen_semanal(${userId}, ${semanas})`,
  );
  return rows.map((r, i) => ({
    label: `S${i + 1}`,
    semana: r.semana,
    volumenKg: num(r.volumen_kg),
  }));
}

export async function getRecordsRecientes(userId: string, limite = 3) {
  return db
    .select({
      nombre: exercises.nombre,
      kg: personalRecords.kg,
      reps: personalRecords.reps,
      deltaKg: personalRecords.deltaKg,
      achievedAt: personalRecords.achievedAt,
    })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(eq(personalRecords.userId, userId))
    .orderBy(desc(personalRecords.achievedAt))
    .limit(limite);
}

// ── Rutinas ───────────────────────────────────────────────────────────────

export async function getRutinas(userId: string) {
  const rows = await db
    .select({
      id: routines.id,
      nombre: routines.nombre,
      descripcion: routines.descripcion,
      nivel: routines.nivel,
      semanas: routines.semanas,
      status: routines.status,
      autor: users.nombre,
      dias: count(routineDays.id),
    })
    .from(routines)
    .leftJoin(routineDays, eq(routineDays.routineId, routines.id))
    .leftJoin(users, eq(users.id, routines.authorId))
    .where(eq(routines.ownerId, userId))
    .groupBy(routines.id, users.nombre)
    .orderBy(asc(routines.status), asc(routines.nombre));

  return rows.map((r) => ({
    ...r,
    kicker:
      r.status === "activa" ? (r.autor ? "Del entrenador" : "Activa")
      : r.status === "borrador" ? "Borrador"
      : "Guardada",
  }));
}

export type RutinaDetalle = {
  id: string;
  nombre: string;
  descripcion: string;
  nivel: string;
  semanas: number;
  autor: string | null;
  dias: DiaConEjercicios[];
  seriesPorSemana: number;
  adherencia: number;
};

export async function getRutina(id: string, userId: string): Promise<RutinaDetalle | null> {
  const rows = await db
    .select({
      id: routines.id,
      nombre: routines.nombre,
      descripcion: routines.descripcion,
      nivel: routines.nivel,
      semanas: routines.semanas,
      autor: users.nombre,
    })
    .from(routines)
    .leftJoin(users, eq(users.id, routines.authorId))
    .where(eq(routines.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const dias = await cargarDias(id);
  const seriesPorSemana = dias.reduce(
    (t, d) => t + d.ejercicios.reduce((s, e) => s + e.series, 0),
    0,
  );

  const { rows: adh } = await db.execute<{ pct: string }>(
    sql`SELECT adherencia(${userId}, 28)::text AS pct`,
  );

  return { ...r, dias, seriesPorSemana, adherencia: num(adh[0]?.pct) };
}

// ── Sesión de entrenamiento ───────────────────────────────────────────────

export type SesionBloque = {
  bloque: number;
  exerciseId: string;
  nombre: string;
  equipo: string;
  descansoS: number;
  /** 'tiempo' cambia la columna de reps por una de segundos. */
  tipo: "reps" | "tiempo";
  series: {
    id: string;
    orden: number;
    kg: number;
    reps: number;
    segundos: number | null;
    hecha: boolean;
    anterior: string;
  }[];
};

export type SesionActiva = {
  id: string;
  titulo: string;
  startedAt: Date;
  endedAt: Date | null;
  status: "en_curso" | "terminada" | "abandonada";
  descansoDefectoS: number;
  bloques: SesionBloque[];
};

/** Columna "Anterior": '72,5 kg × 8' para reps, '10 kg · 45 s' por tiempo. */
function anteriorTexto(kg: string | null, reps: number | null, segundos: number | null): string {
  if (kg == null) return "—";
  const peso = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(num(kg));
  if (segundos != null) {
    return num(kg) > 0 ? `${peso} kg · ${segundos} s` : `${segundos} s`;
  }
  return `${peso} kg × ${reps}`;
}

export async function getSesion(sesionId: string, userId: string): Promise<SesionActiva | null> {
  const rows = await db
    .select({
      id: workoutSessions.id,
      titulo: workoutSessions.titulo,
      startedAt: workoutSessions.startedAt,
      endedAt: workoutSessions.endedAt,
      status: workoutSessions.status,
      descansoDefectoS: routineDays.descansoDefectoS,
    })
    .from(workoutSessions)
    .leftJoin(routineDays, eq(routineDays.id, workoutSessions.routineDayId))
    .where(and(eq(workoutSessions.id, sesionId), eq(workoutSessions.userId, userId)))
    .limit(1);

  const s = rows[0];
  if (!s) return null;

  // La columna "Anterior" = última serie confirmada del mismo ejercicio y
  // número de serie, de cualquier sesión previa. Un LATERAL por fila es lo
  // más barato aquí: el índice (exercise_id, done_at) lo resuelve directo.
  const { rows: series } = await db.execute<{
    id: string;
    bloque: number;
    orden: number;
    kg: string;
    reps: number;
    segundos: number | null;
    hecha: boolean;
    exercise_id: string;
    nombre: string;
    equipo: string;
    descanso_s: number | null;
    tipo: "reps" | "tiempo" | null;
    prev_kg: string | null;
    prev_reps: number | null;
    prev_segundos: number | null;
  }>(sql`
    SELECT
      l.id::text,
      l.bloque, l.orden, l.kg::text, l.reps, l.segundos,
      (l.done_at IS NOT NULL) AS hecha,
      l.exercise_id::text,
      e.nombre, e.equipo,
      re.descanso_s, re.tipo::text AS tipo,
      p.kg::text AS prev_kg, p.reps AS prev_reps, p.segundos AS prev_segundos
    FROM set_logs l
    JOIN exercises e ON e.id = l.exercise_id
    LEFT JOIN routine_exercises re ON re.id = l.routine_exercise_id
    LEFT JOIN LATERAL (
      SELECT pl.kg, pl.reps, pl.segundos
      FROM set_logs pl
      JOIN workout_sessions ps ON ps.id = pl.session_id
      WHERE pl.exercise_id = l.exercise_id
        AND pl.orden = l.orden
        AND pl.done_at IS NOT NULL
        AND ps.user_id = ${userId}
        AND pl.session_id <> ${sesionId}
      ORDER BY pl.done_at DESC
      LIMIT 1
    ) p ON true
    WHERE l.session_id = ${sesionId}
    ORDER BY l.bloque, l.orden
  `);

  const bloques = new Map<number, SesionBloque>();
  for (const row of series) {
    let b = bloques.get(row.bloque);
    if (!b) {
      b = {
        bloque: row.bloque,
        exerciseId: row.exercise_id,
        nombre: row.nombre,
        equipo: row.equipo,
        descansoS: row.descanso_s ?? s.descansoDefectoS ?? 90,
        // Si la fila de rutina ya no existe (se quitó del día mientras la
        // sesión seguía abierta), el propio registro lo delata.
        tipo: row.tipo ?? (row.segundos != null ? "tiempo" : "reps"),
        series: [],
      };
      bloques.set(row.bloque, b);
    }
    b.series.push({
      id: row.id,
      orden: row.orden,
      kg: num(row.kg),
      reps: row.reps,
      segundos: row.segundos,
      hecha: row.hecha,
      anterior: anteriorTexto(row.prev_kg, row.prev_reps, row.prev_segundos),
    });
  }

  return {
    id: s.id,
    titulo: s.titulo,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    status: s.status,
    descansoDefectoS: s.descansoDefectoS ?? 90,
    bloques: [...bloques.values()],
  };
}

export async function getSesionEnCurso(userId: string) {
  const rows = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, "en_curso")))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ── Historial ─────────────────────────────────────────────────────────────

export async function getHistorial(userId: string, limite = 40) {
  const { rows } = await db.execute<{
    id: string;
    titulo: string;
    started_at: string;
    series: string;
    volumen_kg: string;
    duracion_s: string;
    tuvo_pr: boolean;
  }>(sql`
    SELECT id::text, titulo, started_at::text, series::text,
           volumen_kg::text, duracion_s::text, tuvo_pr
    FROM session_summaries
    WHERE user_id = ${userId} AND status = 'terminada'
    ORDER BY started_at DESC
    LIMIT ${limite}
  `);

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    fecha: new Date(r.started_at),
    series: num(r.series),
    volumenKg: num(r.volumen_kg),
    duracionS: num(r.duracion_s),
    tuvoPr: r.tuvo_pr,
  }));
}

export async function contarSesiones(userId: string) {
  const { rows } = await db.execute<{ n: string; desde: string | null }>(sql`
    SELECT count(*)::text AS n, min(started_at)::text AS desde
    FROM workout_sessions
    WHERE user_id = ${userId} AND status = 'terminada'
  `);
  return {
    total: num(rows[0]?.n),
    desde: rows[0]?.desde ? new Date(rows[0].desde) : null,
  };
}

// ── Progreso ──────────────────────────────────────────────────────────────

/** Serie de 1RM estimado (Epley) por semana para un ejercicio. */
export async function getE1rmSemanal(userId: string, exerciseId: string, semanas = 12) {
  const { rows } = await db.execute<{ semana: string; e1rm: string }>(sql`
    WITH semanas AS (
      SELECT generate_series(
        date_trunc('week', now()) - make_interval(weeks => ${semanas - 1}),
        date_trunc('week', now()),
        '1 week'
      )::date AS w
    )
    SELECT s.w::text AS semana,
           coalesce(max(round(l.kg * (1 + l.reps / 30.0), 1)), 0)::text AS e1rm
    FROM semanas s
    LEFT JOIN workout_sessions ws
      ON ws.user_id = ${userId}
     AND date_trunc('week', ws.started_at)::date = s.w
    LEFT JOIN set_logs l
      ON l.session_id = ws.id AND l.exercise_id = ${exerciseId} AND l.done_at IS NOT NULL
    GROUP BY s.w
    ORDER BY s.w
  `);
  return rows.map((r) => ({ semana: r.semana, e1rm: num(r.e1rm) }));
}

/** Series confirmadas por grupo muscular en los últimos 7 días. */
export async function getSeriesPorGrupo(userId: string) {
  const { rows } = await db.execute<{ grupo: string; n: string }>(sql`
    SELECT g.grupo::text, count(hechas.id)::text AS n
    FROM unnest(enum_range(NULL::muscle_group)) AS g(grupo)
    LEFT JOIN (
      SELECT e.grupo, l.id
      FROM set_logs l
      JOIN exercises e ON e.id = l.exercise_id
      JOIN workout_sessions s ON s.id = l.session_id
      WHERE s.user_id = ${userId}
        AND l.done_at IS NOT NULL
        AND s.started_at >= now() - interval '7 days'
    ) hechas ON hechas.grupo = g.grupo
    GROUP BY g.grupo
    ORDER BY g.grupo
  `);
  return rows.map((r) => ({ grupo: r.grupo, series: num(r.n) }));
}

export async function getMarcasPersonales(userId: string, limite = 8) {
  const { rows } = await db.execute<{
    nombre: string;
    kg: string;
    reps: number;
    delta_kg: string;
    achieved_at: string;
  }>(sql`
    SELECT DISTINCT ON (pr.exercise_id)
      e.nombre, pr.kg::text, pr.reps, pr.delta_kg::text, pr.achieved_at::text
    FROM personal_records pr
    JOIN exercises e ON e.id = pr.exercise_id
    WHERE pr.user_id = ${userId}
    ORDER BY pr.exercise_id, pr.achieved_at DESC
  `);

  return rows
    .map((r) => ({
      nombre: r.nombre,
      kg: num(r.kg),
      reps: r.reps,
      deltaKg: num(r.delta_kg),
      fecha: new Date(r.achieved_at),
    }))
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(0, limite);
}

/** Ejercicio destacado del gráfico de progreso: el que más veces se registró. */
export async function getEjercicioDestacado(userId: string) {
  const { rows } = await db.execute<{ id: string; nombre: string }>(sql`
    SELECT e.id::text, e.nombre
    FROM set_logs l
    JOIN workout_sessions s ON s.id = l.session_id
    JOIN exercises e ON e.id = l.exercise_id
    WHERE s.user_id = ${userId} AND l.done_at IS NOT NULL
    GROUP BY e.id, e.nombre
    ORDER BY count(*) DESC, e.nombre
    LIMIT 1
  `);
  return rows[0] ?? null;
}

// ── Biblioteca ────────────────────────────────────────────────────────────

/**
 * El catálogo visible para un usuario: lo público más lo suyo.
 *
 * Los ejercicios que crea la gente nacen privados (`es_publico = false`), que
 * es lo que permite el índice único parcial sobre el nombre: dos usuarios
 * pueden tener su propio "Remo con banda" sin chocar con el catálogo común.
 */
export async function getEjercicios(
  userId: string,
  opts: { q?: string; grupo?: string } = {},
) {
  const q = opts.q?.trim();
  const grupo = opts.grupo;

  return db
    .select({
      id: exercises.id,
      nombre: exercises.nombre,
      grupo: exercises.grupo,
      equipo: exercises.equipo,
      imagenUrl: exercises.imagenUrl,
      // coalesce porque los del catálogo común tienen created_by a NULL, y
      // `NULL = uuid` es NULL, no false.
      esMio: sql<boolean>`coalesce(${exercises.createdBy} = ${userId}, false)`,
    })
    .from(exercises)
    .where(
      and(
        or(eq(exercises.esPublico, true), eq(exercises.createdBy, userId)),
        grupo ? sql`grupo::text = ${grupo}` : undefined,
        q ? sql`(unaccent_ci(nombre) LIKE unaccent_ci(${"%" + q + "%"})
                 OR unaccent_ci(equipo) LIKE unaccent_ci(${"%" + q + "%"})
                 OR grupo::text ILIKE ${"%" + q + "%"})` : undefined,
      ),
    )
    .orderBy(asc(exercises.grupo), asc(exercises.nombre));
}

export async function getGrupos() {
  const { rows } = await db.execute<{ grupo: string }>(
    sql`SELECT unnest(enum_range(NULL::muscle_group))::text AS grupo`,
  );
  return rows.map((r) => r.grupo);
}

export type UsoEjercicio = { rutinas: number; series: number };

/**
 * Dónde se está usando cada ejercicio propio del usuario.
 *
 * Sirve para avisar antes de intentar borrar: `routine_exercises.exercise_id` y
 * `set_logs.exercise_id` son ON DELETE RESTRICT, así que la base lo impediría
 * igual, pero con un error de clave ajena en vez de una frase.
 */
export async function getUsosEjerciciosPropios(
  userId: string,
): Promise<Record<string, UsoEjercicio>> {
  const { rows } = await db.execute<{ id: string; rutinas: string; series: string }>(sql`
    SELECT e.id::text AS id,
           (SELECT count(DISTINCT d.routine_id)
              FROM routine_exercises re
              JOIN routine_days d ON d.id = re.routine_day_id
             WHERE re.exercise_id = e.id)::text AS rutinas,
           (SELECT count(*) FROM set_logs l WHERE l.exercise_id = e.id)::text AS series
      FROM exercises e
     WHERE e.created_by = ${userId} AND NOT e.es_publico
  `);

  return Object.fromEntries(
    rows.map((r) => [r.id, { rutinas: num(r.rutinas), series: num(r.series) }]),
  );
}

/** Equipamientos ya usados, para sugerirlos al dar de alta un ejercicio. */
export async function getEquipos() {
  const filas = await db
    .selectDistinct({ equipo: exercises.equipo })
    .from(exercises)
    .orderBy(asc(exercises.equipo));
  return filas.map((f) => f.equipo);
}

// ── Panel de entrenador ───────────────────────────────────────────────────

export async function getClientes(coachId: string) {
  const { rows } = await db.execute<{
    id: string;
    nombre: string;
    plan: string | null;
    routine_id: string | null;
    semana: string | null;
    semanas: string | null;
    adherencia: string;
    ultima: string | null;
  }>(sql`
    SELECT
      u.id::text,
      u.nombre,
      r.nombre AS plan,
      r.id::text AS routine_id,
      (floor(EXTRACT(DAY FROM (now() - a.started_on)) / 7) + 1)::text AS semana,
      r.semanas::text,
      adherencia(u.id, 28)::text AS adherencia,
      (SELECT max(started_at)::text FROM workout_sessions w
        WHERE w.user_id = u.id AND w.status = 'terminada') AS ultima
    FROM users u
    LEFT JOIN assignments a ON a.client_id = u.id AND a.ended_on IS NULL
    LEFT JOIN routines r ON r.id = a.routine_id
    WHERE u.coach_id = ${coachId} AND u.activo
    ORDER BY adherencia(u.id, 28) DESC, u.nombre
  `);

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    plan: r.plan ?? "Sin plan",
    routineId: r.routine_id,
    semana: r.semana ? `${Math.min(num(r.semana), num(r.semanas))} / ${r.semanas}` : "—",
    adherencia: num(r.adherencia),
    ultima: r.ultima ? new Date(r.ultima) : null,
  }));
}

/**
 * Rutinas que un entrenador puede asignar: las suyas y las que escribió.
 *
 * En el prototipo los planes del entrenador quedan a nombre del alumno
 * (`owner_id`) con el entrenador en `author_id`, así que hacen falta las dos
 * vías. Las que no tienen días se marcan pero no se ocultan: es más útil verlas
 * y saber por qué no se pueden asignar.
 */
export async function getRutinasAsignables(coachId: string) {
  const filas = await db
    .select({
      id: routines.id,
      nombre: routines.nombre,
      nivel: routines.nivel,
      semanas: routines.semanas,
      dias: count(routineDays.id),
    })
    .from(routines)
    .leftJoin(routineDays, eq(routineDays.routineId, routines.id))
    .where(or(eq(routines.ownerId, coachId), eq(routines.authorId, coachId)))
    .groupBy(routines.id, routines.nombre, routines.nivel, routines.semanas)
    .orderBy(asc(routines.nombre));

  return filas;
}

export async function getResumenCoach(coachId: string) {
  const { rows } = await db.execute<{ activos: string; riesgo: string }>(sql`
    SELECT
      count(*)::text AS activos,
      count(*) FILTER (WHERE adherencia(u.id, 28) < 65)::text AS riesgo
    FROM users u
    WHERE u.coach_id = ${coachId} AND u.activo
  `);
  return { activos: num(rows[0]?.activos), riesgo: num(rows[0]?.riesgo) };
}

// ── Invitaciones de entrenador ────────────────────────────────────────────

/**
 * Los códigos de un entrenador, del más nuevo al más viejo.
 *
 * El estado se calcula aquí y no se guarda: un código caducado no cambia de
 * fila al vencer, simplemente deja de servir. Guardarlo obligaría a un job que
 * fuera marcándolos.
 */
export async function getInvitaciones(coachId: string) {
  const filas = await db
    .select({
      id: coachInvites.id,
      codigo: coachInvites.codigo,
      createdAt: coachInvites.createdAt,
      expiresAt: coachInvites.expiresAt,
      usedAt: coachInvites.usedAt,
      usadoPor: users.nombre,
    })
    .from(coachInvites)
    .leftJoin(users, eq(users.id, coachInvites.usedBy))
    .where(eq(coachInvites.coachId, coachId))
    .orderBy(desc(coachInvites.createdAt))
    .limit(20);

  const ahora = Date.now();
  return filas.map((f) => ({
    ...f,
    estado: f.usedAt
      ? ("usado" as const)
      : f.expiresAt.getTime() <= ahora
        ? ("caducado" as const)
        : ("activo" as const),
  }));
}

// ── Administración ────────────────────────────────────────────────────────

/** Todos los usuarios con su entrenador. Solo lo usa /admin. */
export async function getUsuarios() {
  const coach = alias(users, "coach");

  return db
    .select({
      id: users.id,
      nombre: users.nombre,
      email: users.email,
      role: users.role,
      activo: users.activo,
      createdAt: users.createdAt,
      coachNombre: coach.nombre,
    })
    .from(users)
    .leftJoin(coach, eq(coach.id, users.coachId))
    .orderBy(asc(users.nombre));
}
