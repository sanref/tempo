"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { borrarSesion } from "@/app/actions";
import { miles } from "@/lib/format";

/**
 * Corregir o borrar un entrenamiento del historial.
 *
 * "Editar" abre la misma pantalla de sesión en modo corrección (`?editar=1`),
 * no reabre la sesión: el índice único solo admite una en curso y el
 * cronómetro no tiene sentido en algo de hace tres semanas.
 */
export function AccionesSesion({
  sesionId,
  titulo,
  series,
  volumenKg,
  tuvoPr,
}: {
  sesionId: string;
  titulo: string;
  series: number;
  volumenKg: number;
  tuvoPr: boolean;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const borrar = async () => {
    setBorrando(true);
    setFallo(null);
    try {
      await borrarSesion(sesionId);
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo borrar.");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <>
      <div className="history-acciones">
        <Link className="btn btn-ghost" href={`/entrenar/${sesionId}?editar=1`}>
          Editar
        </Link>
        <button className="btn btn-ghost" onClick={() => setConfirmando(true)}>
          Borrar
        </button>
      </div>

      {confirmando && (
        <div
          className="dialog-backdrop"
          onClick={() => setConfirmando(false)}
          onKeyDown={(ev) => ev.key === "Escape" && setConfirmando(false)}
        >
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Borrar entrenamiento"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Borrar {titulo}?</div>
            <p className="dialog-body">
              Se van sus {series} {series === 1 ? "serie" : "series"} y {miles(volumenKg)} kg de
              volumen, así que el gráfico semanal y la adherencia cambian.
              {tuvoPr && " También las marcas personales que salieron de este entrenamiento."} La
              carga que subió la progresión en tu rutina se queda como está.
            </p>

            {fallo && <p className="editor-error">{fallo}</p>}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => void borrar()} disabled={borrando}>
                {borrando ? "Borrando…" : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
