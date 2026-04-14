import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — NexusRoute",
  description: "NexusRoute privacy policy and consent management. Your prompts are analyzed locally in the browser — nothing is stored without consent.",
  openGraph: { title: "Privacy — NexusRoute", description: "Your prompts are analyzed locally. Nothing stored without consent." },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
