"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { crearInvitacion, revocarInvitacion } from "@/app/actions";
import { fechaCorta } from "@/lib/format";

export type Invitacion = {
  id: string;
  codigo: string;
  createdAt: Date;
  expiresAt: Date;
  usadoPor: string | null;
  estado: "activo" | "usado" | "caducado";
};

const ETIQUETA = {
  activo: "Sin usar",
  usado: "Canjeado",
  caducado: "Caducado",
} as const;

/**
 * Los códigos con los que un entrenador suma alumnos.
 *
 * El código se enseña entero y se puede copiar: se piensa para pasarlo por
 * mensaje o dictarlo en el gimnasio, no para mandarlo por correo desde aquí.
 */
export function Invitaciones({ invitaciones }: { invitaciones: Invitacion[] }) {
  const router = useRouter();

  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<string | null>(null);

  const generar = async () => {
    setTrabajando(true);
    setFallo(null);
    try {
      const { codigo } = await crearInvitacion();
      setNuevo(codigo);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo generar el código.");
    } finally {
      setTrabajando(false);
    }
  };

  const revocar = async (id: string) => {
    setTrabajando(true);
    setFallo(null);
    try {
      await revocarInvitacion(id);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo revocar.");
    } finally {
      setTrabajando(false);
    }
  };

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Sin permiso de portapapeles: el código está a la vista, se copia a mano.
    }
  };

  return (
    <section className="invites">
      <div className="invites-head">
        <div>
          <div className="eyebrow">Alumnos</div>
          <h2 className="invites-title">Códigos de invitación</h2>
          <p className="text-muted">
            Generá un código y pasáselo a tu alumno. Lo canjea desde su Entrenador y queda
            vinculado. Vale 7 días y para una sola persona.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => void generar()} disabled={trabajando}>
          {trabajando ? "Generando…" : "Generar código"}
        </button>
      </div>

      {fallo && <p className="editor-error">{fallo}</p>}

      {nuevo && (
        <p className="invites-nuevo">
          Código nuevo: <strong>{nuevo}</strong> — pasáselo a tu alumno.
        </p>
      )}

      {invitaciones.length === 0 ? (
        <p className="empty">Todavía no generaste ningún código.</p>
      ) : (
        <ul className="invites-list">
          {invitaciones.map((i) => (
            <li key={i.id} className="invites-row" data-estado={i.estado}>
              <code className="invites-codigo">{i.codigo}</code>
              <span className="invites-estado">
                {ETIQUETA[i.estado]}
                {i.estado === "usado" && i.usadoPor && ` · ${i.usadoPor}`}
                {i.estado === "activo" && ` · vence ${fechaCorta(i.expiresAt)}`}
              </span>
              <span className="invites-acciones">
                {i.estado === "activo" && (
                  <>
                    <button className="btn btn-ghost" onClick={() => void copiar(i.codigo)}>
                      {copiado === i.codigo ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => void revocar(i.id)}
                      disabled={trabajando}
                    >
                      Revocar
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
