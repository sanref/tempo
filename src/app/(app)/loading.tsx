import { Sk, SkFilas, SkPantalla, SkTira } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <div className="home-head">
        <Sk ancho="120px" alto="menudo" />
        <Sk ancho="240px" alto="titulo" style={{ margin: "var(--space-2) 0 var(--space-1)" }} />
        <Sk ancho="60%" alto="texto" />
      </div>

      <SkTira />

      <div className="split">
        <section>
          <Sk ancho="130px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
          <div className="next-session">
            <Sk ancho="55%" alto="subtitulo" />
            <Sk ancho="70%" alto="texto" style={{ margin: "var(--space-2) 0 var(--space-4)" }} />
            <SkFilas n={5} />
            <Sk ancho="100%" alto="boton" style={{ marginTop: "var(--space-4)" }} />
          </div>
        </section>

        <section>
          <Sk ancho="150px" alto="menudo" style={{ marginBottom: "var(--space-3)" }} />
          <div className="sk" style={{ height: "150px" }} />

          <Sk ancho="140px" alto="menudo" style={{ margin: "var(--space-8) 0 var(--space-3)" }} />
          <SkFilas n={3} />
        </section>
      </div>
    </SkPantalla>
  );
}
