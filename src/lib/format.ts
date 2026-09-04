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
 * En qué está metido un ejercicio: "en 3 rutinas y con 240 series registradas".
 * `null` cuando no está en uso, que es cuando se puede borrar.
 *
 * Vive aquí y no junto a `AccionesEjercicio` porque lo necesitan los dos lados:
 * el botón de borrar (cliente) lo pone en su `title`, y la tarjeta de la
 * rejilla (servidor) lo pinta debajo de la fila de acciones. Un módulo con
 * `"use client"` no sirve —desde el servidor sus exports solo se pueden
 * renderizar o pasar como props, no llamar—, y este archivo no lleva directiva.
 */
export function motivoUso(uso: { rutinas: number; series: number }): string | null {
  const partes = [
    uso.rutinas > 0 && `en ${uso.rutinas} ${uso.rutinas === 1 ? "rutina" : "rutinas"}`,
    uso.series > 0 &&
      `con ${uso.series} ${uso.series === 1 ? "serie registrada" : "series registradas"}`,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" y ") : null;
}

/**
 * `reps` del plan es texto libre ('8', '8-12', '45 s'). Estas dos funciones lo
 * traducen a números al arrancar la sesión, con el mismo criterio que
 * `reps_planificadas()` y `segundos_planificados()` de db/01_schema.sql —
 * si tocás uno, tocá el otro.
 */

/**
 * Los tramos de un texto de reps: la barra separa series.
 *
 *   '10'          → ['10']            todas las series igual
 *   '8-12'        → ['8-12']          un rango, todas las series igual
 *   '15/12/10/10' → ['15','12','10','10']   una serie por tramo
 *
 * La barra y no el guion: '8-12' ya significaba un rango antes de que
 * existieran las series por tramo, y sobrecargar el guion volvía ambiguo si
 * '8-12' eran dos series o un rango.
 */
export function tramosReps(reps: string): string[] {
  return reps
    .split("/")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Cuántas series describe el texto. Acotado por el CHECK de la columna. */
export function seriesEnReps(reps: string): number {
  return Math.min(8, Math.max(1, tramosReps(reps).length));
}

/** El tramo de la serie `i`. Si hay menos tramos que series, repite el último. */
function tramo(reps: string, serie: number): string {
  const t = tramosReps(reps);
  if (t.length === 0) return reps;
  return t[Math.min(Math.max(0, serie), t.length - 1)];
}

/**
 * '8' → 8 · '8-12' → 8 (extremo bajo) · basura → 10. Acotado por el CHECK.
 *
 * `serie` es el índice base 0 dentro del bloque: con '15/12/10' la serie 1
 * pide 12. Sin él se comporta como antes y devuelve el primer tramo.
 */
export function repsPlanificadas(reps: string, serie = 0): number {
  const n = Number(tramo(reps, serie).match(/\d+/)?.[0] ?? 10);
  return Math.min(100, Math.max(0, Number.isFinite(n) ? n : 10));
}

/** '45 s' → 45 · '1 min' → 60 · '45 s/30 s' serie 1 → 30 · basura → 30. */
export function segundosPlanificados(reps: string, serie = 0): number {
  const t = tramo(reps, serie);
  const n = Number(t.match(/\d+/)?.[0] ?? 30);
  const factor = /min/i.test(t) ? 60 : 1;
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

/**
 * `YYYY-MM-DD` en hora local, que es lo que espera un `<input type="date">`.
 *
 * A mano y no con `toISOString()`, que formatea en UTC: un entrenamiento de
 * las diez de la noche en UTC-3 ya es del día siguiente allí, y el campo
 * habría salido con la fecha de mañana.
 */
export function fechaInput(d: Date): string {
  const dos = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * El mismo instante trasladado a otro día, conservando la hora.
 *
 * Tampoco vale `new Date('2026-08-30')`: esa forma se parsea como medianoche
 * UTC y con cualquier desfase cae en el día de al lado.
 */
export function conFecha(original: Date, ymd: string): Date {
  const [anio, mes, dia] = ymd.split("-").map(Number);
  const salida = new Date(original);
  salida.setFullYear(anio, mes - 1, dia);
  return salida;
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
