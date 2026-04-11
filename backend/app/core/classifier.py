from __future__ import annotations

import re

from app.models.schemas import TaskProfile

_CODE_KEYWORDS = {
    "function", "class", "def ", "import ", "return ", "variable",
    "code", "program", "script", "algorithm", "implement", "debug",
    "compile", "syntax", "api", "endpoint", "regex", "sql", "query",
    "html", "css", "javascript", "python", "java", "rust", "golang",
    "typescript", "react", "django", "flask", "fastapi", "docker",
    "kubernetes", "git", "refactor", "unit test", "bug", "fix the",
    "write a function", "write code", "code review",
}

_MATH_KEYWORDS = {
    "calculate", "compute", "solve", "equation", "integral",
    "derivative", "probability", "statistics", "matrix", "algebra",
    "geometry", "theorem", "proof", "formula", "summation",
    "factorial", "logarithm", "exponential",
}

_REASONING_KEYWORDS = {
    "explain why", "analyze", "compare", "evaluate", "reason",
    "think step by step", "logic", "argument", "pros and cons",
    "trade-off", "tradeoff", "implications", "consequences",
    "what would happen", "cause and effect", "critique",
}

_DEEP_REASONING_PHRASES = (
    "prove", "theorem", "step by step", "chain of thought", "formally verify",
    "mathematical proof",
)

_AGENTIC_PHRASES = (
    "agent", "automate", "workflow", "tool use", "browse", "search the web",
    "computer use", "execute", "run this",
)

_IMAGE_GEN_PHRASES = (
    "generate an image", "create a picture", "illustrate",
    "make an image", "design a logo",
)

_IMAGE_EDIT_PHRASES = (
    "edit this image", "modify the image", "remove background", "change the",
    "photoshop",
)

_VIDEO_GEN_PHRASES = (
    "generate a video", "create a video", "make a video", "animate",
)

_VOICE_PHRASES = (
    "voice", "speak", "realtime", "real-time conversation", "talk to me",
    "audio response",
)

_PRIVACY_PHRASES = (
    "private", "on-premise", "self-hosted", "local model", "no cloud",
    "data sovereignty", "gdpr", "hipaa",
)

_BATCH_COST_PHRASES = (
    "batch", "bulk", "thousands of", "millions of", "at scale", "cheapest",
    "lowest cost",
)

_ENTERPRISE_PHRASES = (
    "enterprise", "compliance", "audit", "sox", "pci", "production pipeline",
)

_VISION_KEYWORDS = (
    "screenshot", "screenshots", "photo", "photograph", "image", "picture",
    "diagram", "figure", "visual", "see the", "look at the", "attached image",
    "multimodal", "ocr", "scan this",
)

_REALTIME_EXTRA = (
    "real-time", "realtime", "live conversation", "streaming response",
)

_WEB_SEARCH_PHRASES = (
    "search the web", "browse the", "look up online", "google this",
    "current events", "latest news", "what happened today",
)

_LONG_CONTEXT_PHRASES = (
    "long document", "entire codebase", "whole codebase", "full codebase",
    "entire document", "whole document", "entire pdf", "full book",
    "entire file", "whole file",
)

_RESEARCH_SYNTHESIS_KEYWORDS = (
    "literature review", "synthesize", "peer-reviewed", "research paper",
    "deep analysis", "meta-analysis", "systematic review", "compare studies",
    "multiple sources", "survey of",
)

_LONG_DOC_ANALYSIS_KEYWORDS = (
    "very long document", "huge document", "entire manuscript", "full thesis",
    "whole report", "entire contract", "analyze this book", "100+ pages",
)

_DATA_EXTRACTION_DOC_KEYWORDS = (
    "from pdf", "from document", "from invoice", "from form", "extract fields",
    "structured data from", "parse this document", "table extraction",
)

_CUSTOMER_SUPPORT_KEYWORDS = (
    "support ticket", "customer support", "help desk", "faq", "refund",
    "order status", "my account", "billing issue", "customer service",
)

_FAST_CHAT_KEYWORDS = (
    "just curious", "quick question", "casual chat", "small talk", "hey there",
    "how are you", "chat with me",
)

_CREATIVE_KEYWORDS = {
    "write a story", "poem", "creative", "fiction", "narrative",
    "dialogue", "screenplay", "lyrics", "essay", "blog post",
    "write about", "imagine", "fantasy", "metaphor",
}

_SUMMARIZATION_KEYWORDS = {
    "summarize", "summary", "tldr", "tl;dr", "key points",
    "main ideas", "brief overview", "condense", "shorten",
}

_EXTRACTION_KEYWORDS = {
    "extract", "parse", "find all", "list all", "identify",
    "pull out", "get the", "data from",
}

_TRANSLATION_KEYWORDS = {
    "translate", "translation", "convert to", "in french",
    "in spanish", "in german", "in japanese", "in chinese",
    "in korean", "in portuguese", "in italian", "in arabic",
    "in hindi", "en español", "en français",
}

_JSON_PATTERNS = [
    r"\bjson\b", r"structured\s*(data|output|format)",
    r"return\s*(as|in)\s*json", r"\{[^}]*:[^}]*\}",
    r"\bschema\b", r"key[\s-]value",
]

_CODE_PATTERNS = [
    r"```", r"def\s+\w+", r"class\s+\w+", r"function\s+\w+",
    r"import\s+\w+", r"from\s+\w+\s+import",
    r"console\.log", r"print\(", r"System\.out",
]

_DOMAIN_MAP = {
    "medical": {"patient", "diagnosis", "treatment", "symptom", "clinical", "drug", "dosage", "medical", "health", "disease"},
    "legal": {"legal", "law", "contract", "court", "plaintiff", "defendant", "statute", "regulation", "compliance", "litigation"},
    "technical": {"server", "database", "network", "architecture", "deployment", "infrastructure", "microservice", "scalability"},
    "financial": {"revenue", "profit", "stock", "investment", "portfolio", "trading", "valuation", "financial", "accounting"},
}

_ALL_TASK_TYPES = (
    "coding", "math", "reasoning", "creative_writing", "summarization",
    "extraction", "translation", "qa", "structured_output", "structured_json",
    "general", "deep_reasoning", "agentic_workflow", "fast_chat",
    "customer_support", "data_extraction", "research_synthesis",
    "long_document_analysis", "image_generation", "image_editing",
    "video_generation", "voice_assistant", "self_hosted_privacy",
    "batch_cost_optimized", "enterprise_automation",
)


def _phrase_hits(lower: str, phrases: tuple[str, ...]) -> int:
    return sum(1 for p in phrases if p in lower)


def _word_count(prompt: str) -> int:
    return len(prompt.split())


def classify_prompt(prompt: str) -> TaskProfile:
    lower = prompt.lower().strip()
    words = set(lower.split())
    wc = _word_count(prompt)

    task_type = _detect_task_type(lower, words, wc)
    requires_json = _check_patterns(lower, _JSON_PATTERNS)
    requires_code = _check_patterns(lower, _CODE_PATTERNS) or task_type == "coding"
    complexity = _estimate_complexity(prompt, task_type)
    expected_length = _estimate_length(prompt, task_type, complexity)
    domain = _detect_domain(lower)
    language = _detect_language(lower)
    token_estimate = _estimate_tokens(prompt, expected_length)
    confidence = _compute_confidence(lower, task_type)

    if requires_json and task_type == "general":
        task_type = "structured_json"

    sub_type = _infer_sub_type(lower, task_type)

    requires_reasoning = _flag_requires_reasoning(task_type, complexity)
    requires_vision = _flag_requires_vision(lower, task_type)
    requires_audio = task_type == "voice_assistant"
    requires_realtime = _flag_requires_realtime(lower, task_type)
    requires_image_gen = task_type == "image_generation"
    requires_web_search = _flag_requires_web_search(lower, task_type)
    requires_tool_use = task_type == "agentic_workflow"
    requires_long_context = _flag_requires_long_context(lower, wc)
    requires_privacy = task_type == "self_hosted_privacy"

    return TaskProfile(
        task_type=task_type,
        sub_type=sub_type,
        complexity=complexity,
        expected_length=expected_length,
        requires_json=requires_json,
        requires_code=requires_code,
        requires_reasoning=requires_reasoning,
        requires_vision=requires_vision,
        requires_audio=requires_audio,
        requires_realtime=requires_realtime,
        requires_image_gen=requires_image_gen,
        requires_web_search=requires_web_search,
        requires_tool_use=requires_tool_use,
        requires_long_context=requires_long_context,
        requires_privacy=requires_privacy,
        language=language,
        domain=domain,
        token_estimate=token_estimate,
        confidence=confidence,
    )


def _detect_task_type(lower: str, words: set[str], wc: int) -> str:
    scores: dict[str, float] = {t: 0.0 for t in _ALL_TASK_TYPES}

    scores["deep_reasoning"] += _phrase_hits(lower, _DEEP_REASONING_PHRASES) * 4
    scores["agentic_workflow"] += _phrase_hits(lower, _AGENTIC_PHRASES) * 4
    scores["image_generation"] += _phrase_hits(lower, _IMAGE_GEN_PHRASES) * 5
    if re.search(r"\bdraw\b", lower):
        scores["image_generation"] += 4
    scores["image_editing"] += _phrase_hits(lower, _IMAGE_EDIT_PHRASES) * 5
    scores["video_generation"] += _phrase_hits(lower, _VIDEO_GEN_PHRASES) * 5
    scores["voice_assistant"] += _phrase_hits(lower, _VOICE_PHRASES) * 4
    scores["self_hosted_privacy"] += _phrase_hits(lower, _PRIVACY_PHRASES) * 4
    scores["batch_cost_optimized"] += _phrase_hits(lower, _BATCH_COST_PHRASES) * 4
    scores["enterprise_automation"] += _phrase_hits(lower, _ENTERPRISE_PHRASES) * 4

    for kw in _RESEARCH_SYNTHESIS_KEYWORDS:
        if kw in lower:
            scores["research_synthesis"] += 3
    for kw in _LONG_DOC_ANALYSIS_KEYWORDS:
        if kw in lower:
            scores["long_document_analysis"] += 3
    if wc > 2000:
        scores["long_document_analysis"] += 2
    for kw in _DATA_EXTRACTION_DOC_KEYWORDS:
        if kw in lower:
            scores["data_extraction"] += 3
    for kw in _CUSTOMER_SUPPORT_KEYWORDS:
        if kw in lower:
            scores["customer_support"] += 3
    for kw in _FAST_CHAT_KEYWORDS:
        if kw in lower:
            scores["fast_chat"] += 2

    for kw in _CODE_KEYWORDS:
        if kw in lower:
            scores["coding"] += 2
    for kw in _MATH_KEYWORDS:
        if kw in lower:
            scores["math"] += 2
    for kw in _REASONING_KEYWORDS:
        if kw in lower:
            scores["reasoning"] += 2
    for kw in _CREATIVE_KEYWORDS:
        if kw in lower:
            scores["creative_writing"] += 2
    for kw in _SUMMARIZATION_KEYWORDS:
        if kw in lower:
            scores["summarization"] += 3
    for kw in _EXTRACTION_KEYWORDS:
        if kw in lower:
            scores["extraction"] += 2
            scores["data_extraction"] += 1
    for kw in _TRANSLATION_KEYWORDS:
        if kw in lower:
            scores["translation"] += 3

    if _check_patterns(lower, _CODE_PATTERNS):
        scores["coding"] += 3
    if _check_patterns(lower, _JSON_PATTERNS):
        scores["structured_json"] += 3
        scores["structured_output"] += 1

    if lower.endswith("?") or lower.startswith((
        "what ", "who ", "when ", "where ", "how ", "why ", "is ", "are ",
        "can ", "does ", "could ", "would ",
    )):
        scores["qa"] += 1.5

    if wc <= 25 and scores["coding"] == 0 and scores["math"] == 0:
        scores["fast_chat"] += 1.5

    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    if scores[best] == 0:
        return "general"
    return best


def _infer_sub_type(lower: str, task_type: str) -> str | None:
    if task_type == "image_generation" and "logo" in lower:
        return "logo"
    if task_type == "deep_reasoning" and any(k in lower for k in ("theorem", "prove", "mathematical proof")):
        return "formal_math"
    if task_type == "agentic_workflow" and "search the web" in lower:
        return "web_browsing"
    if task_type == "data_extraction" and "invoice" in lower:
        return "invoice"
    if task_type == "customer_support" and "refund" in lower:
        return "billing"
    return None


def _flag_requires_reasoning(task_type: str, complexity: str) -> bool:
    if task_type in ("deep_reasoning", "math", "research_synthesis"):
        return True
    if task_type == "coding" and complexity == "complex":
        return True
    return False


def _flag_requires_vision(lower: str, task_type: str) -> bool:
    if task_type in ("image_generation", "image_editing", "video_generation"):
        return True
    return any(k in lower for k in _VISION_KEYWORDS)


def _flag_requires_realtime(lower: str, task_type: str) -> bool:
    if task_type == "voice_assistant":
        return True
    return any(p in lower for p in _REALTIME_EXTRA)


def _flag_requires_web_search(lower: str, task_type: str) -> bool:
    if task_type == "agentic_workflow":
        if any(p in lower for p in ("search the web", "browse", "look up online", "google this")):
            return True
    return _phrase_hits(lower, _WEB_SEARCH_PHRASES) > 0


def _flag_requires_long_context(lower: str, wc: int) -> bool:
    if wc > 2000:
        return True
    return any(p in lower for p in _LONG_CONTEXT_PHRASES)


def _check_patterns(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def _estimate_complexity(prompt: str, task_type: str) -> str:
    length = len(prompt)
    sentences = prompt.count(".") + prompt.count("?") + prompt.count("!")
    has_multi_parts = any(
        marker in prompt.lower()
        for marker in [
            "and also", "additionally", "furthermore", "then",
            "step 1", "first,", "1.", "2.",
        ]
    )

    score = 0
    if length > 1000:
        score += 2
    elif length > 300:
        score += 1
    if sentences > 5:
        score += 1
    if has_multi_parts:
        score += 1
    if task_type in (
        "coding", "math", "reasoning", "deep_reasoning", "agentic_workflow",
        "research_synthesis", "long_document_analysis", "enterprise_automation",
    ):
        score += 1

    if score >= 3:
        return "complex"
    if score >= 1:
        return "moderate"
    return "simple"


def _estimate_length(prompt: str, task_type: str, complexity: str) -> str:
    if task_type in ("creative_writing", "research_synthesis") and complexity == "complex":
        return "long"
    if task_type in ("summarization", "extraction", "data_extraction", "translation"):
        return "medium"
    if complexity == "complex":
        return "long"
    if complexity == "moderate":
        return "medium"
    return "short"


def _detect_domain(lower: str) -> str | None:
    best_domain = None
    best_count = 0
    for domain, keywords in _DOMAIN_MAP.items():
        count = sum(1 for kw in keywords if kw in lower)
        if count > best_count:
            best_count = count
            best_domain = domain
    return best_domain if best_count >= 2 else None


def _detect_language(lower: str) -> str | None:
    lang_map = {
        "python": "python", "javascript": "javascript", "typescript": "typescript",
        "java ": "java", "rust": "rust", "golang": "go", "go ": "go",
        "c++": "cpp", "c#": "csharp", "ruby": "ruby", "php": "php",
        "swift": "swift", "kotlin": "kotlin", "sql": "sql",
    }
    for key, lang in lang_map.items():
        if key in lower:
            return lang
    return None


def _estimate_tokens(prompt: str, expected_length: str) -> int:
    input_tokens = len(prompt.split()) * 1.3
    output_map = {"short": 200, "medium": 600, "long": 1500}
    return int(input_tokens + output_map.get(expected_length, 500))


def _compute_confidence(lower: str, task_type: str) -> float:
    if task_type == "general":
        return 0.5
    score = 0.7
    length = len(lower)
    if length > 50:
        score += 0.1
    if length > 200:
        score += 0.1
    return min(score, 0.95)
