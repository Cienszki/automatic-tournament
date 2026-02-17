"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-logik-extended-bold uppercase tracking-wide text-pdl-gold">
              Wystąpił błąd aplikacji
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/80">
              Spróbuj odświeżyć widok lub wrócić do strony głównej.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 rounded-lg bg-pdl-gold text-black font-logik-extended-bold"
              >
                Spróbuj ponownie
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="px-4 py-2 rounded-lg border border-white/20 text-white"
              >
                Strona główna
              </button>
            </div>

            {process.env.NODE_ENV === "development" && (
              <pre className="mt-6 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-red-300 border border-red-500/30">
                {error?.message}
                {error?.digest ? `\nDigest: ${error.digest}` : ""}
              </pre>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
