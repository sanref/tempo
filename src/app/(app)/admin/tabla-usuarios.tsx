"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cambiarActivo, cambiarRol } from "@/app/actions";

export type UsuarioAdmin = {
  id: string;
  nombre: string;
  email: string;
  role: "alumno" | "entrenador" | "admin";
  activo: boolean;
  coachNombre: string | null;
};

const ROLES = ["alumno", "entrenador", "admin"] as const;

/**
 * La tabla de /admin.
 *
 * Las filas propias salen sin controles: un admin que se degrade o se
 * desactive puede dejar la instalación sin nadie capaz de repartir roles, y
 * volver a entrar sería un UPDATE a mano en la base. Las acciones lo rechazan
 * igual — esto solo evita ofrecer el botón.
 */
export function TablaUsuarios({ usuarios, yo }: { usuarios: UsuarioAdmin[]; yo: string }) {
  const router = useRouter();

  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const correr = async (id: string, fn: () => Promise<unknown>) => {
    setTrabajando(id);
    setFallo(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo aplicar el cambio.");
    } finally {
      setTrabajando(null);
    }
  };

  return (
    <>
      {fallo && (
        <p className="editor-error" style={{ margin: "16px 20px 0" }}>
          {fallo}
        </p>
      )}

      <div style={{ padding: 20 }} className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Entrenador</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const soyYo = u.id === yo;
              const ocupado = trabajando === u.id;

              return (
                <tr key={u.id} data-inactivo={!u.activo}>
                  <td style={{ fontWeight: 600 }}>
                    {u.nombre}
                    {soyYo && <span className="text-muted"> · vos</span>}
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    {soyYo ? (
                      <span className="text-muted">{u.role}</span>
                    ) : (
                      <select
                        className="input"
                        value={u.role}
                        disabled={ocupado}
                        onChange={(e) =>
                          void correr(u.id, () =>
                            cambiarRol(u.id, e.target.value as UsuarioAdmin["role"]),
                          )
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="text-muted">{u.coachNombre ?? "—"}</td>
                  <td className={u.activo ? undefined : "text-muted"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </td>
                  <td>
                    {!soyYo && (
                      <button
                        className="btn btn-ghost"
                        disabled={ocupado}
                        onClick={() => void correr(u.id, () => cambiarActivo(u.id, !u.activo))}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
