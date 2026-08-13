import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

/**
 * Un solo pool por proceso, creado de forma perezosa.
 *
 * Perezosa a propósito: `next build` importa los módulos para recolectar las
 * páginas y no debería exigir una base viva. La conexión se abre en la primera
 * consulta real, no al importar.
 */
const globalForDb = globalThis as unknown as { __tempoPool?: Pool; __tempoDb?: Db };

function crearPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copiá .env.example a .env y apuntá a tu Postgres local.",
    );
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    // Sin `options` a propósito: todo vive en `public`, que ya es el
    // search_path por defecto, y los pools de Supabase (pgbouncer/Supavisor)
    // no admiten parámetros de arranque en la conexión.
  });
}

function instancia(): Db {
  if (!globalForDb.__tempoDb) {
    globalForDb.__tempoPool ??= crearPool();
    globalForDb.__tempoDb = drizzle(globalForDb.__tempoPool, { schema, casing: "snake_case" });
  }
  return globalForDb.__tempoDb;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = instancia();
    const valor = Reflect.get(real, prop, real);
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
});

export function getPool(): Pool {
  instancia();
  return globalForDb.__tempoPool!;
}

export { schema };
