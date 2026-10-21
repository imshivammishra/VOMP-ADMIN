import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Private access for the Venue On My Plate team.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
