import type { Metadata } from "next";

import { getOptionalUser } from "@/lib/auth";

import { RecuperarForm } from "./recuperar-form";

export const metadata: Metadata = {
  title: "Nueva contraseña — Tempo",
};

export const dynamic = "force-dynamic";

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; code?: string; error_description?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, getOptionalUser()]);

  return (
    <main className="login">
      <div className="login-panel">
        <div className="brand login-brand">
          <span className="brand-mark" aria-hidden />
          TEMPO
        </div>

        <RecuperarForm
          sesionActiva={user !== null}
          tokenHash={params.token_hash}
          code={params.code}
          errorInicial={params.error_description}
        />
      </div>
    </main>
  );
}
