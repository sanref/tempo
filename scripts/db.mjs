#!/usr/bin/env node
/**
 * Corre los scripts SQL con psql, en Windows y en Unix por igual.
 *
 *   node scripts/db.mjs create    → 01_schema.sql
 *   node scripts/db.mjs migrate   → 02_… 03_… (todo lo que haya, en orden)
 *   node scripts/db.mjs seed      → 99_seed.sql
 *   node scripts/db.mjs reset     → 00_reset + 01 + 99 + perfiles-desde-auth (destructivo)
 *   node scripts/db.mjs perfiles  → perfiles-desde-auth.sql, suelto
 *
 * Numeración: 00 reset · 01 esquema · 02..98 migraciones · 99 seed.
 * `reset` no pasa por las migraciones: 01_schema.sql ya está al día, y las
 * migraciones existen para las bases que ya tienen datos dentro.
 *
 * `perfiles-desde-auth.sql` no lleva número: reconstruye public.users desde
 * auth.users, y solo tiene sentido después de un reset contra Supabase, nunca
 * como paso de una migración normal. `reset` lo encadena porque sin esto un
 * reset contra Supabase deja a las cuentas reales sin perfil.
 *
 * Lee DATABASE_URL de .env (o del entorno, que tiene prioridad). No usa
 * `$DATABASE_URL` en el npm script porque cmd.exe no lo expande.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");

function leerEnv() {
  const archivo = resolve(raiz, ".env");
  if (!existsSync(archivo)) return {};
  return Object.fromEntries(
    readFileSync(archivo, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

const env = leerEnv();
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copiá .env.example a .env y ajustá la cadena de conexión.");
  process.exit(1);
}

/** Las migraciones son todo 02..98, por orden de nombre. */
function migraciones() {
  return readdirSync(resolve(raiz, "db"))
    .filter((f) => /^\d\d_.+\.sql$/.test(f))
    .filter((f) => {
      const n = Number(f.slice(0, 2));
      return n >= 2 && n <= 98;
    })
    .sort();
}

const PASOS = {
  create: () => ["01_schema.sql"],
  migrate: migraciones,
  seed: () => ["99_seed.sql"],
  reset: () => ["00_reset.sql", "01_schema.sql", "99_seed.sql", "perfiles-desde-auth.sql"],
  perfiles: () => ["perfiles-desde-auth.sql"],
};

const comando = process.argv[2];
const paso = PASOS[comando];
if (!paso) {
  console.error(`Uso: node scripts/db.mjs <${Object.keys(PASOS).join("|")}>`);
  process.exit(1);
}

const archivos = paso();
if (archivos.length === 0) {
  console.log("No hay migraciones pendientes en db/.");
  process.exit(0);
}

const args = [url, "-v", "ON_ERROR_STOP=1"];

// perfiles-desde-auth.sql necesita saber quién es admin; no viene del SQL
// porque el correo no puede acabar en el repo.
if (archivos.includes("perfiles-desde-auth.sql")) {
  const adminEmail = process.env.ADMIN_EMAIL || env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("Falta ADMIN_EMAIL en .env: hace falta para saber a quién restaurar el rol admin.");
    process.exit(1);
  }
  args.push("-v", `admin_email=${adminEmail}`);
}

for (const f of archivos) args.push("-f", resolve(raiz, "db", f));

const r = spawnSync("psql", args, { stdio: "inherit", shell: process.platform === "win32" });

if (r.error?.code === "ENOENT") {
  console.error(
    "\nNo se encontró `psql` en el PATH.\n" +
      "En Windows suele estar en C:\\Program Files\\PostgreSQL\\<versión>\\bin.\n" +
      "Alternativa: abrí los archivos de db/ en pgAdmin y ejecutalos ahí.",
  );
  process.exit(1);
}

process.exit(r.status ?? 1);
