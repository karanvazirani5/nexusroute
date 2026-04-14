import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — NexusRoute",
  description: "Learn how NexusRoute scores and ranks AI models. Our 6-stage pipeline: interpret, filter, score, optimize, uncertainty, explain.",
  openGraph: { title: "How NexusRoute Works", description: "6-stage AI model scoring pipeline explained." },
};

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
