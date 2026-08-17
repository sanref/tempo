"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ExerciseForm } from "@/components/exercise-form";

/**
 * Botón y diálogo de alta en la biblioteca.
 *
 * Al crear se hace `router.refresh()`: esta pantalla no tiene nada a medio
 * editar que se pueda perder, así que lo más simple es volver a pedirle la
 * lista al servidor y que respete el filtro y la búsqueda que hubiera puestos.
 */
export function NuevoEjercicio({ grupos, equipos }: { grupos: string[]; equipos: string[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button className="btn btn-primary" onClick={() => setAbierto(true)}>
        <Plus size={14} strokeWidth={3} /> Nuevo ejercicio
      </button>

      {abierto && (
        <div
          className="dialog-backdrop"
          onClick={() => setAbierto(false)}
          onKeyDown={(ev) => ev.key === "Escape" && setAbierto(false)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo ejercicio"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">Nuevo ejercicio</div>
            <ExerciseForm
              grupos={grupos}
              equipos={equipos}
              onCancelar={() => setAbierto(false)}
              onGuardado={() => {
                setAbierto(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
