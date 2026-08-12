/**
 * Formato es-ES: coma decimal, punto de millar.
 * Toda cifra que se pinte en pantalla pasa por aquí.
 */

const NUM = new Intl.NumberFormat("es-ES");
const NUM1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** 18240 → "18.240" */
export function miles(n: number): string {
  return NUM.format(Math.round(n));
}

/** 72.5 → "72,5" · 72 → "72" */
export function kg(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return NUM1.format(v);
}

/** Carga de una serie planificada: número, texto libre o peso corporal. */
export function carga(cargaKg: string | null, cargaTexto: string | null): string {
  if (cargaTexto) return cargaTexto;
  const v = Number(cargaKg ?? 0);
  return v > 0 ? `${kg(v)} kg` : "Peso corp.";
}

/**
 * `reps` del plan es texto libre ('8', '8-12', '45 s'). Estas dos funciones lo
 * traducen a números al arrancar la sesión, con el mismo criterio que
 * `reps_planificadas()` y `segundos_planificados()` de db/01_schema.sql —
 * si tocás uno, tocá el otro.
 */

/** '8' → 8 · '8-12' → 8 (extremo bajo) · basura → 10. Acotado por el CHECK. */
export function repsPlanificadas(reps: string): number {
  const n = Number(reps.match(/\d+/)?.[0] ?? 10);
  return Math.min(100, Math.max(0, Number.isFinite(n) ? n : 10));
}

/** '45 s' → 45 · '1 min' → 60 · basura → 30. */
export function segundosPlanificados(reps: string): number {
  const n = Number(reps.match(/\d+/)?.[0] ?? 30);
  const factor = /min/i.test(reps) ? 60 : 1;
  return Math.min(3600, Math.max(0, (Number.isFinite(n) ? n : 30) * factor));
}

/** 45 → "45 s" · 90 → "1:30" */
export function tiempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 1847 → "30:47" */
export function mmss(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 4140 → "1 h 09 min" · 2580 → "43 min" */
export function duracion(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** 15600 → "4h 20m" — la tira de estadísticas de Inicio. */
export function duracionCorta(segundos: number): string {
  const min = Math.round(segundos / 60);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function diaMes(d: Date): { dia: string; mes: string } {
  return { dia: String(d.getDate()).padStart(2, "0"), mes: MESES[d.getMonth()] };
}

/** "2 ago" */
export function fechaCorta(d: Date): string {
  return `${d.getDate()} ${MESES[d.getMonth()].toLowerCase()}`;
}

/** "Martes 11 de agosto" */
export function fechaLarga(d: Date): string {
  const s = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(d)
    .replace(",", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Hoy" · "Ayer" · "Hace 9 días" · "—" */
export function desde(d: Date | null): string {
  if (!d) return "—";
  const hoy = new Date();
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

/** Semana en curso de un bloque que empezó en `inicio`, tope `semanas`. */
export function semanaDe(inicio: Date, semanas: number): number {
  const transcurridas = Math.floor((Date.now() - inicio.getTime()) / (7 * 86_400_000)) + 1;
  return Math.min(Math.max(transcurridas, 1), semanas);
}
