import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SamePage — Find the hidden consequence",
  description: "SamePage finds concrete disagreements between bilingual policy interpretations. Explore who is affected, decide together, and test the registration form.",
};

export default function ConsequencesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
