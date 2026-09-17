import paquete from "../../package.json";

/**
 * La versión de la app. Se escribe en un solo sitio, `package.json`, y sale de
 * ahí para la pantalla; el CHANGELOG y el tag de git la acompañan.
 *
 * Solo desde el servidor: importarlo en un componente de cliente mete el
 * `package.json` entero —con sus dependencias— en el bundle del navegador.
 */
export const VERSION: string = paquete.version;
