"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { borrarEjercicio } from "@/app/actions";
import { ExerciseForm, type EjercicioEditable } from "@/components/exercise-form";
import type { UsoEjercicio } from "@/db/queries";
import { motivoUso } from "@/lib/format";

/**
 * Editar y borrar. Aparece en los ejercicios propios y, para un admin, también
 * en los del catálogo común — que es la única forma de arreglar desde la app
 * una fila que no tiene dueño.
 *
 * El borrado se ofrece deshabilitado cuando el ejercicio está en uso, con el
 * motivo escrito: es lo mismo que impone la base con ON DELETE RESTRICT, pero
 * dicho antes de que el usuario lo intente. La acción vuelve a comprobarlo,
 * porque entre que se pinta la tarjeta y se pulsa el botón la rutina de al
 * lado puede haber cambiado.
 *
 * `compacto` es la versión de la rejilla: solo iconos y sin envoltorio propio,
 * porque allí estos dos botones comparten una única línea con "Añadir a rutina"
 * y "Mi nombre", y quien la dibuja es la pantalla. Sin él —en el detalle, donde
 * sobra ancho— van con texto y con su fila, como siempre.
 */
export function AccionesEjercicio({
  ejercicio,
  uso,
  grupos,
  equipos,
  esAdmin = false,
  compacto = false,
}: {
  ejercicio: EjercicioEditable;
  uso: UsoEjercicio;
  grupos: string[];
  equipos: string[];
  esAdmin?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "editar" | "borrar">(null);
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const motivo = motivoUso(uso);
  const enUso = motivo !== null;

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

  const editar = `Editar ${ejercicio.nombre}`;
  const borrarTexto = enUso ? `No se puede borrar: está ${motivo}` : `Borrar ${ejercicio.nombre}`;

  return (
    <>
      {compacto ? (
        <>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setModal("editar")}
            title={editar}
            aria-label={editar}
          >
            <Pencil size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setModal("borrar")}
            disabled={enUso}
            title={borrarTexto}
            aria-label={borrarTexto}
          >
            <Trash2 size={16} />
          </button>
        </>
      ) : (
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
        </>
      )}

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
              esAdmin={esAdmin}
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

            {ejercicio.esPublico && (
              <p className="aviso-comun">
                Es del catálogo común: desaparece para todo el mundo, no solo para vos.
              </p>
            )}

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
