import { Sk, SkCabecera, SkPantalla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <SkCabecera ancho="200px" />

      {Array.from({ length: 8 }, (_, i) => (
        <div className="history-row" key={i}>
          <div className="history-date">
            <Sk ancho="34px" alto="dato" />
            <Sk ancho="30px" alto="menudo" style={{ marginTop: "var(--space-1)" }} />
          </div>
          <div>
            <Sk ancho="52%" alto="subtitulo" />
            <Sk ancho="38%" alto="texto" style={{ marginTop: "var(--space-1)" }} />
          </div>
        </div>
      ))}
    </SkPantalla>
  );
}
