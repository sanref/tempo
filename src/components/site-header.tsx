import Link from "next/link";
import { LogOut } from "lucide-react";

import { cerrarSesion } from "@/app/actions";
import type { User } from "@/db/schema";
import { esAdmin } from "@/lib/auth";

import { MainNav } from "./main-nav";
import { PerfilModal } from "./perfil-modal";

/**
 * El usuario llega como prop desde el layout, que ya lo resolvió: la cabecera
 * solo se pinta cuando hay sesión, así que aquí no hace falta comprobarlo otra
 * vez ni tragarse errores de base.
 */
export function SiteHeader({
  user,
  coachNombre,
}: {
  user: User;
  coachNombre: string | null;
}) {
  return (
    <header className="nav site-header">
      <Link href="/" className="nav-brand brand">
        <span className="brand-mark" aria-hidden />
        TEMPO
      </Link>
      <MainNav admin={esAdmin(user)} />
      <div className="header-acciones">
        <PerfilModal
          nombre={user.nombre}
          email={user.email}
          role={user.role}
          coachNombre={coachNombre}
        />
        {/* Cerrar sesión borra la cookie: es una mutación, y las mutaciones no
            cuelgan de un GET — Next prefetchea los <Link> al pasar el ratón. */}
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="btn btn-icon"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}
