/**
 * Espejo en Drizzle de db/01_schema.sql.
 *
 * El SQL es la fuente de la verdad (lo corres con psql); esto existe para
 * tener tipos y un query builder. Si tocás uno, tocá el otro — o generá las
 * migraciones con `drizzle-kit generate` y hacé del SQL el resultado.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Todo en `public`, sin schema propio: es donde Supabase espera las tablas.

export const userRole = pgEnum("user_role", ["alumno", "entrenador", "admin"]);
export const muscleGroup = pgEnum("muscle_group", [
  "Pecho",
  "Espalda",
  "Pierna",
  "Hombro",
  "Brazo",
  "Core",
  "Trapecio",
  "Antebrazo",
]);
export const routineLevel = pgEnum("routine_level", [
  "Principiante",
  "Intermedio",
  "Avanzado",
  "Todos",
]);
export const routineStatus = pgEnum("routine_status", [
  "activa",
  "guardada",
  "borrador",
  "plantilla",
]);
export const progressionKind = pgEnum("progression_kind", ["lineal", "doble", "manual"]);
export const sessionStatus = pgEnum("session_status", ["en_curso", "terminada", "abandonada"]);
export const effortKind = pgEnum("effort_kind", ["reps", "tiempo"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    nombre: text("nombre").notNull(),
    role: userRole("role").notNull().default("alumno"),
    coachId: uuid("coach_id"),
    avatarUrl: text("avatar_url"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Identidad en auth.users. Sin FK: `auth` es de Supabase y una clave ajena
    // contra su tabla ata el esquema a su ciclo de vida. El vínculo lo mantiene
    // el trigger `on_auth_user_created`.
    authId: uuid("auth_id").unique(),
  },
  (t) => [index("users_coach_id_idx").on(t.coachId), index("users_auth_id_idx").on(t.authId)],
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    grupo: muscleGroup("grupo").notNull(),
    equipo: text("equipo").notNull(),
    imagenUrl: text("imagen_url"),
    esPublico: boolean("es_publico").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exercises_grupo_idx").on(t.grupo)],
);

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion").notNull().default(""),
    nivel: routineLevel("nivel").notNull().default("Intermedio"),
    semanas: integer("semanas").notNull().default(8),
    status: routineStatus("status").notNull().default("borrador"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routines_owner_idx").on(t.ownerId, t.status)],
);

export const routineDays = pgTable(
  "routine_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    orden: smallint("orden").notNull(),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    titulo: text("titulo").notNull(),
    subtitulo: text("subtitulo").notNull().default(""),
    duracionMin: smallint("duracion_min"),
    descansoDefectoS: smallint("descanso_defecto_s").notNull().default(90),
    progresion: progressionKind("progresion").notNull().default("lineal"),
    incrementoKg: numeric("incremento_kg", { precision: 4, scale: 2 }).notNull().default("2.5"),
    notas: text("notas").notNull().default(""),
  },
  (t) => [
    uniqueIndex("routine_days_routine_id_orden_key").on(t.routineId, t.orden),
    uniqueIndex("routine_days_routine_id_codigo_key").on(t.routineId, t.codigo),
  ],
);

export const routineExercises = pgTable(
  "routine_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineDayId: uuid("routine_day_id")
      .notNull()
      .references(() => routineDays.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    orden: smallint("orden").notNull(),
    series: smallint("series").notNull().default(3),
    tipo: effortKind("tipo").notNull().default("reps"),
    reps: text("reps").notNull().default("10"),
    cargaKg: numeric("carga_kg", { precision: 6, scale: 2 }),
    cargaTexto: text("carga_texto"),
    descansoS: smallint("descanso_s"),
    notas: text("notas").notNull().default(""),
  },
  (t) => [
    uniqueIndex("routine_exercises_routine_day_id_orden_key").on(t.routineDayId, t.orden),
    index("routine_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    // NULL = se lo asignó el propio alumno. Ver el CHECK
    // `assignments_coach_no_self` en db/01_schema.sql.
    coachId: uuid("coach_id").references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedOn: date("started_on").notNull().defaultNow(),
    endedOn: date("ended_on"),
    notas: text("notas").notNull().default(""),
  },
  (t) => [index("assignments_coach_idx").on(t.coachId)],
);

/** Cómo se rellena `users.coach_id`: el entrenador genera, el alumno canjea. */
export const coachInvites = pgTable(
  "coach_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codigo: text("codigo").notNull().unique(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: uuid("used_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("coach_invites_coach_idx").on(t.coachId, t.createdAt)],
);

export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
    routineDayId: uuid("routine_day_id").references(() => routineDays.id, { onDelete: "set null" }),
    titulo: text("titulo").notNull(),
    status: sessionStatus("status").notNull().default("en_curso"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    notas: text("notas").notNull().default(""),
  },
  (t) => [index("sessions_user_fecha_idx").on(t.userId, t.startedAt)],
);

export const setLogs = pgTable(
  "set_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    routineExerciseId: uuid("routine_exercise_id").references(() => routineExercises.id, {
      onDelete: "set null",
    }),
    bloque: smallint("bloque").notNull(),
    orden: smallint("orden").notNull(),
    kg: numeric("kg", { precision: 6, scale: 2 }).notNull().default("0"),
    reps: smallint("reps").notNull().default(0),
    /** Trabajo por tiempo. Excluyente con reps: si hay segundos, reps es 0. */
    segundos: smallint("segundos"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    /** Columna generada por la base: kg * reps. Solo lectura. */
    volumenKg: numeric("volumen_kg", { precision: 9, scale: 2 }).generatedAlwaysAs(
      sql`kg * reps`,
    ),
  },
  (t) => [
    uniqueIndex("set_logs_session_id_bloque_orden_key").on(t.sessionId, t.bloque, t.orden),
    index("set_logs_session_idx").on(t.sessionId),
  ],
);

export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => workoutSessions.id, { onDelete: "set null" }),
    kg: numeric("kg", { precision: 6, scale: 2 }).notNull(),
    reps: smallint("reps").notNull(),
    e1rmKg: numeric("e1rm_kg", { precision: 6, scale: 2 }).notNull(),
    deltaKg: numeric("delta_kg", { precision: 6, scale: 2 }).notNull().default("0"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prs_user_idx").on(t.userId, t.achievedAt)],
);

// ── Relaciones ────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  coach: one(users, { fields: [users.coachId], references: [users.id], relationName: "coach" }),
  alumnos: many(users, { relationName: "coach" }),
  rutinas: many(routines),
  sesiones: many(workoutSessions),
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
  owner: one(users, { fields: [routines.ownerId], references: [users.id] }),
  author: one(users, { fields: [routines.authorId], references: [users.id] }),
  dias: many(routineDays),
}));

export const routineDaysRelations = relations(routineDays, ({ one, many }) => ({
  rutina: one(routines, { fields: [routineDays.routineId], references: [routines.id] }),
  ejercicios: many(routineExercises),
}));

export const routineExercisesRelations = relations(routineExercises, ({ one }) => ({
  dia: one(routineDays, {
    fields: [routineExercises.routineDayId],
    references: [routineDays.id],
  }),
  ejercicio: one(exercises, {
    fields: [routineExercises.exerciseId],
    references: [exercises.id],
  }),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  usuario: one(users, { fields: [workoutSessions.userId], references: [users.id] }),
  dia: one(routineDays, {
    fields: [workoutSessions.routineDayId],
    references: [routineDays.id],
  }),
  series: many(setLogs),
}));

export const setLogsRelations = relations(setLogs, ({ one }) => ({
  sesion: one(workoutSessions, {
    fields: [setLogs.sessionId],
    references: [workoutSessions.id],
  }),
  ejercicio: one(exercises, { fields: [setLogs.exerciseId], references: [exercises.id] }),
}));

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineDay = typeof routineDays.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
