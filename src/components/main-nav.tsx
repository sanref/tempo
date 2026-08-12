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

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      {RUTAS.map((r) => (
        <Link key={r.href} href={r.href} aria-current={esActiva(pathname, r.href) ? "page" : undefined}>
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
