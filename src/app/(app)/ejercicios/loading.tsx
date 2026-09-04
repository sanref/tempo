import { Sk, SkFiltros, SkPantalla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <div className="screen-head">
        <Sk ancho="180px" alto="titulo" style={{ marginBottom: 10 }} />
        <Sk ancho="420px" alto="boton" style={{ maxWidth: "100%" }} />
      </div>

      {/* "Todos" + los 8 grupos del enum. */}
      <SkFiltros n={9} />

      <div className="library-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <div className="library-card" key={i}>
            <div className="sk library-thumb" />
            <div className="library-body">
              <Sk ancho="74%" alto="texto" />
              <Sk ancho="52%" alto="menudo" style={{ marginTop: "var(--space-1)" }} />
            </div>
          </div>
        ))}
      </div>
    </SkPantalla>
  );
}
