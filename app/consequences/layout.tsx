import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SamePage — See what your words change",
  description: "Two languages, one agreed policy. Compare the consequences, decide together, and test the working registration form.",
};

export default function ConsequencesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
