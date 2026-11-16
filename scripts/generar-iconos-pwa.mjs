/**
 * Genera los iconos PNG de la PWA y de iOS a partir de la geometría exacta de
 * `public/icon.svg` (sistema Modernist: #f3f2f2, #ec3013, #201e1d).
 *
 * Sin dependencias externas: codifica PNG RGB directo con `node:zlib` para no
 * meter paquetes nativos de imagen en `node_modules` solo por cinco estáticos.
 *
 * Uso: `node scripts/generar-iconos-pwa.mjs`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const COLORES = {
  fondo: [0xf3, 0xf2, 0xf2],
  acento: [0xec, 0x30, 0x13],
  texto: [0x20, 0x1e, 0x1d],
};

/**
 * Rectángulos de `public/icon.svg` en coordenadas sobre un lienzo de 512×512.
 * En la variante `maskable` se escalan hacia el centro por 0,78 para que las
 * cuatro esquinas entren con holgura dentro del círculo seguro del 80% que
 * recortan Android y ChromeOS.
 */
const FIGURAS_BASE = [
  { x: 96, y: 96, w: 128, h: 128, color: COLORES.acento },
  { x: 96, y: 288, w: 320, h: 40, color: COLORES.texto },
  { x: 96, y: 368, w: 200, h: 40, color: COLORES.texto },
];

function escalarFiguras(lado, maskable) {
  const factorMaskable = maskable ? 0.78 : 1;
  const centro = 256;

  return FIGURAS_BASE.map(({ x, y, w, h, color }) => {
    const xm = centro + (x - centro) * factorMaskable;
    const ym = centro + (y - centro) * factorMaskable;
    const wm = w * factorMaskable;
    const hm = h * factorMaskable;
    const k = lado / 512;

    return {
      x0: Math.round(xm * k),
      y0: Math.round(ym * k),
      x1: Math.round((xm + wm) * k),
      y1: Math.round((ym + hm) * k),
      color,
    };
  });
}

/** Tabla CRC32 estándar de PNG (polinomio IEEE 802.3). */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunkPng(tipo, datos) {
  const tipoBuf = Buffer.from(tipo, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(datos.length, 0);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])), 0);

  return Buffer.concat([lenBuf, tipoBuf, datos, crcBuf]);
}

function generarPng(lado, { maskable = false } = {}) {
  const figuras = escalarFiguras(lado, maskable);
  // Cada fila lleva 1 byte de filtro (0 = None) + 3 bytes RGB por píxel.
  const filaBytes = 1 + lado * 3;
  const crudo = Buffer.alloc(filaBytes * lado);

  for (let y = 0; y < lado; y++) {
    const baseFila = y * filaBytes;
    crudo[baseFila] = 0;

    for (let x = 0; x < lado; x++) {
      let c = COLORES.fondo;
      for (const f of figuras) {
        if (x >= f.x0 && x < f.x1 && y >= f.y0 && y < f.y1) {
          c = f.color;
          break;
        }
      }
      const p = baseFila + 1 + x * 3;
      crudo[p] = c[0];
      crudo[p + 1] = c[1];
      crudo[p + 2] = c[2];
    }
  }

  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color RGB truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(crudo, { level: 9 });

  return Buffer.concat([
    firma,
    chunkPng("IHDR", ihdr),
    chunkPng("IDAT", idat),
    chunkPng("IEND", Buffer.alloc(0)),
  ]);
}

const SALIDAS = [
  { ruta: "public/icons/icon-192.png", lado: 192, maskable: false },
  { ruta: "public/icons/icon-512.png", lado: 512, maskable: false },
  { ruta: "public/icons/icon-maskable-192.png", lado: 192, maskable: true },
  { ruta: "public/icons/icon-maskable-512.png", lado: 512, maskable: true },
  { ruta: "public/apple-touch-icon.png", lado: 180, maskable: false },
];

for (const { ruta, lado, maskable } of SALIDAS) {
  const destino = resolve(RAIZ, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  const png = generarPng(lado, { maskable });
  writeFileSync(destino, png);
  console.log(`${ruta} (${lado}×${lado}${maskable ? ", maskable" : ""}) — ${png.length} B`);
}
