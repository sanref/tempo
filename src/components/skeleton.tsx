import type { CSSProperties, ReactNode } from "react";

/**
 * ── Esqueletos de carga ────────────────────────────────────────────────────
 *
 * Piezas para los `loading.tsx`. La regla es que el esqueleto tenga la misma
 * estructura que la pantalla real —mismas clases de rejilla, mismos bordes—
 * y solo sustituya el texto por bloques. Si el esqueleto inventa un layout
 * propio, al llegar los datos la página salta y se nota más que si no hubiera
 * nada.
 *
 * Nada de esto lee de la base: son Server Components estáticos.
 */

type Alto = "titulo" | "dato" | "subtitulo" | "texto" | "menudo" | "tag" | "boton";

/** Un bloque. El ancho es de cada sitio; el alto sale de la escala. */
export function Sk({
  ancho = "100%",
  alto = "texto",
  style,
}: {
  ancho?: string;
  alto?: Alto;
  style?: CSSProperties;
}) {
  return <span className={`sk sk--${alto}`} style={{ width: ancho, ...style }} />;
}

/**
 * Envoltorio de pantalla. Marca la carga para lectores de pantalla: los
 * bloques son decorativos y no dicen nada por sí solos.
 */
export function SkPantalla({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sk-aviso">Cargando…</span>
      {children}
    </div>
  );
}

/** Cabecera de pantalla: título, línea de contexto y, si toca, el botón. */
export function SkCabecera({
  ancho = "42%",
  accion = false,
  eyebrow = false,
}: {
  ancho?: string;
  accion?: boolean;
  eyebrow?: boolean;
}) {
  return (
    <div className={accion ? "screen-head screen-head--split" : "screen-head"}>
      <div>
        {eyebrow && <Sk ancho="90px" alto="menudo" style={{ marginBottom: "var(--space-2)" }} />}
        <Sk ancho={ancho} alto="titulo" />
        <Sk ancho="26%" alto="texto" style={{ marginTop: "var(--space-2)" }} />
      </div>
      {accion && <Sk ancho="150px" alto="boton" />}
    </div>
  );
}

export function SkFiltros({ n = 5 }: { n?: number }) {
  // Anchos desiguales a propósito: una fila de bloques idénticos se lee como
  // una tabla vacía, no como texto que va a llegar.
  const anchos = ["64px", "82px", "120px", "96px", "78px", "70px"];
  return (
    <div className="filter-row">
      {Array.from({ length: n }, (_, i) => (
        <Sk key={i} ancho={anchos[i % anchos.length]} alto="tag" />
      ))}
    </div>
  );
}

/** Lista `.rows`: etiqueta a la izquierda, cifra a la derecha. */
export function SkFilas({ n = 5 }: { n?: number }) {
  const anchos = ["58%", "44%", "66%", "50%", "62%", "40%"];
  return (
    <div className="rows">
      {Array.from({ length: n }, (_, i) => (
        <div className="row" key={i}>
          <Sk ancho={anchos[i % anchos.length]} />
          <Sk ancho="70px" />
        </div>
      ))}
    </div>
  );
}

export function SkTira({ n = 4, compacta = false }: { n?: number; compacta?: boolean }) {
  return (
    <div className={compacta ? "stat-strip stat-strip--bottom" : "stat-strip"}>
      {Array.from({ length: n }, (_, i) => (
        <div className="stat" key={i}>
          <Sk ancho="52px" alto="menudo" />
          <Sk ancho="72px" alto="dato" style={{ marginTop: "var(--space-2)" }} />
        </div>
      ))}
    </div>
  );
}

/** Tabla con cabeceras reales: los títulos de columna no dependen de la base. */
export function SkTabla({ columnas, filas = 6 }: { columnas: string[]; filas?: number }) {
  const anchos = ["70%", "56%", "40%", "64%", "48%", "34%"];
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: filas }, (_, f) => (
            <tr key={f}>
              {columnas.map((c, i) => (
                <td key={c}>
                  <Sk ancho={anchos[(f + i) % anchos.length]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
