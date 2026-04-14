export interface UseCaseSection {
  heading: string;
  body: string;
}

export interface UseCaseFAQ {
  question: string;
  answer: string;
}

export interface UseCase {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  heroEmoji: string;
  description: string;
  sections: UseCaseSection[];
  templatePrompt: string;
  templateTrack: string;
  recommendedModels: string[];
  relatedGuides: string[];
  faqItems: UseCaseFAQ[];
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
}

export const USE_CASES: UseCase[] = [
  {
    slug: "support-ticket-triage",
    title: "Support Ticket Triage",
    subtitle: "Classify, route, and prioritize customer support tickets automatically",
    category: "support",
    heroEmoji: "🎫",
    description: "Automate the classification and routing of incoming support tickets by urgency, category, and required expertise. Reduce response times and ensure critical issues get immediate attention.",
    sections: [
      { heading: "The job to be done", body: "Process incoming support tickets in real-time, classify them by urgency (critical/high/medium/low), route to the right team (billing, technical, product), and extract key entities like account IDs, error codes, and product names." },
      { heading: "Key tradeoffs", body: "Speed vs accuracy is the primary tension. A faster model processes tickets in <500ms but may misclassify edge cases. A frontier model catches subtle context but adds 2-3s latency per ticket. At high volume (10K+ tickets/day), cost becomes the dominant factor." },
      { heading: "When to switch models", body: "Start with a mid-tier model for most tickets. Escalate to a frontier model only for tickets flagged as ambiguous or high-priority. Use a budget model for bulk backlog processing." },
    ],
    templatePrompt: "Classify and route incoming support tickets by urgency, category, and required expertise level. Handle 5K tickets/day with structured JSON output.",
    templateTrack: "speed",
    recommendedModels: ["gpt-5.4-nano", "claude-haiku-4.5", "gemini-2.5-flash"],
    relatedGuides: ["customer-support"],
    faqItems: [
      { question: "What output format works best for ticket triage?", answer: "Structured JSON with fields for urgency, category, team, confidence, and extracted entities. This enables direct integration with ticketing systems." },
      { question: "How do I handle edge cases?", answer: "Use a two-tier approach: fast model for clear-cut tickets, escalate uncertain ones (confidence < 0.7) to a more capable model for re-classification." },
    ],
    metaTitle: "Best AI Model for Support Ticket Triage | NexusRoute",
    metaDescription: "Find the optimal AI model for automating support ticket classification, routing, and prioritization. Compare speed, accuracy, and cost tradeoffs.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "codebase-qa",
    title: "Codebase Q&A",
    subtitle: "Answer developer questions about large codebases with context-aware AI",
    category: "coding",
    heroEmoji: "💻",
    description: "Enable developers to ask natural language questions about a codebase and get accurate, context-aware answers. Requires strong code understanding, long context for large repos, and precise instruction following.",
    sections: [
      { heading: "The job to be done", body: "Process developer questions alongside relevant code snippets, documentation, and repo structure. Generate accurate answers that reference specific files, functions, and patterns." },
      { heading: "Key tradeoffs", body: "Context window is critical — larger codebases need models with 100K+ token contexts. Reasoning quality directly affects answer accuracy. Speed matters for developer experience but can be traded for correctness." },
      { heading: "When to switch models", body: "Use a frontier model with large context for complex architectural questions. Switch to a faster mid-tier model for simple lookups and syntax questions. Consider open-weight models if code must stay on-premise." },
    ],
    templatePrompt: "Answer developer questions about a large TypeScript monorepo with 500+ files, using repo context and documentation. Provide accurate code references.",
    templateTrack: "quality",
    recommendedModels: ["claude-opus-4", "gpt-5.4", "gemini-2.5-pro"],
    relatedGuides: ["coding"],
    faqItems: [
      { question: "How much code context should I include?", answer: "Include the most relevant files (not the entire repo). Use a retrieval layer to find the top 5-10 relevant files, then pass those as context along with the question." },
      { question: "Should I use function calling?", answer: "Yes. Function calling enables the model to request specific files or search for patterns, making it more effective for large codebases." },
    ],
    metaTitle: "Best AI Model for Codebase Q&A | NexusRoute",
    metaDescription: "Find the ideal AI model for answering developer questions about large codebases. Compare context windows, code reasoning, and cost.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "long-context-extraction",
    title: "Long-Context Extraction",
    subtitle: "Extract structured data from long documents like contracts, reports, and transcripts",
    category: "extraction",
    heroEmoji: "📄",
    description: "Process lengthy documents (50-500 pages) to extract specific data points, clauses, entities, and relationships into structured formats. Requires large context windows and precise instruction following.",
    sections: [
      { heading: "The job to be done", body: "Ingest a full document (contract, report, transcript), understand its structure, and extract specific fields into JSON — dates, parties, obligations, financial figures, risk factors." },
      { heading: "Key tradeoffs", body: "Context window size is non-negotiable for long documents. Structured output support (JSON mode) dramatically reduces post-processing. Cost scales linearly with document length." },
      { heading: "When to switch models", body: "Use a frontier model with 200K+ context for critical extractions. For routine documents with known templates, a mid-tier model with JSON mode saves 60-80% on cost." },
    ],
    templatePrompt: "Extract key clauses, dates, parties, and obligations from 200-page legal contracts into structured JSON with confidence scores.",
    templateTrack: "quality",
    recommendedModels: ["gemini-2.5-pro", "claude-opus-4", "gpt-5.4"],
    relatedGuides: ["data-analysis", "legal"],
    faqItems: [
      { question: "What if my document exceeds the context window?", answer: "Use chunking with overlap (2-3 page overlap between chunks). Process each chunk independently, then merge and deduplicate extracted entities." },
      { question: "How reliable is structured extraction?", answer: "With JSON mode enabled, extraction accuracy for well-defined fields is typically 90-95%. Add validation rules in your application to catch and flag low-confidence extractions." },
    ],
    metaTitle: "Best AI Model for Long Document Extraction | NexusRoute",
    metaDescription: "Find the best AI model for extracting structured data from long documents. Compare context windows, JSON support, and extraction accuracy.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "agent-workflows",
    title: "Agent Workflows",
    subtitle: "Build autonomous AI agents that plan, execute, and adapt multi-step tasks",
    category: "agents",
    heroEmoji: "🤖",
    description: "Design AI agents that can plan complex tasks, use tools, browse the web, execute code, and adapt their approach based on intermediate results. Requires strong reasoning, function calling, and reliability.",
    sections: [
      { heading: "The job to be done", body: "Build agents that can decompose complex tasks, call external tools and APIs, process intermediate results, handle errors gracefully, and produce a final deliverable — all with minimal human intervention." },
      { heading: "Key tradeoffs", body: "Reasoning quality is paramount — weak reasoning leads to cascading errors in multi-step workflows. Function calling reliability determines tool-use success. Cost compounds across steps (5-20 LLM calls per task)." },
      { heading: "When to switch models", body: "Use a frontier reasoning model for the planner/orchestrator. Use faster, cheaper models for individual tool calls and simple transformations within the workflow." },
    ],
    templatePrompt: "Build an autonomous research agent that searches the web, evaluates source credibility, extracts key findings, and produces a synthesized report with citations.",
    templateTrack: "quality",
    recommendedModels: ["claude-opus-4", "gpt-5.4", "o3"],
    relatedGuides: ["agents"],
    faqItems: [
      { question: "Which models support function calling?", answer: "Most frontier and mid-tier models support function calling. Claude, GPT-5.4, and Gemini Pro all have robust function calling. Open-weight models vary — check the model detail page." },
      { question: "How do I handle agent errors?", answer: "Implement retry logic with exponential backoff, fallback to simpler approaches, and set maximum step limits. Log each step for debugging." },
    ],
    metaTitle: "Best AI Model for Agent Workflows | NexusRoute",
    metaDescription: "Find the best AI model for building autonomous agents. Compare reasoning, function calling, reliability, and multi-step performance.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "cheap-batch-classification",
    title: "Cheap Batch Classification",
    subtitle: "Classify large volumes of text at the lowest possible cost per request",
    category: "data",
    heroEmoji: "📊",
    description: "Process high volumes (10K-1M items/day) of classification tasks — sentiment analysis, topic categorization, spam detection, content moderation — while keeping cost below $0.01 per request.",
    sections: [
      { heading: "The job to be done", body: "Classify text inputs into predefined categories with consistent accuracy. Handle 10K-1M items daily. Output structured labels with confidence scores. Maintain >90% accuracy on standard categories." },
      { heading: "Key tradeoffs", body: "Cost is the dominant constraint. A frontier model costs 10-50x more per request than a budget model. For well-defined categories, a budget model often achieves 90%+ accuracy. Quality only matters at the margins." },
      { heading: "When to switch models", body: "Start with the cheapest model that hits your accuracy threshold. Only upgrade for categories with high error rates. Consider fine-tuning a small model if your use case is stable." },
    ],
    templatePrompt: "Classify 100K product reviews by sentiment (positive/negative/neutral) and topic (quality/shipping/support/price) at the lowest possible cost per request.",
    templateTrack: "cost",
    recommendedModels: ["gpt-5.4-nano", "gemini-2.5-flash-lite", "claude-haiku-4.5"],
    relatedGuides: ["data-analysis"],
    faqItems: [
      { question: "What accuracy can I expect from budget models?", answer: "For standard sentiment analysis, budget models typically achieve 88-93% accuracy. For domain-specific classification, accuracy may be 80-85% without fine-tuning." },
      { question: "Should I use batch APIs?", answer: "Yes. Most providers offer 50% discounts on batch API calls. If latency isn't critical, batch processing can halve your costs." },
    ],
    metaTitle: "Best AI Model for Cheap Batch Classification | NexusRoute",
    metaDescription: "Find the most cost-effective AI model for high-volume text classification. Compare budget models for sentiment analysis, topic categorization, and more.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "polished-long-form-writing",
    title: "Polished Long-Form Writing",
    subtitle: "Generate high-quality articles, essays, and content that match your brand voice",
    category: "writing",
    heroEmoji: "✍️",
    description: "Produce publication-ready long-form content — thought leadership articles, blog posts, documentation, reports — that maintains consistent voice, structure, and quality across 2000+ words.",
    sections: [
      { heading: "The job to be done", body: "Generate well-structured, engaging long-form content that reads naturally, maintains a consistent voice, follows editorial guidelines, and requires minimal human editing before publication." },
      { heading: "Key tradeoffs", body: "Writing quality varies dramatically across models. Frontier models produce more nuanced prose but cost 5-10x more. The best writing models handle voice matching, transitions, and argument structure much better." },
      { heading: "When to switch models", body: "Use a frontier writing model for thought leadership and external-facing content. Switch to mid-tier for internal documentation and routine blog posts. Budget models work for first drafts that will be heavily edited." },
    ],
    templatePrompt: "Write a compelling 2000-word thought leadership article about AI in enterprise, matching a sophisticated, authoritative brand voice with concrete examples.",
    templateTrack: "quality",
    recommendedModels: ["claude-opus-4", "gpt-5.4", "claude-sonnet-4.5"],
    relatedGuides: ["creative-writing", "content-marketing"],
    faqItems: [
      { question: "How do I maintain brand voice consistency?", answer: "Include 2-3 example paragraphs in your prompt that demonstrate the desired voice. Use system prompts to define tone, vocabulary, and stylistic constraints." },
      { question: "Can AI write genuinely good long-form content?", answer: "Frontier models produce content that requires light editing for most business use cases. The key is detailed prompting with structure, audience, and voice guidance." },
    ],
    metaTitle: "Best AI Model for Long-Form Writing | NexusRoute",
    metaDescription: "Find the ideal AI model for generating polished articles, essays, and brand content. Compare writing quality, voice matching, and cost.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "data-extraction-pipeline",
    title: "Data Extraction Pipeline",
    subtitle: "Build reliable pipelines that transform unstructured data into structured formats",
    category: "extraction",
    heroEmoji: "🔧",
    description: "Create production data pipelines that consistently extract, normalize, and structure information from diverse unstructured sources — emails, PDFs, web pages, forms — into clean, validated output.",
    sections: [
      { heading: "The job to be done", body: "Process diverse input formats (emails, PDFs, HTML, images) and extract specific data fields into a consistent schema. Handle variations, missing fields, and ambiguous content gracefully." },
      { heading: "Key tradeoffs", body: "Structured output support (JSON mode) is critical for pipeline reliability. Cost scales with volume. Vision capabilities needed for document/image inputs. Latency matters for real-time pipelines." },
      { heading: "When to switch models", body: "Use structured-output-capable models for production pipelines. Use vision models for image/PDF inputs. Switch to cheaper models for high-volume, simple extractions with predictable formats." },
    ],
    templatePrompt: "Build a data extraction pipeline that processes customer emails, extracts order IDs, product names, issue types, and sentiment into structured JSON for CRM integration.",
    templateTrack: "quality",
    recommendedModels: ["gpt-5.4", "claude-sonnet-4.5", "gemini-2.5-pro"],
    relatedGuides: ["data-analysis"],
    faqItems: [
      { question: "How do I handle extraction errors?", answer: "Include confidence scores in your schema. Flag low-confidence extractions for human review. Implement schema validation to catch structural issues before they reach your database." },
      { question: "What about multimodal inputs?", answer: "Use vision-capable models for PDFs and images. Most frontier models now support vision input, making it possible to extract from scanned documents and screenshots." },
    ],
    metaTitle: "Best AI Model for Data Extraction Pipelines | NexusRoute",
    metaDescription: "Find the best AI model for building reliable data extraction pipelines. Compare structured output support, vision capabilities, and throughput.",
    updatedAt: "2026-04-13",
  },
  {
    slug: "research-synthesis",
    title: "Research Synthesis",
    subtitle: "Analyze multiple sources and produce comprehensive research summaries",
    category: "research",
    heroEmoji: "🔬",
    description: "Process multiple research papers, reports, or data sources to produce synthesized analyses, literature reviews, competitive landscapes, or market research reports with proper attribution.",
    sections: [
      { heading: "The job to be done", body: "Ingest 5-50 documents, identify key themes, contradictions, and gaps, and produce a coherent synthesis that accurately represents the source material with proper citations." },
      { heading: "Key tradeoffs", body: "Reasoning quality determines synthesis depth. Long context is needed for multi-document analysis. Factual accuracy is critical — hallucinated citations are worse than no citations." },
      { heading: "When to switch models", body: "Use frontier reasoning models for complex multi-source synthesis. Use mid-tier models for single-document summarization. Consider models with web search for market research." },
    ],
    templatePrompt: "Analyze 20 recent research papers on retrieval-augmented generation (RAG), identify key findings, methodological approaches, and open questions. Produce a structured literature review.",
    templateTrack: "quality",
    recommendedModels: ["claude-opus-4", "o3", "gemini-2.5-pro"],
    relatedGuides: ["research"],
    faqItems: [
      { question: "How do I ensure citation accuracy?", answer: "Pass source documents with clear identifiers. Instruct the model to cite specific documents by ID. Cross-validate key claims against original sources." },
      { question: "Can AI replace human researchers?", answer: "AI excels at synthesizing large volumes of material quickly. Human researchers provide critical thinking, novel connections, and domain judgment. Best results combine both." },
    ],
    metaTitle: "Best AI Model for Research Synthesis | NexusRoute",
    metaDescription: "Find the ideal AI model for multi-source research analysis and synthesis. Compare reasoning quality, context windows, and citation accuracy.",
    updatedAt: "2026-04-13",
  },
];
