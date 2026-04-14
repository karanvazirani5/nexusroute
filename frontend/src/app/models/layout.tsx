import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Model Directory — NexusRoute",
  description: "Browse 24+ AI models from OpenAI, Anthropic, Google, Mistral, and more. Compare specs, pricing, capabilities, and freshness ratings.",
  openGraph: { title: "AI Model Directory — NexusRoute", description: "Browse 24+ AI models with detailed specs and scoring." },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
