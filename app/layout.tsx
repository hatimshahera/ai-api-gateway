import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI API Gateway",
  description:
    "A lightweight AI inference proxy with routing, retries, caching, fallback, request logs, latency tracking, and cost awareness.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
