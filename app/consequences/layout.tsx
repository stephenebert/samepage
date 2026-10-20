import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SamePage — Find the hidden consequence",
  description: "Turn bilingual policies into discovered consequences, review the meaning together, and update a working registration form with joint approval.",
};

export default function ConsequencesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
