import { miles } from "@/lib/format";

type Semana = { label: string; volumenKg: number };

/**
 * Barras de volumen semanal. La última semana va en rojo (es la que corre).
 * Sin librería: son doce divs con una altura porcentual.
 */
export function WeeklyVolumeChart({ semanas }: { semanas: Semana[] }) {
  const tope = Math.max(...semanas.map((s) => s.volumenKg), 1) * 1.05;

  return (
    <>
      <div className="bar-chart">
        {semanas.map((s, i) => (
          <div className="bar-chart-col" key={s.label}>
            <div
              className={i === semanas.length - 1 ? "bar bar--current" : "bar"}
              style={{ height: `${Math.round((s.volumenKg / tope) * 100)}%` }}
              title={`${s.label}: ${miles(s.volumenKg)} kg`}
            />
          </div>
        ))}
      </div>
      <div className="bar-labels">
        {semanas.map((s) => (
          <span key={s.label}>{s.label}</span>
        ))}
      </div>
    </>
  );
}
