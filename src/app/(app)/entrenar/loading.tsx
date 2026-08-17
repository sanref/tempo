import { Sk, SkFilas, SkPantalla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <div className="screen-head">
        <Sk ancho="80px" alto="menudo" />
        <Sk ancho="46%" alto="titulo" style={{ margin: "var(--space-2) 0 var(--space-1)" }} />
        <Sk ancho="34%" alto="texto" />
      </div>

      <section style={{ padding: "24px 20px", maxWidth: 620 }}>
        <SkFilas n={6} />
        <Sk ancho="100%" alto="boton" style={{ marginTop: "var(--space-2)" }} />
        <Sk ancho="140px" alto="texto" style={{ marginTop: 14 }} />
      </section>
    </SkPantalla>
  );
}
