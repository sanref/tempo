import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * ── Sesión ─────────────────────────────────────────────────────────────────
 *
 * Punto único de acoplamiento con la autenticación: ninguna pantalla lee el
 * usuario de otro sitio.
 *
 * El proveedor es Supabase Auth, el mismo que tempo_mobile — misma base, mismas
 * cuentas, mismo trigger `on_auth_user_created`, que crea la fila de `users` al
 * registrarse. Aquí solo se traduce la identidad (`auth.users.id`) al perfil
 * (`users.id`), que es lo que el resto de la app entiende.
 *
 * Siempre `getUser()`, nunca `getSession()`: `getSession()` devuelve lo que
 * traiga la cookie sin comprobar la firma, y la cookie la controla el cliente.
 * `getUser()` valida el token contra Supabase.
 */

/** El perfil del usuario logueado, o null si no hay sesión válida. */
export async function getOptionalUser(): Promise<User | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user: identidad },
  } = await supabase.auth.getUser();

  if (!identidad) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.authId, identidad.id),
  });

  return user ?? null;
}

/**
 * El perfil del usuario logueado. Si no hay sesión, corta y manda a /login.
 *
 * Para la cabecera y el layout usá `getOptionalUser()`: si redirigen ellos, la
 * propia /login entra en bucle.
 */
export async function getCurrentUser(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}

/** El entrenador del usuario actual, si tiene. */
export async function getCoach(user: User): Promise<User | null> {
  if (!user.coachId) return null;
  return (await db.query.users.findFirst({ where: eq(users.id, user.coachId) })) ?? null;
}

/** Quién puede ver el panel de entrenador. El guard de ruta está en proxy.ts. */
export function esEntrenador(user: User): boolean {
  return user.role === "entrenador" || user.role === "admin";
}

/**
 * Quién puede tocar roles en /admin.
 *
 * No hay forma de llegar a admin desde la app a propósito: se pone a mano en
 * la base. Un rol que puede repartir roles no se reparte desde una pantalla
 * hasta que haya de quién fiarse.
 */
export function esAdmin(user: User): boolean {
  return user.role === "admin";
}
