"use client";

import { useState } from "react";

import { ExerciseName } from "@/components/exercise-name";
import { carga } from "@/lib/format";
import type { DiaConEjercicios } from "@/db/queries";

/**
 * Pestañas por día del detalle de rutina. Estado local: cambiar de día no
 * necesita ir al servidor, los días ya vienen todos en el payload.
 */
export function DayTabs({ dias }: { dias: DiaConEjercicios[] }) {
  const [i, setI] = useState(0);
  const dia = dias[i];

  if (!dia) return <p className="empty">Esta rutina todavía no tiene días.</p>;

  return (
    <>
      <div className="day-tabs" role="tablist">
        {dias.map((d, idx) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={idx === i}
            className="day-tab"
            data-active={idx === i}
            onClick={() => setI(idx)}
          >
            {d.codigo} · {d.nombre}
          </button>
        ))}
      </div>

      <div className="day-panel">
        <h4>{dia.titulo}</h4>
        <p className="text-muted">
          {dia.subtitulo}
          {dia.duracionMin ? ` · ~${dia.duracionMin} min` : ""}
        </p>

        {dia.ejercicios.length === 0 ? (
          <p className="text-muted" style={{ fontSize: "calc(13px * var(--escala-texto))" }}>
            Día sin ejercicios todavía.
          </p>
        ) : (
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
                {dia.ejercicios.map((e, n) => (
                  <tr key={e.id}>
                    <td className="text-muted">{n + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      <ExerciseName nombre={e.nombre} alias={e.alias} />
                    </td>
                    <td>{e.series}</td>
                    <td>{e.reps}</td>
                    <td>{carga(e.cargaKg, e.cargaTexto)}</td>
                    <td className="text-muted">{e.descansoS ?? dia.descansoDefectoS} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
