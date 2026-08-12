import type { ReactNode } from "react";

export type Stat = {
  label: string;
  value: ReactNode;
  /** Unidad pequeña pegada a la cifra: "kg", "sem"… */
  unidad?: string;
  acento?: boolean;
};

/**
 * La tira de métricas con reglas de 2px arriba y abajo y separadores de 1px.
 * Se usa en Inicio (cifras a 28px) y en Detalle de rutina (22px).
 */
export function StatStrip({ stats, compacta = false }: { stats: Stat[]; compacta?: boolean }) {
  return (
    <div className={compacta ? "stat-strip stat-strip--bottom" : "stat-strip"}>
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <div className="stat-label">{s.label}</div>
          <div
            className={[
              "stat-value",
              compacta ? "stat-value--sm" : "",
              s.acento ? "stat-value--accent" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {s.value}
            {s.unidad && <span className="stat-unit"> {s.unidad}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
