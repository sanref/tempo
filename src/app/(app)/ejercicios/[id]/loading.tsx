import { Sk, SkPantalla } from "@/components/skeleton";

/** Misma rejilla que la pantalla: la foto a la izquierda, el diagrama a la derecha. */
export default function Loading() {
  return (
    <SkPantalla>
      <div className="detail-head">
        <Sk ancho="90px" alto="menudo" />
        <Sk ancho="260px" alto="titulo" style={{ margin: "6px 0" }} />
        <Sk ancho="200px" alto="texto" />
      </div>

      <div className="ejercicio-detalle">
        <section>
          <Sk ancho="130px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
          <div className="sk detalle-foto" />
        </section>
        <section>
          <Sk ancho="170px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
          {/* Las siluetas usan su propia clase para conservar la proporción
              200×369; la escala de `Sk` no tiene un alto así. */}
          <div className="musculos-siluetas">
            <div className="sk musculos-cara" />
            <div className="sk musculos-cara" />
          </div>
        </section>
      </div>
    </SkPantalla>
  );
}
