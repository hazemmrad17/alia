import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALIA Avatar - VITAL SA",
  description: "Intelligent Conversational Avatar for Pharmaceutical Sales Training",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
