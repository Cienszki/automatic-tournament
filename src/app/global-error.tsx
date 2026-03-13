"use client";

// Global error boundary renders outside NextIntlClientProvider,
// so we use a simple inline translation map based on cookie/navigator locale.
const translations = {
  pl: {
    heading: "Wystąpił błąd aplikacji",
    description: "Spróbuj odświeżyć widok lub wrócić do strony głównej.",
    tryAgain: "Spróbuj ponownie",
    homePage: "Strona główna",
  },
  en: {
    heading: "Application error",
    description: "Try refreshing the page or returning to the home page.",
    tryAgain: "Try again",
    homePage: "Home page",
  },
} as const;

function getLocale(): "pl" | "en" {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/NEXT_LOCALE=(\w+)/);
    if (match && match[1] === "en") return "en";
  }
  return "pl";
}

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const t = translations[getLocale()];

  return (
    <html>
      <body>
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-logik-extended-bold uppercase tracking-wide text-pdl-gold">
              {t.heading}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/80">
              {t.description}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 rounded-lg bg-pdl-gold text-black font-logik-extended-bold"
              >
                {t.tryAgain}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="px-4 py-2 rounded-lg border border-white/20 text-white"
              >
                {t.homePage}
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
