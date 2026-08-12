import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users, type User } from "@/db/schema";

/**
 * ── Sesión mockeada ────────────────────────────────────────────────────────
 *
 * Punto único de acoplamiento con la autenticación. Hoy devuelve el usuario
 * de MOCK_USER_ID; cuando se enchufe Better Auth (o Supabase Auth), esto pasa a:
 *
 *   const session = await auth.api.getSession({ headers: await headers() });
 *   if (!session) redirect("/login");
 *   return db.query.users.findFirst({ where: eq(users.id, session.user.id) });
 *
 * Ninguna pantalla lee el usuario de otro sitio, así que el cambio es local.
 */

const MOCK_ALUMNO = "11111111-1111-1111-1111-111111111111";

export async function getCurrentUser(): Promise<User> {
  const id = process.env.MOCK_USER_ID || MOCK_ALUMNO;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });

  if (!user) {
    throw new Error(
      `MOCK_USER_ID=${id} no existe en tempo.users. ¿Corriste db/02_seed.sql?`,
    );
  }
  return user;
}

/** El entrenador del usuario actual, si tiene. */
export async function getCoach(user: User): Promise<User | null> {
  if (!user.coachId) return null;
  return (await db.query.users.findFirst({ where: eq(users.id, user.coachId) })) ?? null;
}

/**
 * Quién puede ver el panel de entrenador. Con auth real esto se convierte en
 * un guard de middleware sobre /coach.
 */
export function esEntrenador(user: User): boolean {
  return user.role === "entrenador" || user.role === "admin";
}
