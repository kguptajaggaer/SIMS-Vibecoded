import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIMS – Supplier Information Management System",
  description: "USPS Supplier Information Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
