"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles, Code, Bot, Headphones, FileText, Search, Zap, DollarSign, Shield, Clock, Check } from "lucide-react";

const PROVIDERS = [
  { id: "OpenAI", label: "OpenAI", desc: "GPT-5.4, GPT-5.4-mini, o3, o4-mini" },
  { id: "Anthropic", label: "Anthropic", desc: "Claude Opus, Sonnet, Haiku" },
  { id: "Google", label: "Google", desc: "Gemini 2.5 Pro, Flash" },
  { id: "xAI", label: "xAI", desc: "Grok 3, Grok 3 Mini" },
  { id: "Mistral", label: "Mistral", desc: "Mistral Large, Small" },
  { id: "DeepSeek", label: "DeepSeek", desc: "DeepSeek R2, V3" },
  { id: "Meta", label: "Meta", desc: "Llama 4 Maverick, Llama 3.3 (open-weight)" },
  { id: "Alibaba", label: "Alibaba", desc: "Qwen 3.5 (open-weight)" },
] as const;

const USE_CASES = [
  { id: "app_feature", label: "App feature", desc: "Adding AI to a product", icon: Code },
  { id: "agent", label: "Agent / workflow", desc: "Autonomous multi-step tasks", icon: Bot },
  { id: "coding", label: "Coding assistant", desc: "Code gen, review, debug", icon: Code },
  { id: "support", label: "Support automation", desc: "Tickets, chat, FAQs", icon: Headphones },
  { id: "content", label: "Content pipeline", desc: "Writing, summarization, extraction", icon: FileText },
  { id: "research", label: "Research / analysis", desc: "Data analysis, synthesis", icon: Search },
] as const;

const PRIORITIES = [
  { id: "quality", label: "Quality", desc: "Best possible output", icon: Sparkles, color: "border-yellow-500/20 bg-yellow-500/[0.04] hover:border-yellow-500/40" },
  { id: "speed", label: "Latency", desc: "Fastest response time", icon: Zap, color: "border-cyan-500/20 bg-cyan-500/[0.04] hover:border-cyan-500/40" },
  { id: "cost", label: "Cost", desc: "Minimize spend", icon: DollarSign, color: "border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-500/40" },
  { id: "privacy", label: "Privacy", desc: "Self-hosted / on-prem", icon: Shield, color: "border-indigo-500/20 bg-indigo-500/[0.04] hover:border-indigo-500/40" },
] as const;

const CONTEXTS = [
  { id: "personal", label: "Personal use" },
  { id: "prototype", label: "Prototype" },
  { id: "production", label: "Production workload" },
] as const;

const SEED_PROMPTS: Record<string, Record<string, string>> = {
  app_feature: { quality: "Integrate an AI assistant into our SaaS dashboard that can answer user questions about their data", speed: "Build a real-time AI suggestion feature for a text editor with <200ms latency", cost: "Add AI-powered product recommendations to our e-commerce site, processing 100K requests/day", privacy: "Implement a private document analysis feature that never sends data to third-party APIs" },
  agent: { quality: "Build an autonomous research agent that finds, evaluates, and synthesizes information from multiple sources", speed: "Create a fast agentic workflow for triaging support tickets in real-time", cost: "Set up a batch processing agent that classifies 50K documents per day at minimal cost", privacy: "Deploy a self-hosted agent for internal code review and security scanning" },
  coding: { quality: "Help me refactor a complex TypeScript monorepo with proper dependency injection", speed: "Quick code completion and inline suggestions while writing Go", cost: "Generate unit tests for a large Python codebase affordably", privacy: "Self-hosted code assistant for proprietary codebase" },
  support: { quality: "Build an AI support agent that handles complex technical escalations accurately", speed: "Real-time chat support with sub-second response times", cost: "Automate FAQ responses for 10K daily tickets at the lowest cost", privacy: "On-premise support AI for healthcare data" },
  content: { quality: "Write compelling long-form blog posts that match our brand voice", speed: "Generate quick social media variations from a single brief", cost: "Bulk-generate product descriptions for 5K SKUs", privacy: "Summarize confidential board meeting transcripts internally" },
  research: { quality: "Analyze 50 research papers and produce a comprehensive literature review", speed: "Quick data interpretation for real-time dashboards", cost: "Batch-process survey responses into structured insights", privacy: "Analyze sensitive financial data without external API calls" },
};

interface OnboardingFlowProps {
  onComplete: (seedPrompt: string, track?: string) => void;
  onSkip: () => void;
}

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [allProviders, setAllProviders] = useState(false);
  const [useCase, setUseCase] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setAllProviders(false);
  };

  const toggleAll = () => {
    if (allProviders) {
      setAllProviders(false);
      setSelectedProviders(new Set());
    } else {
      setAllProviders(true);
      setSelectedProviders(new Set());
    }
  };

  const handleComplete = useCallback(() => {
    const uc = useCase || "app_feature";
    const pr = priority || "quality";
    const prompt = SEED_PROMPTS[uc]?.[pr] || SEED_PROMPTS.app_feature.quality;
    if (typeof window !== "undefined") {
      localStorage.setItem("nr_onboarding_completed", "true");
      localStorage.setItem("nr_onboarding_usecase", uc);
      localStorage.setItem("nr_onboarding_priority", pr);
      localStorage.setItem("nr_onboarding_context", context || "personal");
      // Store provider selections — empty means "all providers"
      if (!allProviders && selectedProviders.size > 0) {
        localStorage.setItem("nr_onboarding_providers", JSON.stringify([...selectedProviders]));
      } else {
        localStorage.removeItem("nr_onboarding_providers");
      }
    }
    onComplete(prompt, pr);
  }, [useCase, priority, context, allProviders, selectedProviders, onComplete]);

  const handleSkip = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nr_onboarding_completed", "true");
    }
    onSkip();
  }, [onSkip]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="rounded-3xl border border-violet-500/15 bg-[#0c0c20]/95 backdrop-blur-2xl p-8 max-w-2xl mx-auto shadow-2xl shadow-violet-500/5"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Quick setup</h2>
            <p className="text-xs text-zinc-500">Help us find your perfect model faster</p>
          </div>
        </div>
        <button onClick={handleSkip} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1.5 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-violet-500" : "bg-white/[0.06]"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Which providers do you have? */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm font-semibold text-zinc-300 mb-1">Which model providers do you have access to?</p>
            <p className="text-[11px] text-zinc-500 mb-4">We&apos;ll prioritize these + open-weight models you can self-host</p>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((prov) => {
                const selected = selectedProviders.has(prov.id);
                return (
                  <button
                    key={prov.id}
                    onClick={() => toggleProvider(prov.id)}
                    className={`text-left rounded-xl border p-3 transition-all relative ${
                      selected
                        ? "border-violet-500/30 bg-violet-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{prov.label}</p>
                    <p className="text-[10px] text-zinc-500">{prov.desc}</p>
                    {selected && (
                      <div className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={toggleAll}
              className={`mt-2 w-full rounded-xl border py-2.5 text-center text-sm font-semibold transition-all ${
                allProviders
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12]"
              }`}
            >
              {allProviders ? "✓ " : ""}All providers / I&apos;m not sure
            </button>
            <button
              onClick={() => setStep(1)}
              disabled={!allProviders && selectedProviders.size === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2: Use case */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm font-semibold text-zinc-300 mb-4">What are you choosing a model for?</p>
            <div className="grid grid-cols-2 gap-2">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => { setUseCase(uc.id); setStep(2); }}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    useCase === uc.id
                      ? "border-violet-500/30 bg-violet-500/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                  }`}
                >
                  <uc.icon className="h-4 w-4 text-violet-400 mb-1" />
                  <p className="text-sm font-semibold text-white">{uc.label}</p>
                  <p className="text-[10px] text-zinc-500">{uc.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 3: Priority */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm font-semibold text-zinc-300 mb-4">What matters most?</p>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPriority(p.id); setStep(3); }}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    priority === p.id ? "border-violet-500/30 bg-violet-500/10" : p.color
                  }`}
                >
                  <p.icon className="h-5 w-5 text-zinc-300 mb-2" />
                  <p className="text-sm font-bold text-white">{p.label}</p>
                  <p className="text-[10px] text-zinc-500">{p.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 4: Context */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm font-semibold text-zinc-300 mb-4">Evaluating for...</p>
            <div className="flex gap-2">
              {CONTEXTS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setContext(c.id)}
                  className={`flex-1 rounded-xl border py-4 px-3 text-center transition-all ${
                    context === c.id
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                      : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12]"
                  }`}
                >
                  <p className="text-sm font-semibold">{c.label}</p>
                </button>
              ))}
            </div>
            <button
              onClick={handleComplete}
              disabled={!context}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all disabled:opacity-40"
            >
              Find my model
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back / Skip */}
      <div className="flex items-center justify-between mt-4">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="text-xs text-zinc-500 hover:text-zinc-300">
            Back
          </button>
        ) : <span />}
        <button onClick={handleSkip} className="text-xs text-zinc-600 hover:text-zinc-400">
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}
