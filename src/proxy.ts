import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ── Refresco de sesión y guarda de rutas ───────────────────────────────────
 *
 * Dos trabajos, en este orden:
 *
 *   1. Renovar el token si caducó. Es el único sitio donde se puede: durante el
 *      render de un Server Component ya no se pueden escribir cookies.
 *   2. Cortar el paso a quien no tenga sesión.
 *
 * Corre en el runtime Edge, así que aquí no entra ni Drizzle ni `pg`. Sabe si
 * hay sesión, no quién es: el rol (alumno / entrenador) lo comprueba cada
 * pantalla con `getCurrentUser()`, que sí llega a la base.
 *
 * Se llama `proxy.ts` porque es como Next 16 renombró el antiguo
 * `middleware.ts`; la firma y el `config.matcher` son los mismos.
 */

/** Rutas que se ven sin sesión. El resto exige login. */
const PUBLICAS = ["/login", "/offline", "/recuperar"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Llamada obligatoria: es la que refresca el token y dispara `setAll`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPublica = PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Para volver a donde iba después de entrar.
    if (pathname !== "/") url.searchParams.set("volver", pathname);
    return redirigir(url, response);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirigir(url, response);
  }

  return response;
}

/**
 * Redirige sin perder las cookies que acabe de renovar Supabase. Si se
 * devuelve un `NextResponse.redirect` limpio, el token nuevo se pierde y el
 * usuario vuelve a caer en /login en la siguiente petición.
 */
function redirigir(url: URL, previa: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of previa.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos y lo que sirve el service worker por su cuenta.
     * `sw.js` y `manifest.webmanifest` tienen que llegar sin pasar por aquí: si
     * el middleware los redirige a /login, la PWA deja de instalarse.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
