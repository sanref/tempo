import { Sk, SkCabecera, SkPantalla, SkTabla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <SkCabecera ancho="190px" />

      <div className="split progress-split">
        <section>
          <Sk ancho="220px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
          <Sk ancho="180px" alto="titulo" />
          <div className="sk" style={{ height: "160px", marginTop: 14 }} />
        </section>

        <section>
          <Sk ancho="260px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
          {Array.from({ length: 6 }, (_, i) => (
            <div className="mg-row" key={i}>
              <Sk ancho="80%" alto="texto" />
              <Sk ancho="100%" alto="tag" style={{ height: 12 }} />
              <Sk ancho="24px" alto="texto" />
            </div>
          ))}
        </section>
      </div>

      <section style={{ padding: "24px 20px" }}>
        <Sk ancho="150px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
        <SkTabla columnas={["Ejercicio", "Marca", "Fecha", "Cambio"]} filas={5} />
      </section>
    </SkPantalla>
  );
}
