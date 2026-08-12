import { Sk, SkPantalla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <div className="editor-head">
        <div>
          <Sk ancho="120px" alto="menudo" />
          <Sk ancho="320px" alto="boton" style={{ marginTop: "var(--space-2)" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Sk ancho="96px" alto="boton" />
          <Sk ancho="96px" alto="boton" />
        </div>
      </div>

      <div className="day-tabs">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="day-tab" key={i}>
            <Sk ancho="72px" alto="texto" />
          </div>
        ))}
      </div>

      <div className="editor-grid">
        <section>
          <Sk ancho="180px" alto="menudo" style={{ marginBottom: "var(--space-4)" }} />

          {Array.from({ length: 5 }, (_, i) => (
            <div className="editor-row" key={i}>
              <Sk ancho="16px" alto="texto" />
              <div>
                <Sk ancho="62%" alto="texto" />
                <Sk ancho="40%" alto="menudo" style={{ marginTop: "var(--space-1)" }} />
              </div>
              <Sk ancho="96px" alto="boton" />
            </div>
          ))}

          <Sk ancho="100%" alto="boton" style={{ marginTop: "var(--space-2)" }} />
        </section>

        <section>
          <Sk ancho="130px" alto="menudo" style={{ marginBottom: "var(--space-4)" }} />

          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <Sk ancho="140px" alto="menudo" style={{ marginBottom: "var(--space-2)" }} />
              <Sk ancho="100%" alto="boton" />
            </div>
          ))}
        </section>
      </div>
    </SkPantalla>
  );
}
