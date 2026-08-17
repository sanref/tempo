import { Sk, SkFiltros, SkPantalla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <div className="screen-head">
        <Sk ancho="180px" alto="titulo" style={{ marginBottom: 10 }} />
        <Sk ancho="420px" alto="boton" style={{ maxWidth: "100%" }} />
      </div>

      <SkFiltros n={6} />

      <div className="library-grid">
        {Array.from({ length: 8 }, (_, i) => (
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
