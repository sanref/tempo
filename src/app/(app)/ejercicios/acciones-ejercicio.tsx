"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { borrarEjercicio } from "@/app/actions";
import { ExerciseForm } from "@/components/exercise-form";
import type { UsoEjercicio } from "@/db/queries";

/**
 * Editar y borrar, solo en las tarjetas de ejercicios propios.
 *
 * El borrado se ofrece deshabilitado cuando el ejercicio está en uso, con el
 * motivo escrito: es lo mismo que impone la base con ON DELETE RESTRICT, pero
 * dicho antes de que el usuario lo intente. La acción vuelve a comprobarlo,
 * porque entre que se pinta la tarjeta y se pulsa el botón la rutina de al
 * lado puede haber cambiado.
 */
export function AccionesEjercicio({
  ejercicio,
  uso,
  grupos,
  equipos,
}: {
  ejercicio: { id: string; nombre: string; grupo: string; equipo: string };
  uso: UsoEjercicio;
  grupos: string[];
  equipos: string[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "editar" | "borrar">(null);
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const enUso = uso.rutinas > 0 || uso.series > 0;

  const motivo = [
    uso.rutinas > 0 && `en ${uso.rutinas} ${uso.rutinas === 1 ? "rutina" : "rutinas"}`,
    uso.series > 0 &&
      `con ${uso.series} ${uso.series === 1 ? "serie registrada" : "series registradas"}`,
  ]
    .filter(Boolean)
    .join(" y ");

  const borrar = async () => {
    setBorrando(true);
    setFallo(null);
    try {
      await borrarEjercicio(ejercicio.id);
      setModal(null);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo borrar.");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <>
      <div className="library-acciones">
        <button className="btn btn-ghost" onClick={() => setModal("editar")}>
          Editar
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setModal("borrar")}
          disabled={enUso}
          title={enUso ? `Está ${motivo}` : undefined}
        >
          Borrar
        </button>
      </div>

      {enUso && <span className="library-uso">Está {motivo}</span>}

      {modal === "editar" && (
        <div
          className="dialog-backdrop"
          onClick={() => setModal(null)}
          onKeyDown={(ev) => ev.key === "Escape" && setModal(null)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Editar ${ejercicio.nombre}`}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">Editar ejercicio</div>
            <ExerciseForm
              grupos={grupos}
              equipos={equipos}
              ejercicio={ejercicio}
              onCancelar={() => setModal(null)}
              onGuardado={() => {
                setModal(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      {modal === "borrar" && (
        <div className="dialog-backdrop" onClick={() => setModal(null)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar borrado"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Borrar {ejercicio.nombre}?</div>
            <p className="dialog-body">
              No está en ninguna rutina ni tiene series registradas, así que no se pierde
              nada. No se puede deshacer.
            </p>

            {fallo && <p className="editor-error">{fallo}</p>}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
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
