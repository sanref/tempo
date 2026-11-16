/**
 * Curva de 1RM estimado. SVG con `preserveAspectRatio: none` y trazo de ancho
 * no escalado: se estira a lo ancho sin deformar la línea. Los ejes son los
 * bordes de 2px del contenedor, no elementos dibujados.
 */
export function E1rmChart({ puntos }: { puntos: number[] }) {
  const validos = puntos.filter((p) => p > 0);
  if (validos.length < 2) {
    return (
      <p className="text-muted" style={{ fontSize: "calc(13px * var(--escala-texto))", marginTop: 14 }}>
        Hacen falta al menos dos semanas de registros para dibujar la curva.
      </p>
    );
  }

  const min = Math.min(...validos) * 0.97;
  const max = Math.max(...validos) * 1.03;
  const rango = max - min || 1;

  // Las semanas sin registro no cortan la línea: se interpola visualmente
  // saltándolas, que es menos mentiroso que hundirlas a cero.
  const d = puntos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p > 0)
    .map(({ p, i }, k) => {
      const x = (i * 100) / (puntos.length - 1);
      const y = 100 - ((p - min) / rango) * 100;
      return `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
      aria-label="Evolución del 1RM estimado en las últimas semanas">
      <path d={d} fill="none" stroke="#ec3013" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
