import type { CapabilityDimension } from "@/lib/types";
import type { FAQItem } from "@/lib/seo/json-ld";

export interface GuideCategory {
  slug: string;
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  /** Weight vector over capability dimensions (0-1). Higher = more important for this use case. */
  weights: Partial<Record<CapabilityDimension, number>>;
  presetSlug: string | null;
  icon: string;
  faqItems: FAQItem[];
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    slug: "coding",
    title: "Coding",
    description: "Code generation, debugging, reviews, refactoring, and technical documentation. Find the model that writes the best code for your stack.",
    metaTitle: "Best AI Model for Coding — NexusRoute Guide",
    metaDescription: "Compare AI models for code generation, debugging, and reviews. See which models score highest on coding benchmarks and real-world tasks.",
    weights: { coding: 1.0, reasoning: 0.8, structuredOutput: 0.7, toolUse: 0.6, speed: 0.4, instructionFollowing: 0.6 },
    presetSlug: "coding",
    icon: "code-2",
    faqItems: [
      { question: "Which AI model is best for coding?", answer: "The best model depends on your language and task complexity. For general-purpose coding, frontier models like GPT-5.4 and Claude Opus score highest. For cost-effective coding, mid-tier models offer strong performance at lower prices." },
      { question: "Can AI models debug code?", answer: "Yes. Modern frontier models excel at identifying bugs, explaining error messages, and suggesting fixes. Models with strong reasoning capabilities tend to perform best at debugging complex logic issues." },
      { question: "Are open-weight models good for coding?", answer: "Several open-weight models like DeepSeek V3 and Qwen 3 Coder score competitively on coding benchmarks, especially for common languages and frameworks." },
    ],
  },
  {
    slug: "creative-writing",
    title: "Creative Writing",
    description: "Fiction, poetry, marketing copy, blog posts, and storytelling. Discover which models produce the most engaging and original prose.",
    metaTitle: "Best AI Model for Creative Writing — NexusRoute Guide",
    metaDescription: "Find the best AI for creative writing, fiction, copywriting, and content creation. Compare models on creativity, style, and output quality.",
    weights: { creativity: 1.0, conversational: 0.7, instructionFollowing: 0.6, longContext: 0.5, factuality: 0.3 },
    presetSlug: "writing",
    icon: "pen-line",
    faqItems: [
      { question: "Which AI writes the most creative content?", answer: "Frontier models from Anthropic and OpenAI consistently produce the most nuanced and creative writing. Claude models are particularly noted for literary quality and voice consistency." },
      { question: "Can AI write long-form content?", answer: "Yes. Models with large context windows (200K+ tokens) can maintain coherence across long documents, novels, and series of related content pieces." },
    ],
  },
  {
    slug: "research",
    title: "Research & Analysis",
    description: "Deep research, literature reviews, data synthesis, and complex analysis. Find models that think deeply and handle long documents.",
    metaTitle: "Best AI Model for Research — NexusRoute Guide",
    metaDescription: "Compare AI models for research, analysis, and deep reasoning. See which handle long documents and complex synthesis best.",
    weights: { reasoning: 1.0, longContext: 0.9, factuality: 0.8, coding: 0.3, creativity: 0.4 },
    presetSlug: "research",
    icon: "book-open",
    faqItems: [
      { question: "Which AI model is best for research?", answer: "Models with strong reasoning depth and long context windows excel at research. Frontier models with 1M+ context windows can process entire papers and datasets in a single prompt." },
      { question: "Can AI models handle 100+ page documents?", answer: "Yes. Several models now support 1M+ token context windows, enough for hundreds of pages of text." },
    ],
  },
  {
    slug: "data-analysis",
    title: "Data Analysis",
    description: "CSV analysis, SQL generation, chart creation, statistical reasoning, and data visualization. Find the best model for your data workflows.",
    metaTitle: "Best AI Model for Data Analysis — NexusRoute Guide",
    metaDescription: "Compare AI models for data analysis, SQL generation, and statistical reasoning. Find the best model for your data workflows.",
    weights: { coding: 0.8, reasoning: 0.9, structuredOutput: 1.0, factuality: 0.7, toolUse: 0.6 },
    presetSlug: "extraction",
    icon: "bar-chart-3",
    faqItems: [
      { question: "Which AI is best for analyzing spreadsheet data?", answer: "Models with strong coding and structured output capabilities perform best. They can write Python/SQL queries, generate charts, and explain statistical patterns." },
    ],
  },
  {
    slug: "customer-support",
    title: "Customer Support",
    description: "Chatbots, ticket routing, FAQ answers, and support automation. Find fast, reliable models for customer-facing workflows.",
    metaTitle: "Best AI Model for Customer Support — NexusRoute Guide",
    metaDescription: "Find the fastest and most reliable AI models for customer support chatbots, ticket routing, and FAQ automation.",
    weights: { speed: 1.0, conversational: 0.9, instructionFollowing: 0.8, costEfficiency: 0.8, safetyEnterprise: 0.7 },
    presetSlug: "support",
    icon: "headset",
    faqItems: [
      { question: "What's the best AI for customer support?", answer: "For support, speed and reliability matter most. Mid-tier models offer the best balance of quality and latency, often responding in under 500ms while maintaining helpful, accurate responses." },
    ],
  },
  {
    slug: "translation",
    title: "Translation",
    description: "Multilingual translation, localization, and cross-language tasks. Compare models on language coverage and translation quality.",
    metaTitle: "Best AI Model for Translation — NexusRoute Guide",
    metaDescription: "Compare AI models for translation and localization. See which handle rare languages, idioms, and context-sensitive translation best.",
    weights: { creativity: 0.6, instructionFollowing: 0.8, factuality: 0.9, conversational: 0.5, longContext: 0.4 },
    presetSlug: null,
    icon: "languages",
    faqItems: [
      { question: "Which AI is best for translation?", answer: "Frontier models handle major languages well. For rare languages, models trained on diverse multilingual data (like Gemini and Qwen) often have an edge." },
    ],
  },
  {
    slug: "summarization",
    title: "Summarization",
    description: "Document summarization, key point extraction, meeting notes, and content condensation. Find models that distill information effectively.",
    metaTitle: "Best AI Model for Summarization — NexusRoute Guide",
    metaDescription: "Compare AI models for document summarization and content condensation. Find which models best distill key information.",
    weights: { longContext: 1.0, factuality: 0.9, instructionFollowing: 0.7, speed: 0.5, costEfficiency: 0.5 },
    presetSlug: null,
    icon: "file-text",
    faqItems: [
      { question: "Which AI summarizes documents best?", answer: "Models with large context windows and strong factuality scores produce the most accurate summaries. Look for models that can ingest your full document in one pass." },
    ],
  },
  {
    slug: "agents",
    title: "AI Agents & Tool Use",
    description: "Autonomous agents, multi-step tool calling, API orchestration, and agentic workflows. Find models built for complex automated tasks.",
    metaTitle: "Best AI Model for Agents & Tool Use — NexusRoute Guide",
    metaDescription: "Compare AI models for building autonomous agents, tool calling, and multi-step workflows. See which models handle agentic tasks best.",
    weights: { toolUse: 1.0, reasoning: 0.9, coding: 0.7, structuredOutput: 0.8, instructionFollowing: 0.7 },
    presetSlug: "agent",
    icon: "bot",
    faqItems: [
      { question: "Which AI model is best for building agents?", answer: "Models with strong tool use, reasoning, and structured output capabilities are ideal. Look for reliable function calling support and the ability to plan multi-step workflows." },
    ],
  },
  {
    slug: "image-generation",
    title: "Image Generation",
    description: "AI image creation, editing, and visual content. Compare models that can generate, edit, and understand images.",
    metaTitle: "Best AI Model for Image Generation — NexusRoute Guide",
    metaDescription: "Compare AI models for image generation and editing. See which produce the highest quality visuals.",
    weights: { multimodal: 1.0, creativity: 0.8, instructionFollowing: 0.7 },
    presetSlug: null,
    icon: "image",
    faqItems: [
      { question: "Which AI model generates the best images?", answer: "Dedicated image models like GPT-5.4's image generation and specialized models produce the highest quality results. The best choice depends on style, control, and integration needs." },
    ],
  },
  {
    slug: "math-reasoning",
    title: "Math & Reasoning",
    description: "Mathematical proofs, logic puzzles, scientific reasoning, and complex problem-solving. Find the sharpest reasoning models.",
    metaTitle: "Best AI Model for Math & Reasoning — NexusRoute Guide",
    metaDescription: "Compare AI models for mathematical reasoning, proofs, and complex problem-solving. See benchmark scores and real-world performance.",
    weights: { reasoning: 1.0, factuality: 0.8, coding: 0.5, structuredOutput: 0.4 },
    presetSlug: null,
    icon: "calculator",
    faqItems: [
      { question: "Which AI is best at math?", answer: "Frontier reasoning models consistently score highest on math benchmarks (GSM8K, MATH). Models with dedicated reasoning modes or chains-of-thought produce more reliable mathematical results." },
    ],
  },
  {
    slug: "legal",
    title: "Legal",
    description: "Contract analysis, legal research, compliance checking, and document review. Find models suited for legal workflows.",
    metaTitle: "Best AI Model for Legal Work — NexusRoute Guide",
    metaDescription: "Compare AI models for legal research, contract analysis, and compliance. Find which models handle legal language and reasoning best.",
    weights: { reasoning: 0.9, factuality: 1.0, longContext: 0.9, safetyEnterprise: 0.8, instructionFollowing: 0.7 },
    presetSlug: null,
    icon: "scale",
    faqItems: [
      { question: "Can AI be used for legal work?", answer: "AI models can assist with contract review, legal research, and compliance checking. Models with strong factuality and reasoning are preferred. Always have a legal professional review AI-generated legal analysis." },
    ],
  },
  {
    slug: "medical",
    title: "Medical & Healthcare",
    description: "Clinical reasoning, medical literature review, patient communication, and health informatics. Find models with medical knowledge.",
    metaTitle: "Best AI Model for Medical Tasks — NexusRoute Guide",
    metaDescription: "Compare AI models for medical reasoning, clinical tasks, and healthcare informatics. Find the most knowledgeable and reliable models.",
    weights: { factuality: 1.0, reasoning: 0.9, safetyEnterprise: 0.9, longContext: 0.6, instructionFollowing: 0.7 },
    presetSlug: null,
    icon: "stethoscope",
    faqItems: [
      { question: "Which AI is best for medical questions?", answer: "Frontier models with strong factuality and reasoning score best on medical benchmarks. Always verify medical AI output with qualified professionals — AI should augment, not replace, clinical judgment." },
    ],
  },
  {
    slug: "education",
    title: "Education",
    description: "Tutoring, lesson planning, quiz generation, and educational content. Find models that explain concepts clearly and adapt to learners.",
    metaTitle: "Best AI Model for Education — NexusRoute Guide",
    metaDescription: "Compare AI models for tutoring, lesson planning, and educational content creation. Find which models explain concepts most clearly.",
    weights: { conversational: 1.0, creativity: 0.7, factuality: 0.8, instructionFollowing: 0.7, reasoning: 0.6 },
    presetSlug: null,
    icon: "graduation-cap",
    faqItems: [
      { question: "Which AI is best for tutoring?", answer: "Models with strong conversational abilities and factual accuracy make the best tutors. Look for models that can adapt explanations to different skill levels." },
    ],
  },
  {
    slug: "content-marketing",
    title: "Content Marketing",
    description: "SEO content, social media posts, email campaigns, and brand voice. Find models that produce on-brand marketing content at scale.",
    metaTitle: "Best AI Model for Content Marketing — NexusRoute Guide",
    metaDescription: "Compare AI models for SEO content, social media, email marketing, and brand copywriting. Find the best model for content at scale.",
    weights: { creativity: 0.9, conversational: 0.8, instructionFollowing: 1.0, speed: 0.6, costEfficiency: 0.7 },
    presetSlug: null,
    icon: "megaphone",
    faqItems: [
      { question: "Which AI is best for content marketing?", answer: "For marketing content, look for models with strong instruction following (to maintain brand voice) and creativity. Mid-tier models often provide the best quality-to-cost ratio for high-volume content production." },
    ],
  },
];
