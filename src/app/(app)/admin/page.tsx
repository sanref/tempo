import { notFound } from "next/navigation";

import { getUsuarios } from "@/db/queries";
import { esAdmin, getCurrentUser } from "@/lib/auth";

import { TablaUsuarios } from "./tabla-usuarios";

export const dynamic = "force-dynamic";

/**
 * Administración de usuarios.
 *
 * `notFound()` en vez de un "no tenés permiso": para quien no es admin la ruta
 * ni existe, que es una pista menos sobre qué hay detrás.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!esAdmin(user)) notFound();

  const usuarios = await getUsuarios();

  return (
    <div>
      <div className="screen-head">
        <div className="eyebrow">Administración</div>
        <h1>Usuarios</h1>
        <p className="text-muted">
          {usuarios.length} en total. Cambiar a entrenador habilita el panel de clientes y los
          códigos de invitación.
        </p>
      </div>

      <TablaUsuarios usuarios={usuarios} yo={user.id} />
    </div>
  );
}
