import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` es un driver nativo: no debe empaquetarse, se resuelve en runtime.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
