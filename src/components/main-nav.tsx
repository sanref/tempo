"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const RUTAS = [
  { href: "/", label: "Inicio" },
  { href: "/rutinas", label: "Rutinas" },
  { href: "/entrenar", label: "Entrenar" },
  { href: "/progreso", label: "Progreso" },
  { href: "/historial", label: "Historial" },
  { href: "/ejercicios", label: "Ejercicios" },
  { href: "/coach", label: "Entrenador" },
];

export function esActiva(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * `admin` no está en RUTAS porque no es para todos: llega como prop desde la
 * cabecera, que sí sabe quién mira. La barra de pestañas de móvil no lo lleva
 * — son cinco columnas fijas en el diseño y meter una sexta no es una decisión
 * que toque tomar aquí. Se llega escribiendo /admin.
 */
export function MainNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const rutas = admin ? [...RUTAS, { href: "/admin", label: "Admin" }] : RUTAS;

  return (
    <nav className="site-nav">
      {rutas.map((r) => (
        <Link key={r.href} href={r.href} aria-current={esActiva(pathname, r.href) ? "page" : undefined}>
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
