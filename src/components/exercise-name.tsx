/**
 * El nombre de un ejercicio tal como lo ve quien mira.
 *
 * Sin alias es el nombre del catálogo y ya está. Con alias manda el alias, y el
 * nombre real baja a una línea chica debajo: nunca se esconde, porque es el
 * único ancla común entre dos personas que llaman distinto al mismo movimiento
 * —y el que sale en la foto, en el buscador del catálogo externo y en el SQL.
 *
 * Quién gana lo decide la capa de lectura, no esto: `coalesce(el mío, el del
 * autor de la rutina, nombre)` en `cargarDias()` y `getSesion()`, solo el mío
 * en la biblioteca y el progreso.
 *
 * Sin "use client" a propósito: es presentación pura y lo importan tanto las
 * pantallas de servidor (/ejercicios, day-tabs) como las de cliente
 * (session-client, editor-client).
 */

export type ConNombre = { nombre: string; alias?: string | null };

/**
 * El nombre en una sola cadena, para donde no cabe el par: `aria-label`, el
 * `alt` de una foto, el título de un diálogo.
 */
export function nombreVisible(e: ConNombre): string {
  return e.alias?.trim() || e.nombre;
}

export function ExerciseName({
  nombre,
  alias,
  className,
}: ConNombre & { className?: string }) {
  const propio = alias?.trim();

  if (!propio) return <span className={className}>{nombre}</span>;

  return (
    <span className={className}>
      {propio}
      <small className="nombre-real">{nombre}</small>
    </span>
  );
}
