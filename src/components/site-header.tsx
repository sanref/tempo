import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";

import { MainNav } from "./main-nav";

export async function SiteHeader() {
  // Con auth real esto pasa a ser la sesión; hoy es el usuario de MOCK_USER_ID.
  let nombre: string | null = null;
  let rol: string | null = null;
  try {
    const user = await getCurrentUser();
    nombre = user.nombre;
    rol = user.role;
  } catch {
    // La base todavía no está lista: la cabecera no debe tumbar la página,
    // el error se cuenta con detalle en error.tsx.
  }

  return (
    <header className="nav site-header">
      <Link href="/" className="nav-brand brand">
        <span className="brand-mark" aria-hidden />
        TEMPO
      </Link>
      <MainNav />
      {nombre && (
        <span className="user-chip">
          <strong>{nombre}</strong>
          {rol === "entrenador" ? "entrenador" : "alumno"}
        </span>
      )}
    </header>
  );
}
