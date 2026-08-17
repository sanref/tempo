import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * ── Cliente de Supabase del lado servidor ──────────────────────────────────
 *
 * El móvil guarda la sesión en Preferences y la lee desde el navegador; aquí
 * no sirve: las pantallas son Server Components y se renderizan antes de que
 * exista cliente. La sesión va en cookies, que es lo único que el servidor ve
 * en la petición.
 *
 * Este cliente se usa SOLO para autenticación. Los datos siguen leyéndose por
 * Drizzle con DATABASE_URL, que entra con el rol dueño de las tablas y salta
 * RLS — de ahí que las server actions tengan que seguir comprobando la
 * propiedad de cada fila a mano.
 */

function credenciales() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisá .env.",
    );
  }
  return { url, key };
}

/**
 * Cliente atado a las cookies de la petición.
 *
 * `setAll` falla si se llama durante el render de un Server Component: Next no
 * deja tocar cabeceras una vez empezada la respuesta. Se traga el error a
 * propósito — quien refresca el token de verdad es el middleware, que sí puede
 * escribir cookies, y las server actions también.
 */
export async function getSupabaseServer() {
  const { url, key } = credenciales();
  const store = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Render de Server Component: lo renueva el middleware.
        }
      },
    },
  });
}

export { credenciales };
