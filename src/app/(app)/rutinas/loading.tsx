import { Sk, SkCabecera, SkFiltros, SkPantalla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <SkCabecera ancho="180px" accion />
      <SkFiltros n={5} />

      <div className="routine-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="routine-card" key={i}>
            <Sk ancho="88px" alto="menudo" />
            <Sk ancho="72%" alto="subtitulo" />
            <Sk ancho="100%" />
            <Sk ancho="84%" style={{ marginTop: "var(--space-1)" }} />
            <div className="routine-card-meta" style={{ marginTop: "auto" }}>
              <Sk ancho="48px" alto="menudo" />
              <Sk ancho="42px" alto="menudo" />
              <Sk ancho="60px" alto="menudo" />
            </div>
          </div>
        ))}
      </div>
    </SkPantalla>
  );
}
