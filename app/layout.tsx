import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SamePage — Policy workspace",
  description: "Review bilingual policies, check changed outcomes, and approve updates together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
