import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { themeScript } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studieplatform",
  description: "Persoonlijk flashcard-studieplatform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="md:flex">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
