import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexusRoute · AI Model Intelligence Platform",
  description:
    "Route any prompt to the best model. The world's most advanced AI model selection engine — free, private, and runs in your browser.",
  metadataBase: new URL("https://nexusrouteai.com"),
  openGraph: {
    title: "NexusRoute · AI Model Intelligence Platform",
    description:
      "Route any prompt to the best model. 24+ models, real-time scoring, free and private.",
    siteName: "NexusRoute",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "NexusRoute · AI Model Intelligence Platform",
    description:
      "Route any prompt to the best model. 24+ models, real-time scoring, free and private.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <ErrorBoundary>
            <AppShell>{children}</AppShell>
          </ErrorBoundary>
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
