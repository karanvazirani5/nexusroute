// ─────────────────────────────────────────────────────────────────────────────
// Prompt Rewrite Engine — deterministic, runs 100% in the browser
// ─────────────────────────────────────────────────────────────────────────────

/* ══════════════ Types ══════════════ */

export type TaskCategory =
  | "coding"
  | "writing"
  | "analysis"
  | "creative"
  | "math"
  | "research"
  | "conversation"
  | "summarization"
  | "translation"
  | "brainstorming"
  | "data-extraction"
  | "instruction-following"
  | "roleplay";

export type Complexity = "simple" | "moderate" | "complex" | "expert";

export interface PromptAnalysis {
  taskCategory: TaskCategory;
  complexity: Complexity;
  hasContext: boolean;
  hasConstraints: boolean;
  hasExamples: boolean;
  hasPersona: boolean;
  isVague: boolean;
  isTooShort: boolean;
  estimatedTokens: number;
  keywords: string[];
}

export interface ImprovementType {
  type:
    | "structure"
    | "specificity"
    | "context"
    | "format"
    | "persona"
    | "constraints"
    | "examples"
    | "chain-of-thought";
  label: string;
  description: string;
}

export interface RewriteRule {
  condition: (analysis: PromptAnalysis) => boolean;
  apply: (prompt: string, analysis: PromptAnalysis) => string;
  improvement: ImprovementType;
}

export interface ModelPromptProfile {
  id: string;
  displayName: string;
  provider: string;
  directLink: string;
  prefersSystemPrompt: boolean;
  prefersXmlTags: boolean;
  prefersMarkdown: boolean;
  prefersChainOfThought: boolean;
  prefersExamples: boolean;
  prefersConciseInput: boolean;
  supportsImages: boolean;
  supportsFiles: boolean;
  strengths: TaskCategory[];
  maxContext: number;
  sweetSpotTokens: [number, number];
  rewriteRules: RewriteRule[];
  tips: string[];
}

export interface RewriteResult {
  optimizedPrompt: string;
  modelId: string;
  modelDisplayName: string;
  improvements: ImprovementType[];
  confidenceScore: number;
  estimatedQualityGain: number;
  tips: string[];
  directLink: string;
}

/* ══════════════ Keyword dictionaries ══════════════ */

const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  coding: [
    "code", "function", "debug", "api", "react", "python", "javascript", "typescript",
    "rust", "go", "java", "sql", "css", "html", "component", "class", "module",
    "bug", "error", "fix", "implement", "refactor", "test", "deploy", "git", "docker",
    "database", "endpoint", "server", "frontend", "backend", "algorithm", "script",
    "compile", "runtime", "package", "npm", "pip", "import", "variable", "array",
    "object", "regex", "rest", "graphql", "crud", "authentication", "middleware",
  ],
  writing: [
    "write", "draft", "essay", "email", "blog", "article", "letter", "memo",
    "proposal", "report", "resume", "cover letter", "press release", "newsletter",
    "copy", "content", "paragraph", "proofread", "edit text", "rewrite",
    "tone", "headline", "tagline", "slogan", "description", "bio",
  ],
  analysis: [
    "analyze", "analysis", "evaluate", "assess", "compare", "examine", "review",
    "investigate", "interpret", "breakdown", "pros and cons", "strengths and weaknesses",
    "insight", "trend", "pattern", "metric", "data", "statistics", "correlation",
  ],
  creative: [
    "poem", "story", "creative", "fiction", "imagine", "narrative", "dialogue",
    "character", "plot", "screenplay", "lyrics", "haiku", "sonnet", "myth",
    "fairy tale", "fantasy", "sci-fi", "worldbuild",
  ],
  math: [
    "math", "calculate", "equation", "formula", "proof", "theorem", "algebra",
    "calculus", "geometry", "probability", "statistics", "integral", "derivative",
    "matrix", "vector", "solve", "compute",
  ],
  research: [
    "research", "find information", "what is", "how does", "explain", "define",
    "look up", "search", "source", "cite", "reference", "evidence",
    "background", "history of", "origin", "study", "paper",
  ],
  conversation: [
    "chat", "talk", "discuss", "conversation", "tell me about", "what do you think",
    "opinion", "hey", "hello", "hi",
  ],
  summarization: [
    "summarize", "summary", "tldr", "tl;dr", "key points", "main ideas",
    "condense", "brief", "overview", "recap", "digest", "abstract",
  ],
  translation: [
    "translate", "translation", "in spanish", "in french", "in german", "in japanese",
    "in chinese", "in korean", "in portuguese", "in italian", "in russian",
    "in arabic", "to english", "language",
  ],
  brainstorming: [
    "brainstorm", "ideas", "suggest", "recommend", "options", "alternatives",
    "what are some", "give me ideas", "come up with", "list of", "possibilities",
  ],
  "data-extraction": [
    "extract", "parse", "scrape", "pull out", "get the", "find all",
    "list the", "identify", "detect", "classify", "categorize", "label",
    "structured data", "json", "csv", "table",
  ],
  "instruction-following": [
    "follow these", "step by step", "instructions", "procedure", "guide",
    "how to", "tutorial", "walkthrough", "recipe",
  ],
  roleplay: [
    "act as", "you are", "pretend", "roleplay", "simulate", "impersonate",
    "imagine you're", "play the role", "character",
  ],
};

const VAGUE_STARTERS = [
  "help me", "can you", "i need", "please", "i want", "do something",
  "assist", "make", "give me", "show me",
];

/* ══════════════ Prompt Analyzer ══════════════ */

export class PromptAnalyzer {
  analyze(prompt: string): PromptAnalysis {
    const lower = prompt.toLowerCase().trim();
    const words = lower.split(/\s+/);
    const wordCount = words.length;

    const taskCategory = this.detectCategory(lower);
    const complexity = this.detectComplexity(lower, wordCount);
    const keywords = this.extractKeywords(lower, taskCategory);

    return {
      taskCategory,
      complexity,
      hasContext: this.detectContext(lower),
      hasConstraints: this.detectConstraints(lower),
      hasExamples: this.detectExamples(lower),
      hasPersona: this.detectPersona(lower),
      isVague: this.detectVague(lower, wordCount),
      isTooShort: wordCount < 10,
      estimatedTokens: Math.ceil(wordCount * 1.3),
      keywords,
    };
  }

  private detectCategory(text: string): TaskCategory {
    let best: TaskCategory = "conversation";
    let bestScore = 0;

    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TaskCategory, string[]][]) {
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = cat;
      }
    }
    return best;
  }

  private detectComplexity(text: string, wordCount: number): Complexity {
    if (wordCount < 8) return "simple";
    if (wordCount < 30) return "moderate";

    const complexSignals = [
      "advanced", "complex", "sophisticated", "comprehensive", "detailed",
      "production", "enterprise", "scalable", "architecture", "system design",
      "multi-step", "pipeline", "workflow", "integrate", "optimize",
    ];
    const expertSignals = [
      "phd", "peer-review", "novel approach", "state of the art", "cutting-edge",
      "distributed system", "formal verification", "proof", "theorem",
    ];

    const hasExpert = expertSignals.some(s => text.includes(s));
    if (hasExpert || wordCount > 200) return "expert";

    const hasComplex = complexSignals.some(s => text.includes(s));
    if (hasComplex || wordCount > 80) return "complex";

    return "moderate";
  }

  private detectContext(text: string): boolean {
    const signals = [
      "context:", "background:", "here is", "given that", "i have",
      "my project", "my app", "my code", "currently", "we are",
      "the situation", "the problem is",
    ];
    return signals.some(s => text.includes(s));
  }

  private detectConstraints(text: string): boolean {
    const signals = [
      "must", "should", "format", "length", "tone", "style", "no more than",
      "at most", "at least", "maximum", "minimum", "limit", "constraint",
      "require", "ensure", "keep it", "make sure", "do not", "don't",
      "avoid", "only use", "output as", "return as",
    ];
    return signals.some(s => text.includes(s));
  }

  private detectExamples(text: string): boolean {
    const signals = [
      "for example", "e.g.", "such as", "like this", "here's an example",
      "sample", "instance", "illustration",
    ];
    return signals.some(s => text.includes(s));
  }

  private detectPersona(text: string): boolean {
    const signals = [
      "act as", "you are", "pretend", "roleplay", "imagine you're",
      "play the role", "as a", "be a",
    ];
    return signals.some(s => text.includes(s));
  }

  private detectVague(text: string, wordCount: number): boolean {
    if (wordCount < 5) return true;
    return VAGUE_STARTERS.some(s => text.startsWith(s)) && wordCount < 15;
  }

  private extractKeywords(text: string, category: TaskCategory): string[] {
    const kws = CATEGORY_KEYWORDS[category] ?? [];
    return kws.filter(kw => text.includes(kw)).slice(0, 8);
  }
}

/* ══════════════ Model Profiles ══════════════ */

function codingRulesXml(): RewriteRule[] {
  return [
    {
      condition: a => a.taskCategory === "coding",
      apply: (p) =>
        p +
        "\n\nInclude error handling, type annotations, and inline comments for complex logic. Provide all imports — no placeholder comments.",
      improvement: {
        type: "specificity",
        label: "Code quality directives",
        description: "Added requirements for error handling, types, and completeness",
      },
    },
  ];
}

function writingRuleNatural(): RewriteRule {
  return {
    condition: a => a.taskCategory === "writing" || a.taskCategory === "creative",
    apply: (p) =>
      p + "\n\nUse a natural human tone. Avoid AI-sounding language, filler phrases, and clichés.",
    improvement: {
      type: "constraints",
      label: "Natural tone directive",
      description: "Added instruction for human-sounding writing",
    },
  };
}

function vagueAskClarify(): RewriteRule {
  return {
    condition: a => a.isVague,
    apply: (p) =>
      p + "\n\nIf anything in my request is ambiguous, ask me clarifying questions before proceeding.",
    improvement: {
      type: "specificity",
      label: "Clarification directive",
      description: "Instructed the model to ask clarifying questions for vague input",
    },
  };
}

function conciseDirect(): RewriteRule {
  return {
    condition: a => a.taskCategory !== "creative" && a.taskCategory !== "writing",
    apply: (p) => p + "\n\nBe direct and concise. No preamble.",
    improvement: {
      type: "constraints",
      label: "Conciseness directive",
      description: "Added instruction to be direct without unnecessary preamble",
    },
  };
}

export const MODEL_PROFILES: Record<string, ModelPromptProfile> = {
  /* ─── Claude Opus 4 ─── */
  "claude-opus-4": {
    id: "claude-opus-4",
    displayName: "Claude Opus 4",
    provider: "Anthropic",
    directLink: "https://claude.ai/new",
    prefersSystemPrompt: true,
    prefersXmlTags: true,
    prefersMarkdown: false,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: true,
    strengths: ["coding", "analysis", "research", "writing", "math"],
    maxContext: 200_000,
    sweetSpotTokens: [200, 4000],
    rewriteRules: [
      ...codingRulesXml(),
      writingRuleNatural(),
      vagueAskClarify(),
      conciseDirect(),
    ],
    tips: [
      "Use XML tags like <context> and <task> to structure long prompts",
      "Explicitly request chain-of-thought for reasoning-heavy tasks",
      "For coding, ask for inline comments only on complex logic",
      "Opus excels at nuanced, multi-step analysis — lean into that",
    ],
  },

  /* ─── Claude Sonnet 4 ─── */
  "claude-sonnet-4": {
    id: "claude-sonnet-4",
    displayName: "Claude Sonnet 4",
    provider: "Anthropic",
    directLink: "https://claude.ai/new",
    prefersSystemPrompt: true,
    prefersXmlTags: true,
    prefersMarkdown: false,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: true,
    strengths: ["coding", "analysis", "instruction-following", "writing"],
    maxContext: 200_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a => a.taskCategory === "coding",
        apply: (p) =>
          p +
          "\n\nProvide complete code — no placeholder comments like '// rest of implementation here'. Include all imports.",
        improvement: {
          type: "specificity",
          label: "Completeness directive",
          description: "Ensured model outputs full code without placeholders",
        },
      },
      writingRuleNatural(),
      vagueAskClarify(),
      {
        condition: () => true,
        apply: (p) => p + "\n\nBe concise and direct. No preamble.",
        improvement: {
          type: "constraints",
          label: "Conciseness directive",
          description: "Added instruction to be direct without unnecessary preamble",
        },
      },
    ],
    tips: [
      "Sonnet is great for fast, high-quality code — specify language and framework up front",
      "Use XML tags like <task> and <constraints> for structured prompts",
      "For complex tasks, break them into numbered steps",
      "Explicitly state the output format you want (JSON, markdown, etc.)",
    ],
  },

  /* ─── Claude Haiku 4 ─── */
  "claude-haiku-4": {
    id: "claude-haiku-4",
    displayName: "Claude Haiku 4",
    provider: "Anthropic",
    directLink: "https://claude.ai/new",
    prefersSystemPrompt: true,
    prefersXmlTags: true,
    prefersMarkdown: false,
    prefersChainOfThought: false,
    prefersExamples: false,
    prefersConciseInput: true,
    supportsImages: true,
    supportsFiles: false,
    strengths: ["data-extraction", "conversation", "summarization"],
    maxContext: 200_000,
    sweetSpotTokens: [50, 500],
    rewriteRules: [
      {
        condition: a => a.estimatedTokens > 500,
        apply: (p) => p + "\n\nKeep your response concise — focus on the essentials.",
        improvement: {
          type: "constraints",
          label: "Length warning",
          description: "Added conciseness directive for speed-optimized model",
        },
      },
      vagueAskClarify(),
    ],
    tips: [
      "Haiku is optimized for speed — keep prompts short and focused",
      "Best for data extraction, quick Q&A, and classification",
      "Avoid complex multi-step reasoning tasks — use Sonnet or Opus instead",
      "Great for high-volume, low-latency use cases",
    ],
  },

  /* ─── GPT-5 ─── */
  "gpt-5": {
    id: "gpt-5",
    displayName: "GPT-5",
    provider: "OpenAI",
    directLink: "https://chatgpt.com/?model=gpt-5",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: true,
    strengths: ["coding", "analysis", "research", "creative", "math"],
    maxContext: 1_000_000,
    sweetSpotTokens: [200, 4000],
    rewriteRules: [
      {
        condition: a =>
          a.complexity === "complex" || a.complexity === "expert",
        apply: (p) => "Let's approach this step-by-step.\n\n" + p,
        improvement: {
          type: "chain-of-thought",
          label: "Step-by-step framing",
          description: "Added chain-of-thought trigger for complex task",
        },
      },
      {
        condition: a => a.taskCategory === "creative",
        apply: (p) =>
          p + "\n\nBe original, avoid clichés, and surprise me.",
        improvement: {
          type: "specificity",
          label: "Creativity boost",
          description: "Added originality directive for creative tasks",
        },
      },
      {
        condition: a => a.taskCategory === "coding",
        apply: (p) =>
          p +
          "\n\nStructure your response as:\n1. Imports and setup\n2. Type definitions\n3. Core implementation with error handling\n4. Usage example",
        improvement: {
          type: "format",
          label: "Structured code output",
          description: "Added numbered output structure for code tasks",
        },
      },
      writingRuleNatural(),
      vagueAskClarify(),
    ],
    tips: [
      "GPT-5 has a 1M token context window — great for huge documents",
      "Use markdown formatting in your prompts (headers, lists, bold)",
      "For code, ask for a specific output structure",
      "Supports web browsing — ask it to search for current information",
    ],
  },

  /* ─── GPT-4o ─── */
  "gpt-4o": {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "OpenAI",
    directLink: "https://chatgpt.com/?model=gpt-4o",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: true,
    strengths: ["coding", "analysis", "conversation", "writing"],
    maxContext: 128_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a => a.isVague,
        apply: (p) =>
          p +
          "\n\nState your assumptions before proceeding, then answer.",
        improvement: {
          type: "specificity",
          label: "Assumption surfacing",
          description: "Instructed model to state assumptions for vague input",
        },
      },
      writingRuleNatural(),
      conciseDirect(),
    ],
    tips: [
      "GPT-4o is a strong multimodal model — send images alongside text",
      "Use markdown formatting for structured prompts",
      "Good balance of speed and quality for everyday tasks",
      "For vague prompts, it works well when asked to state assumptions first",
    ],
  },

  /* ─── Gemini 3 Pro ─── */
  "gemini-3-pro": {
    id: "gemini-3-pro",
    displayName: "Gemini 3 Pro",
    provider: "Google",
    directLink: "https://gemini.google.com/app",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: true,
    strengths: ["research", "analysis", "summarization", "coding"],
    maxContext: 2_000_000,
    sweetSpotTokens: [200, 5000],
    rewriteRules: [
      {
        condition: a => a.taskCategory === "research",
        apply: (p) =>
          p +
          "\n\nUse Google Search to ground your response with current data. Cite your sources.",
        improvement: {
          type: "specificity",
          label: "Search grounding",
          description: "Enabled web search grounding for research accuracy",
        },
      },
      {
        condition: a => a.taskCategory === "summarization",
        apply: (p) =>
          p +
          "\n\nFormat your summary as:\n- **Key takeaways** (bullet points)\n- **Main themes**\n- **Notable omissions or gaps**",
        improvement: {
          type: "format",
          label: "Structured summary format",
          description: "Added organized summary template with sections",
        },
      },
      {
        condition: a =>
          a.complexity === "complex" || a.complexity === "expert",
        apply: (p) =>
          p +
          "\n\nBreak the problem into sub-parts, address each individually, then synthesize your final answer.",
        improvement: {
          type: "chain-of-thought",
          label: "Decomposition strategy",
          description: "Added sub-problem decomposition for complex tasks",
        },
      },
      vagueAskClarify(),
    ],
    tips: [
      "Gemini 3 Pro has a massive 2M token context window",
      "Leverage Google Search grounding for current events and research",
      "Great for long-document analysis and cross-referencing",
      "Use structured output formats for analytical tasks",
    ],
  },

  /* ─── Gemini 3 Flash ─── */
  "gemini-3-flash": {
    id: "gemini-3-flash",
    displayName: "Gemini 3 Flash",
    provider: "Google",
    directLink: "https://gemini.google.com/app",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: false,
    prefersExamples: false,
    prefersConciseInput: true,
    supportsImages: true,
    supportsFiles: true,
    strengths: ["data-extraction", "summarization", "conversation"],
    maxContext: 1_000_000,
    sweetSpotTokens: [50, 1000],
    rewriteRules: [
      {
        condition: () => true,
        apply: (p) => p + "\n\nBe concise and get straight to the point.",
        improvement: {
          type: "constraints",
          label: "Conciseness directive",
          description: "Added brevity instruction for speed-optimized model",
        },
      },
    ],
    tips: [
      "Flash is optimized for speed — keep prompts focused",
      "1M context window — good for moderate-length documents",
      "Best for quick Q&A, data extraction, and simple summaries",
      "Avoid heavy reasoning tasks — use Gemini 3 Pro instead",
    ],
  },

  /* ─── DeepSeek V3 ─── */
  "deepseek-v3": {
    id: "deepseek-v3",
    displayName: "DeepSeek V3",
    provider: "DeepSeek",
    directLink: "https://chat.deepseek.com/",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: false,
    supportsFiles: false,
    strengths: ["coding", "math", "analysis"],
    maxContext: 128_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a => a.taskCategory === "coding",
        apply: (p) =>
          p +
          "\n\nInclude type hints/annotations, proper error handling, and docstrings for public functions.",
        improvement: {
          type: "specificity",
          label: "Type safety directives",
          description: "Added type annotation and documentation expectations",
        },
      },
      {
        condition: a => a.taskCategory === "math",
        apply: (p) =>
          p +
          "\n\nShow your complete mathematical reasoning step by step. Verify your answer at the end.",
        improvement: {
          type: "chain-of-thought",
          label: "Math verification",
          description: "Added step-by-step reasoning and answer verification for math",
        },
      },
      vagueAskClarify(),
    ],
    tips: [
      "DeepSeek V3 is exceptionally strong at code and math",
      "Use markdown formatting for structured prompts",
      "Ask for type hints and docstrings explicitly for best code output",
      "For math, always request verification of the final answer",
    ],
  },

  /* ─── DeepSeek R1 ─── */
  "deepseek-r1": {
    id: "deepseek-r1",
    displayName: "DeepSeek R1",
    provider: "DeepSeek",
    directLink: "https://chat.deepseek.com/",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: false, // has built-in CoT — do NOT add "think step by step"
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: false,
    supportsFiles: false,
    strengths: ["math", "coding", "analysis", "research"],
    maxContext: 128_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: () => true,
        apply: (p) =>
          p +
          "\n\nProvide your final answer clearly at the end after your reasoning.",
        improvement: {
          type: "format",
          label: "Clear final answer",
          description: "Directed R1 to clearly separate reasoning from final answer",
        },
      },
      vagueAskClarify(),
    ],
    tips: [
      "R1 has built-in chain-of-thought — do NOT add 'think step by step' (it makes it worse)",
      "Instead, ask for a clear final answer after its reasoning",
      "Excellent for complex math proofs, logic, and competitive programming",
      "The model's internal reasoning is extensive — be patient with response time",
    ],
  },

  /* ─── Llama 4 Maverick ─── */
  "llama-4-maverick": {
    id: "llama-4-maverick",
    displayName: "Llama 4 Maverick",
    provider: "Meta",
    directLink: "https://www.meta.ai/",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: false,
    strengths: ["coding", "conversation", "writing", "brainstorming"],
    maxContext: 1_000_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a => a.isVague,
        apply: (p) =>
          p +
          "\n\nBe specific in your response. If my request is unclear, ask for clarification rather than guessing.",
        improvement: {
          type: "specificity",
          label: "Specificity directive",
          description: "Added clarity requirement for vague prompts",
        },
      },
      conciseDirect(),
    ],
    tips: [
      "Llama 4 Maverick is an open-weight model — good for self-hosting",
      "Has a 1M context window",
      "Strong at general tasks and conversation",
      "For best results, be specific about what you want in your prompt",
    ],
  },

  /* ─── Grok 3 ─── */
  "grok-3": {
    id: "grok-3",
    displayName: "Grok 3",
    provider: "xAI",
    directLink: "https://x.com/i/grok",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: false,
    prefersConciseInput: false,
    supportsImages: true,
    supportsFiles: false,
    strengths: ["research", "conversation", "analysis", "creative"],
    maxContext: 128_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a =>
          a.taskCategory === "research" || a.taskCategory === "analysis",
        apply: (p) =>
          p +
          "\n\nInclude the most recent data available. Cite specific sources and posts where relevant.",
        improvement: {
          type: "specificity",
          label: "Real-time data directive",
          description: "Leveraged Grok's real-time X/Twitter data access",
        },
      },
      vagueAskClarify(),
    ],
    tips: [
      "Grok has real-time access to X/Twitter data — great for current events",
      "Ask it to cite specific posts and sources for research tasks",
      "Has a witty, direct personality by default",
      "Good for social media analysis and trend monitoring",
    ],
  },

  /* ─── Mistral Large ─── */
  "mistral-large": {
    id: "mistral-large",
    displayName: "Mistral Large",
    provider: "Mistral",
    directLink: "https://chat.mistral.ai/chat",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: true,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: false,
    supportsFiles: false,
    strengths: ["instruction-following", "coding", "translation", "analysis"],
    maxContext: 128_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a => a.taskCategory === "translation",
        apply: (p) =>
          p +
          "\n\nPreserve nuance, idioms, and cultural context. Flag any phrases that don't translate directly.",
        improvement: {
          type: "specificity",
          label: "Nuance preservation",
          description: "Added translation quality directives for cultural accuracy",
        },
      },
      conciseDirect(),
    ],
    tips: [
      "Mistral Large excels at instruction-following and European languages",
      "For translation, ask it to flag culturally-specific phrases",
      "Strong at structured output and following complex instructions",
      "Good alternative for coding tasks with clear specifications",
    ],
  },

  /* ─── Command R+ ─── */
  "command-r-plus": {
    id: "command-r-plus",
    displayName: "Command R+",
    provider: "Cohere",
    directLink: "https://coral.cohere.com/",
    prefersSystemPrompt: true,
    prefersXmlTags: false,
    prefersMarkdown: true,
    prefersChainOfThought: false,
    prefersExamples: true,
    prefersConciseInput: false,
    supportsImages: false,
    supportsFiles: true,
    strengths: ["research", "summarization", "data-extraction"],
    maxContext: 128_000,
    sweetSpotTokens: [100, 2000],
    rewriteRules: [
      {
        condition: a =>
          a.taskCategory === "research" || a.taskCategory === "summarization",
        apply: (p) =>
          p +
          "\n\nGround your response in the provided documents. Cite specific passages to support each point.",
        improvement: {
          type: "specificity",
          label: "RAG grounding",
          description: "Enabled document-grounded responses with citations",
        },
      },
      vagueAskClarify(),
    ],
    tips: [
      "Command R+ is built for RAG — upload documents for best results",
      "Always ask it to cite specific passages from provided documents",
      "Strong at summarization and information extraction",
      "Great for enterprise search and knowledge base Q&A",
    ],
  },
};

/* ══════════════ ID Mapping ══════════════
 * Maps the app's model IDs (e.g. "claude-opus-4.6") to the rewrite engine's
 * profile IDs (e.g. "claude-opus-4"). Unmapped IDs fall through as-is.
 */

export const APP_TO_PROFILE_ID: Record<string, string> = {
  // Anthropic
  "claude-opus-4.6": "claude-opus-4",
  "claude-sonnet-4.6": "claude-sonnet-4",
  "claude-haiku-4.5": "claude-haiku-4",
  // OpenAI
  "gpt-5.4": "gpt-5",
  "gpt-5.4-mini": "gpt-5",
  "gpt-5.4-nano": "gpt-4o",
  "o3": "gpt-5",
  "o4-mini": "gpt-4o",
  // Google
  "gemini-2.5-pro": "gemini-3-pro",
  "gemini-2.5-flash": "gemini-3-flash",
  "gemini-2.5-flash-lite": "gemini-3-flash",
  "gemini-3.1-pro": "gemini-3-pro",
  // xAI
  "grok-4.20": "grok-3",
  "grok-4.1-fast": "grok-3",
  // Meta
  "llama-4-scout": "llama-4-maverick",
  "llama-4-maverick": "llama-4-maverick",
  "llama-3.3-70b": "llama-4-maverick",
  // DeepSeek
  "deepseek-v3.2": "deepseek-v3",
  "deepseek-r1": "deepseek-r1",
  // Mistral
  "mistral-large-3": "mistral-large",
  "mistral-medium-3": "mistral-large",
  "mistral-small-4": "mistral-large",
  // Alibaba
  "qwen-3.5": "deepseek-v3",
  "qwen-3.6-plus": "deepseek-v3",
  // Cohere
  "command-r-plus": "command-r-plus",
};

/* ══════════════ Universal Rewrite Rules ══════════════ */

function getUniversalRules(profile: ModelPromptProfile): RewriteRule[] {
  return [
    // Add framing line for complex/expert prompts that lack structure
    {
      condition: a =>
        (a.complexity === "complex" || a.complexity === "expert") && !a.hasContext,
      apply: (p) => "Here is what I need:\n\n" + p,
      improvement: {
        type: "structure",
        label: "Task framing",
        description: "Added a clear framing line to introduce the task",
      },
    },
    // Wrap in XML tags for Claude-family models on non-simple prompts
    {
      condition: a =>
        profile.prefersXmlTags &&
        a.complexity !== "simple" &&
        !a.isTooShort &&
        !/<\w+>/.test(""), // always true — actual XML check is done in apply
      apply: (p, a) => {
        if (/<\w+>/.test(p)) return p; // already has XML tags
        const tag = a.hasContext ? "task" : "request";
        return `<${tag}>\n${p}\n</${tag}>`;
      },
      improvement: {
        type: "structure",
        label: "XML structure",
        description: "Wrapped prompt in XML tags preferred by this model",
      },
    },
    // Add markdown format directive for markdown-preferring models on analytical tasks
    {
      condition: a =>
        profile.prefersMarkdown &&
        ["analysis", "research", "summarization"].includes(a.taskCategory) &&
        !a.hasConstraints,
      apply: (p) =>
        p +
        "\n\nFormat your response with clear headers and organized sections.",
      improvement: {
        type: "format",
        label: "Markdown structure",
        description: "Added structured formatting directive for this model",
      },
    },
    // Add specificity prompt for too-short prompts
    {
      condition: a => a.isTooShort && !a.hasConstraints,
      apply: (p) =>
        p +
        "\n\nBe thorough and detailed in your response. Cover the key aspects comprehensively.",
      improvement: {
        type: "specificity",
        label: "Detail directive",
        description: "Added depth directive to compensate for short prompt",
      },
    },
  ];
}

/* ══════════════ Prompt Rewriter ══════════════ */

export class PromptRewriter {
  private analyzer = new PromptAnalyzer();

  rewrite(rawPrompt: string, modelId: string): RewriteResult {
    const profileId = APP_TO_PROFILE_ID[modelId] ?? modelId;
    const profile = MODEL_PROFILES[profileId];

    // If no profile found, return as-is with minimal metadata
    if (!profile) {
      return {
        optimizedPrompt: rawPrompt,
        modelId,
        modelDisplayName: modelId,
        improvements: [],
        confidenceScore: 50,
        estimatedQualityGain: 0,
        tips: [],
        directLink: "",
      };
    }

    const analysis = this.analyzer.analyze(rawPrompt);
    let prompt = rawPrompt.trim();
    const improvements: ImprovementType[] = [];

    // Apply universal rules first
    for (const rule of getUniversalRules(profile)) {
      if (rule.condition(analysis)) {
        const before = prompt;
        prompt = rule.apply(prompt, analysis);
        if (prompt !== before) {
          improvements.push(rule.improvement);
        }
      }
    }

    // Apply model-specific rules
    for (const rule of profile.rewriteRules) {
      if (rule.condition(analysis)) {
        const before = prompt;
        prompt = rule.apply(prompt, analysis);
        if (prompt !== before) {
          improvements.push(rule.improvement);
        }
      }
    }

    // Calculate confidence score
    let confidence = 60;
    if (profile.strengths.includes(analysis.taskCategory)) confidence += 15;
    if (analysis.hasContext) confidence += 5;
    if (analysis.hasConstraints) confidence += 5;
    if (analysis.hasExamples) confidence += 5;
    if (analysis.hasPersona) confidence += 5;
    if (analysis.isVague) confidence -= 10;
    if (analysis.isTooShort) confidence -= 5;
    confidence = Math.max(20, Math.min(95, confidence));

    // Calculate estimated quality gain
    let gain = improvements.length * 8;
    if (analysis.isVague) gain += 15;
    if (analysis.isTooShort) gain += 10;
    gain = Math.min(65, gain);

    return {
      optimizedPrompt: prompt,
      modelId,
      modelDisplayName: profile.displayName,
      improvements,
      confidenceScore: confidence,
      estimatedQualityGain: gain,
      tips: profile.tips,
      directLink: profile.directLink,
    };
  }
}

/* ══════════════ Convenience export ══════════════ */

export function rewritePrompt(rawPrompt: string, modelId: string): RewriteResult {
  return new PromptRewriter().rewrite(rawPrompt, modelId);
}

/* ══════════════ Profile lookup helper (used by API route) ══════════════ */

export function getProfileForModel(appModelId: string): ModelPromptProfile | null {
  const profileId = APP_TO_PROFILE_ID[appModelId] ?? appModelId;
  return MODEL_PROFILES[profileId] ?? null;
}

/* ══════════════ LLM System Prompt ══════════════ */

export const REWRITE_SYSTEM_PROMPT = `You are a world-class prompt engineer. Your job is to take a user's raw prompt and REWRITE it from scratch to be maximally effective for a specific AI model. Do not just append instructions — genuinely restructure, clarify, and optimize the prompt.

You will receive a JSON object with:
- "prompt": the user's original prompt
- "model": { "id", "displayName", "provider", "prefersXmlTags", "prefersMarkdown", "prefersChainOfThought", "prefersConciseInput", "strengths" }

REWRITING PRINCIPLES:
1. RESTRUCTURE the prompt, don't just append canned phrases. Turn vague requests into specific, actionable instructions.
2. Preserve the user's original intent exactly. Do not add tasks they didn't ask for.
3. If the prompt is very short or vague, expand it with sensible defaults and specificity while keeping it focused.
4. Apply the model's formatting preferences naturally — XML tags for Claude, markdown for GPT/Gemini, etc.
5. The rewritten prompt should feel like an expert user wrote it, not like a bot appended boilerplate.

MODEL-SPECIFIC RULES:
- Claude models (Opus, Sonnet, Haiku): Use XML tags (<context>, <task>, <constraints>, <output_format>) to structure prompts. Claude responds well to explicit role assignment and structured sections.
- GPT models (GPT-5, GPT-4o): Use markdown formatting (## headers, **bold**, bullet lists). For complex tasks use "Let's approach this step-by-step."
- DeepSeek R1: Has BUILT-IN chain-of-thought. NEVER add "think step by step" — it degrades output. Instead add "After your reasoning, provide your final answer clearly at the end."
- DeepSeek V3: Strong at code/math. For code: request type annotations and error handling. For math: request verification.
- Gemini models: Leverage massive context window. For research: "Use Google Search to ground your response." For complex tasks: decompose into sub-problems.
- Grok: Has real-time X/Twitter data. For research: ask for recent data and specific source citations.
- Mistral: Excels at instruction-following and European languages. For translation: request nuance and cultural context preservation.
- Command R+: Built for RAG. For research: request document-grounded responses with passage citations.

RESPOND WITH A JSON OBJECT (and nothing else):
{
  "optimizedPrompt": "the fully rewritten prompt as a single string",
  "improvements": [
    {
      "type": "structure" | "specificity" | "context" | "format" | "persona" | "constraints" | "examples" | "chain-of-thought",
      "label": "short 2-4 word label",
      "description": "one sentence explaining what was improved"
    }
  ],
  "tips": ["model-specific tip 1", "model-specific tip 2"]
}

RULES FOR THE JSON:
- "optimizedPrompt" is the COMPLETE rewritten prompt. It should be self-contained.
- "improvements" should have 2-6 items describing what you changed.
- "tips" should have 2-4 tips specific to the target model.
- Do NOT include any text outside the JSON object.`;
