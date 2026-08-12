import { Sk, SkPantalla, SkTira } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <div style={{ padding: "20px 20px 0" }}>
        <Sk ancho="90px" alto="texto" />
      </div>

      <div className="detail-head">
        <Sk ancho="160px" alto="menudo" />
        <Sk ancho="46%" alto="titulo" style={{ margin: "var(--space-2) 0" }} />
        <Sk ancho="62%" alto="texto" style={{ marginBottom: "var(--space-4)" }} />

        <div className="actions">
          <Sk ancho="150px" alto="boton" />
          <Sk ancho="92px" alto="boton" />
          <Sk ancho="104px" alto="boton" />
        </div>
      </div>

      <SkTira compacta />

      <div className="day-tabs">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="day-tab" key={i}>
            <Sk ancho="72px" alto="texto" />
          </div>
        ))}
      </div>

      <div className="day-panel">
        <Sk ancho="40%" alto="subtitulo" />
        <Sk ancho="55%" alto="texto" style={{ margin: "var(--space-1) 0 var(--space-4)" }} />

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 38 }}>#</th>
                <th>Ejercicio</th>
                <th>Series</th>
                <th>Reps</th>
                <th>Carga</th>
                <th>Desc.</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, f) => (
                <tr key={f}>
                  <td>
                    <Sk ancho="14px" />
                  </td>
                  <td>
                    <Sk ancho="72%" />
                  </td>
                  <td>
                    <Sk ancho="28px" />
                  </td>
                  <td>
                    <Sk ancho="44px" />
                  </td>
                  <td>
                    <Sk ancho="60px" />
                  </td>
                  <td>
                    <Sk ancho="52px" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SkPantalla>
  );
}
