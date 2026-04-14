import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Models — NexusRoute",
  description: "Side-by-side comparison of AI models. Compare capabilities, pricing, and performance across 24+ frontier models.",
  openGraph: { title: "Compare AI Models — NexusRoute", description: "Side-by-side AI model comparison across 24+ frontier models." },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
