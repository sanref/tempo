/**
 * ── Service worker de Tempo ────────────────────────────────────────────────
 *
 * Un único objetivo: que recargar sin red no deje la pantalla en blanco. La
 * cola offline de la sesión ya guarda las series en el teléfono, pero no sirve
 * de nada si al volver a abrir la app el navegador no tiene ni el HTML.
 *
 * Qué NO hace, a propósito:
 *
 *   · No toca nada que no sea GET. Las mutaciones son server actions (POST) y
 *     tienen que llegar al servidor o fallar de verdad, para que la cola de
 *     `session-client.tsx` se entere y reintente.
 *   · No cachea payloads RSC. Comparten URL con el documento y guardarlos
 *     envenena la navegación. Si fallan, Next cae a navegación completa y ahí
 *     sí entra el caché de documentos de abajo.
 *   · No sirve datos frescos de mentira: las páginas van a red primero. El
 *     caché es la red de seguridad, no la fuente.
 *
 * Al subir la versión se tiran los cachés viejos enteros.
 */

const VERSION = "tempo-v2";
const SHELL = `${VERSION}-shell`; // documentos HTML
const ESTATICOS = `${VERSION}-estaticos`; // /_next/static, iconos, diagramas, manifest

/** Cuántos documentos se guardan. Cada sesión de entrenamiento es una URL. */
const MAX_DOCUMENTOS = 30;

const PRECACHE_ESTATICOS = [
  "/icon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      const estaticos = await caches.open(ESTATICOS);

      // Individual y tolerante: con `addAll` un solo 404 tumba la instalación
      // entera y la app se queda sin service worker.
      await Promise.allSettled([
        shell.add(new Request("/offline", { cache: "reload" })),
        ...PRECACHE_ESTATICOS.map((ruta) =>
          estaticos.add(new Request(ruta, { cache: "reload" })),
        ),
      ]);

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // El propio SW nunca sale del caché: tiene que ver cambios nuevos siempre.
  if (url.pathname === "/sw.js") return;

  // Payloads RSC (prefetch al pasar el ratón, navegación cliente): solo red.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  // Assets con hash en el nombre: inmutables, el caché siempre acierta.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(primeroCache(req, ESTATICOS));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(documento(req));
    return;
  }

  // Imágenes locales, iconos de la PWA y máscaras SVG de músculos (`mask-image`
  // no siempre viaja con `destination === "image"` en todos los navegadores).
  if (
    req.destination === "image" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/musculos/")
  ) {
    event.respondWith(primeroCache(req, ESTATICOS));
  }
});

/** Cache-first. Para lo que no cambia sin cambiar de URL. */
async function primeroCache(req, nombre) {
  const cache = await caches.open(nombre);
  const guardado = await cache.match(req);
  if (guardado) return guardado;

  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

/**
 * Network-first para documentos. Los datos de Tempo cambian a cada serie, así
 * que servir HTML viejo teniendo red sería mentir; el caché entra solo cuando
 * la red falla. La cola de la sesión se rehidrata encima del HTML cacheado y
 * pisa lo que traiga, así que un documento algo viejo sigue siendo correcto.
 */
async function documento(req) {
  const cache = await caches.open(SHELL);

  try {
    const res = await fetch(req);
    if (res.ok) {
      cache.put(req, res.clone());
      void podar(cache);
    }
    return res;
  } catch {
    // `ignoreVary`: Next marca el HTML con `Vary: RSC, Next-Router-State-Tree…`
    // y sin esto una navegación normal no reencuentra su propia copia. Es
    // seguro porque aquí dentro nunca se guardan respuestas RSC.
    const copia = await cache.match(req, { ignoreVary: true });
    if (copia) return copia;

    const sinRed = await cache.match("/offline", { ignoreVary: true });
    if (sinRed) return sinRed;

    return Response.error();
  }
}

/** El caché de documentos crece con cada sesión; se queda con las últimas. */
async function podar(cache) {
  const claves = await cache.keys();
  const sobran = claves.length - MAX_DOCUMENTOS;
  if (sobran <= 0) return;

  for (const req of claves.slice(0, sobran)) {
    if (new URL(req.url).pathname !== "/offline") await cache.delete(req);
  }
}
