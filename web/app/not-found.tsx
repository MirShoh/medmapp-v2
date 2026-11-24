import Link from "next/link";

/** Last-resort 404 for URLs outside the localized app (normally the localized page in app/[locale]/(site) is shown). */
export default function NotFound() {
  return (
    <html lang="uz">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#F5F9FC", color: "#0B2545" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          { }
          <img src="/brand-icon.png" alt="MedMapp" width={64} height={64} />
          <h1 style={{ fontSize: 56, margin: "12px 0 4px", color: "#0D7BE8" }}>404</h1>
          <p style={{ margin: 0 }}>Sahifa topilmadi · Страница не найдена · Page not found</p>
          <p style={{ marginTop: 20, display: "flex", gap: 16, justifyContent: "center" }}>
            <Link href="/" style={{ color: "#0D7BE8", fontWeight: 600 }}>Bosh sahifa</Link>
            <Link href="/ru" style={{ color: "#0D7BE8", fontWeight: 600 }}>Главная</Link>
            <Link href="/en" style={{ color: "#0D7BE8", fontWeight: 600 }}>Home</Link>
          </p>
        </div>
      </body>
    </html>
  );
}
