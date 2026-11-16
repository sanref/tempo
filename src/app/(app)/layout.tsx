import { PieApp } from "@/components/pie-app";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { getCurrentUser } from "@/lib/auth";
import { VERSION } from "@/lib/version";

/**
 * Todo lo que exige sesión cuelga de aquí.
 *
 * El grupo `(app)` no aparece en la URL: `/` sigue siendo `/`. Existe para que
 * /login y /offline se queden fuera — la primera porque no puede pedir sesión
 * para dejarte iniciarla, y la segunda porque tiene que poder renderizarse con
 * la base caída.
 *
 * `getCurrentUser()` corta y manda a /login si no hay sesión. El middleware ya
 * lo hace antes, pero esto es lo que lo garantiza: si alguien toca el matcher,
 * las pantallas siguen protegidas.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <div className="app-shell">{children}</div>
      {/* Versión de la app más controles plegables de texto e instalación PWA. */}
      <PieApp version={VERSION} />
      <TabBar />
    </>
  );
}
