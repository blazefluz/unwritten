import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unwritten — Watch. Understand. Verify.",
  description: "Review the decisions behind expert work, grounded in video and references.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
