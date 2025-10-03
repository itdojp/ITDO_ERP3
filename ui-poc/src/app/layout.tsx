import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ITDO ERP3 UI PoC",
  description: "Prototype screens for ERP3 user experience exploration",
};

const links: Array<{ href: string; label: string }> = [
  { href: "/projects", label: "Projects" },
  { href: "/timesheets", label: "Timesheets" },
  { href: "/compliance", label: "Compliance" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-slate-950 text-slate-100 min-h-screen`}> 
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">ITDO ERP3 UI PoC</h1>
                <p className="text-sm text-slate-400">
                  Experimental screens for UX exploration (not production-ready)
                </p>
              </div>
              <nav className="flex items-center gap-4 text-sm">
                {links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-slate-300 hover:text-white">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
          </main>
          <footer className="border-t border-slate-800 bg-slate-900/70 py-4 text-center text-xs text-slate-500">
            Internal prototype. Data is mock / PoC only.
          </footer>
        </div>
      </body>
    </html>
  );
}
