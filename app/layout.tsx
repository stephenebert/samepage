import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SamePage — Two languages, one shared meaning",
  description: "A live bilingual collaboration experiment. Edit in your language, preserve the shared meaning, and resolve differences together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
