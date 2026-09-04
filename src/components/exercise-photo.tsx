"use client";

import { useEffect, useRef, useState } from "react";

import { fotosEjercicio } from "@/lib/ejercicios-externos";

/**
 * Las dos fotos de un ejercicio, alternándose.
 *
 * free-exercise-db da inicio y final del movimiento, no un gif. Alternarlas
 * enseña el recorrido —que es de lo que sirve como guía— sin descargar vídeo:
 * son las dos mismas fotos que harían falta igual.
 *
 * Tres cosas que no son opcionales:
 *
 *   · **La primera foto es una `<img loading="lazy">` normal; la segunda se
 *     precarga con `IntersectionObserver`, solo cuando la tarjeta entra en
 *     pantalla.** Precargar las dos al montar —lo que hacía esto antes—
 *     saltaba el `loading="lazy"` de la primera: con 69 tarjetas no se nota,
 *     con 656+ del catálogo de free-exercise-db son cientos de peticiones de
 *     golpe en cuanto se pinta la página, paginada o no.
 *   · **Se queda quieta con `prefers-reduced-motion`.** Un bucle infinito en
 *     una rejilla de decenas de tarjetas es justo lo que esa preferencia pide
 *     evitar.
 *   · **Si la foto no carga, cae al placeholder.** Las fotos están hotlinkeadas
 *     a un CDN y el service worker no las cachea, así que en el gimnasio sin
 *     cobertura esto no es un caso raro: es el caso normal. Si falla la
 *     segunda foto no hay placeholder — se queda quieta en la primera, que sí
 *     cargó y sigue siendo una guía válida.
 */
export function ExercisePhoto({
  fedbId,
  imagenUrl,
  nombre,
  className,
  placeholder = "texto",
}: {
  fedbId: string | null;
  /** Foto propia. Si está, manda sobre la del catálogo. */
  imagenUrl: string | null;
  nombre: string;
  className?: string;
  /**
   * Qué enseñar cuando no hay foto. "texto" es el placeholder del diseño, que
   * pide una caja grande; en las miniaturas no cabe y deja un hueco limpio.
   */
  placeholder?: "texto" | "vacio";
}) {
  const fotos = fotosEjercicio(fedbId);
  const [fase, setFase] = useState(0);
  const [falloPrimera, setFalloPrimera] = useState(false);
  const [segundaLista, setSegundaLista] = useState(false);
  const [visible, setVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Cuándo empieza a importar esta foto: al entrar en pantalla, no al montar.
  // `rootMargin` adelanta un poco la carga para que no se note el salto al
  // llegar con el scroll.
  useEffect(() => {
    if (!fotos || !imgRef.current) return;
    setVisible(false);
    const el = imgRef.current;
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // Las URLs se derivan del id, así que este es el disparador real.
  }, [fedbId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Precarga de la segunda foto, solo tras hacerse visible. La primera no se
  // precarga por JS: la pinta el <img> de abajo con loading="lazy", que para
  // eso está.
  useEffect(() => {
    if (!visible || !fotos) return;
    setSegundaLista(false);
    setFase(0);

    let cancelado = false;
    const img = new Image();
    img.onload = () => !cancelado && montado.current && setSegundaLista(true);
    img.src = fotos[1];

    return () => {
      cancelado = true;
    };
  }, [visible, fedbId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!segundaLista) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (quieto.matches) return;

    const id = setInterval(() => setFase((f) => (f === 0 ? 1 : 0)), 1200);
    return () => clearInterval(id);
  }, [segundaLista]);

  // La foto propia gana: si alguien subió la suya es porque la del catálogo no
  // le servía. Estática, que es una sola.
  if (imagenUrl) {
    return (
      <img className={`grayscale ${className ?? ""}`} src={imagenUrl} alt={nombre} loading="lazy" />
    );
  }

  if (!fotos || falloPrimera) {
    return placeholder === "texto" ? <span>Imagen pendiente</span> : null;
  }

  return (
    <img
      ref={imgRef}
      className={`grayscale ${className ?? ""}`}
      src={fotos[fase]}
      alt={`${nombre}: posición ${fase === 0 ? "inicial" : "final"}`}
      loading="lazy"
      // Si falla la que se está enseñando: la primera no tiene con qué
      // reemplazarse y cae al placeholder; la segunda simplemente no llegó a
      // precargarse (segundaLista se queda en false) y esto no debería
      // disparar con fase 1, pero por si el navegador decide recargar la
      // imagen ya puesta, no deja la tarjeta rota.
      onError={() => (fase === 0 ? setFalloPrimera(true) : setFase(0))}
    />
  );
}
