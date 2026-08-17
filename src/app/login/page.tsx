import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Tempo",
};

// La sesión sale de una cookie: nada que cachear.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;

  return (
    <main className="login">
      <div className="login-panel">
        <div className="brand login-brand">
          <span className="brand-mark" aria-hidden />
          TEMPO
        </div>

        <LoginForm volver={volver} />
      </div>
    </main>
  );
}
