"""
Tier 1 heuristic classifier — fast, zero-cost, synchronous.

Produces a first-pass classification for every prompt using keyword rules
and structural features. This is intentionally separate from the legacy
`classifier.py` (which drives the /advisor routing engine with a different
taxonomy): the instrumentation layer uses the multi-axis taxonomy from
`taxonomy.py` and writes its output to the `prompt_events` table.

Guarantees:
- Always returns a classification (never raises).
- Every field is valid against `taxonomy.py` or ``None``.
- Confidence is calibrated so that downstream jobs know when to escalate
  to the Haiku classifier for re-labeling.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Optional

from app.core import taxonomy
from app.core.redaction import contains_code, contains_url

HEURISTIC_CLASSIFIER_VERSION = "heuristic-1.0.0"


@dataclass
class HeuristicLabels:
    category_primary: str
    subcategory: str
    intent: str
    goal: str
    domain: str
    output_type: str
    task_structure: str
    reasoning_intensity: int  # 1..5
    creativity_score: int  # 1..5
    precision_requirement: int  # 1..5
    latency_sensitivity: int  # 1..5
    cost_sensitivity: int  # 1..5
    risk_class: str
    complexity_score: int  # 1..10
    ambiguity_score: float  # 0..1
    craft_score: int  # 1..5
    prompt_structure: str
    confidence: float
    classifier_version: str = HEURISTIC_CLASSIFIER_VERSION

    def to_dict(self) -> dict:
        return asdict(self)


# ──────────────────────────────────────────────────────────────────
# Keyword banks
# ──────────────────────────────────────────────────────────────────
_KW = {
    # Coding subcategories
    "sql_query": ("sql", "select ", "from ", " join ", "postgres", "mysql", "sqlite"),
    "debugging": ("bug", "error", "traceback", "exception", "fix this", "why doesn't", "why is my"),
    "code_review": ("review this code", "code review", "lgtm", "pr ", "pull request"),
    "refactoring": ("refactor", "clean up", "restructure", "simplify this"),
    "test_writing": ("unit test", "integration test", "test case", "pytest", "jest"),
    "regex_pattern": ("regex", "regular expression", "\\b", "match pattern"),
    "code_generation": ("write a function", "write code", "implement", "function that", "script that"),
    "code_explanation": ("explain this code", "what does this do", "walk me through"),
    # Writing subcategories
    "blog_post": ("blog post", "blog article", "article about"),
    "email_draft": ("draft an email", "write an email", "email to"),
    "linkedin_post": ("linkedin post", "linkedin update"),
    "tweet_thread": ("tweet", "twitter thread", "x thread"),
    "marketing_copy": ("marketing copy", "product description", "ad copy"),
    "resume_cv": ("resume", "cv ", "curriculum vitae"),
    "cover_letter": ("cover letter",),
    # Analysis
    "summarization": ("summarize", "summary", "tldr", "tl;dr", "key points", "in short"),
    "comparison": ("compare", "vs ", "versus", "difference between", "pros and cons"),
    "literature_review": ("literature review", "related work", "survey of"),
    "fact_check": ("is it true", "fact check", "verify that", "did ", "is this accurate"),
    # Learning
    "eli5": ("eli5", "explain like i'm 5", "explain simply", "in simple terms"),
    "concept_explanation": ("what is", "what are", "explain", "how does", "why does"),
    "tutorial": ("tutorial", "step-by-step guide", "how to", "beginners guide"),
    "interview_prep": ("interview", "interview question", "coding interview"),
    # Brainstorming
    "idea_generation": ("brainstorm", "ideas for", "give me ideas", "come up with"),
    "naming_branding": ("name for", "brand name", "company name", "product name"),
    # Planning
    "roadmap": ("roadmap", "quarterly plan"),
    "goto_market": ("go to market", "gtm", "launch strategy"),
    "project_plan": ("project plan", "plan the project", "milestones"),
    # Transformation
    "translation": ("translate", "in french", "in spanish", "in german", "in japanese", "in chinese"),
    "rewriting": ("rewrite", "rephrase", "paraphrase", "say this differently"),
    "tone_adjustment": ("more formal", "less formal", "more casual", "professional tone"),
    "proofreading": ("proofread", "fix grammar", "grammar check", "spell check"),
    "format_conversion": ("convert to", "as json", "as yaml", "as csv", "as markdown"),
    # Extraction
    "entity_extraction": ("extract", "pull out", "find all", "list all"),
    "json_extraction": ("return json", "output json", "in json format", "json object"),
    "table_extraction": ("table", "rows and columns", "tabular"),
    "classification": ("classify", "categorize", "label these", "is this a"),
    # Decision Support
    "recommendation": ("recommend", "should i", "which should", "best option"),
    "tradeoff_analysis": ("tradeoff", "trade-off", "pros and cons"),
    "risk_assessment": ("risk", "downside", "what could go wrong"),
    # Communication
    "business_email": ("business email", "email to my boss", "email to client"),
    "slack_message": ("slack message", "slack update"),
    "meeting_notes": ("meeting notes", "meeting summary", "action items"),
    "investor_update": ("investor update", "board update", "investor email"),
    # Creative
    "fiction_writing": ("story", "fiction", "short story", "novel", "scene"),
    "poetry": ("poem", "poetry", "haiku", "sonnet"),
    "song_lyrics": ("song", "lyrics", "chorus", "verse for"),
    "roleplay": ("pretend you are", "act as", "roleplay", "role-play"),
    # Chat
    "casual_chat": ("hey", "hi there", "how are you", "just chatting"),
    "emotional_support": ("feel sad", "feel anxious", "lonely", "struggling with"),
    # Data
    "math_problem": ("solve for", "calculate", "compute", "math problem", "equation"),
    "statistics": ("mean", "median", "standard deviation", "p-value", "statistics"),
    "spreadsheet_formula": ("excel formula", "google sheets", "vlookup", "pivot table"),
    # Visual
    "image_prompt_crafting": ("midjourney", "dall-e", "stable diffusion", "image prompt for"),
    "image_description": ("describe this image", "what's in the picture", "caption this"),
    "diagram_spec": ("diagram", "flowchart", "architecture diagram", "mermaid"),
    # Agentic
    "agentic_workflow": ("agent", "automate", "workflow that", "pipeline that"),
    "web_browse_task": ("search the web", "browse the", "look up online"),
    # Meta
    "prompt_engineering": ("better prompt", "prompt engineering", "improve this prompt"),
    "model_comparison": ("which model", "gpt vs", "claude vs", "best model for"),
    "ai_capability_question": ("can you", "are you able", "do you support"),
}

_DOMAIN_KW = {
    "software": ("api", "database", "server", "deployment", "kubernetes", "docker", "devops"),
    "marketing": ("seo", "campaign", "brand", "funnel", "audience", "conversion"),
    "sales": ("lead", "prospect", "quota", "crm", "pipeline", "outreach"),
    "finance": ("revenue", "profit", "ebitda", "valuation", "cash flow", "balance sheet"),
    "legal": ("contract", "clause", "lawsuit", "court", "statute", "gdpr", "compliance"),
    "medical": ("patient", "diagnosis", "symptom", "clinical", "dosage", "icd"),
    "education": ("student", "classroom", "curriculum", "lesson plan", "homework"),
    "research": ("paper", "citation", "peer-reviewed", "hypothesis", "dataset"),
    "hr_recruiting": ("candidate", "hiring", "recruiter", "job description", "onboarding"),
    "product": ("roadmap", "user story", "sprint", "backlog", "prd"),
    "design": ("figma", "wireframe", "ui", "ux", "typography", "design system"),
    "ecommerce": ("shopify", "checkout", "cart", "sku", "product listing"),
    "gaming": ("game mechanic", "npc", "level design", "unity", "unreal"),
    "real_estate": ("listing", "tenant", "lease", "mortgage", "property"),
    "government": ("policy", "regulation", "public sector", "municipal"),
    "personal": ("my friend", "my partner", "birthday", "personal"),
    "cooking": ("recipe", "ingredient", "cook", "bake", "meal prep"),
    "fitness": ("workout", "gym", "exercise", "reps", "calorie"),
    "parenting": ("my child", "my kid", "baby", "toddler", "parenting"),
    "travel": ("itinerary", "trip", "flight", "hotel", "vacation"),
}

_RISK_KW = {
    "health_sensitive": ("medical", "diagnosis", "symptom", "medication", "dosage", "mental health"),
    "legal_sensitive": ("legal advice", "lawsuit", "contract dispute", "court"),
    "financial_sensitive": ("investment", "tax advice", "portfolio", "trading"),
    "privacy_sensitive": ("my address", "my phone number", "my ssn", "private data"),
    "safety_sensitive": ("suicide", "self-harm", "weapon"),
    "minor_involved": ("my child", "my kid", "my toddler", "my baby"),
}

_AGENTIC_CUES = ("agent", "automate", "multi-step", "pipeline", "workflow that")
_REASONING_CUES = ("prove", "derive", "step by step", "chain of thought", "rigorous")
_CREATIVE_CUES = ("creative", "imaginative", "story", "poem", "fiction", "metaphor")
_PRECISION_CUES = ("exact", "precisely", "verbatim", "strict", "literal", "unambiguous")
_LATENCY_CUES = ("quickly", "fast", "asap", "real-time", "urgent")
_COST_CUES = ("cheap", "low cost", "minimize cost", "budget", "free tier")


# ──────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────
def classify(text: str) -> HeuristicLabels:
    """Classify `text` into the multi-axis taxonomy.

    Always returns a :class:`HeuristicLabels`. Never raises. Confidence
    reflects how strong the rule-based match was; downstream enrichment
    jobs use this to decide whether to re-classify with an LLM.
    """
    raw = text or ""
    lower = raw.lower().strip()
    word_count = len(lower.split())

    subcategory, sub_hits = _score_subcategories(lower)
    category_primary = taxonomy.rollup(subcategory)

    output_type = _guess_output_type(lower, subcategory)
    task_structure = _guess_task_structure(subcategory, category_primary, lower)
    intent = _guess_intent(subcategory, lower)
    goal = _guess_goal(subcategory, lower)
    domain = _guess_domain(lower)
    risk_class = _guess_risk(lower)

    reasoning_intensity = _guess_reasoning_intensity(lower, category_primary, subcategory)
    creativity_score = _guess_creativity(lower, category_primary)
    precision_requirement = _guess_precision(lower, output_type, subcategory)
    latency_sensitivity = _guess_latency(lower)
    cost_sensitivity = _guess_cost(lower)

    complexity_score = _guess_complexity(lower, word_count, category_primary)
    ambiguity_score = _guess_ambiguity(lower, sub_hits)
    craft_score = _guess_craft(raw, word_count)
    prompt_structure = _guess_structure(lower)

    confidence = _calibrate_confidence(sub_hits, word_count, category_primary)

    return HeuristicLabels(
        category_primary=category_primary,
        subcategory=subcategory,
        intent=intent,
        goal=goal,
        domain=domain,
        output_type=output_type,
        task_structure=task_structure,
        reasoning_intensity=reasoning_intensity,
        creativity_score=creativity_score,
        precision_requirement=precision_requirement,
        latency_sensitivity=latency_sensitivity,
        cost_sensitivity=cost_sensitivity,
        risk_class=risk_class,
        complexity_score=complexity_score,
        ambiguity_score=ambiguity_score,
        craft_score=craft_score,
        prompt_structure=prompt_structure,
        confidence=confidence,
    )


# ──────────────────────────────────────────────────────────────────
# Internals
# ──────────────────────────────────────────────────────────────────
def _score_subcategories(lower: str) -> tuple[str, int]:
    # Weighted score: each matched keyword contributes by its character
    # length so rare multi-word phrases ("write a function") outrank
    # single-word generic tokens ("mean"). Hit count is still returned
    # for ambiguity calibration.
    weighted: dict[str, float] = {}
    hits: dict[str, int] = {}
    for sub, keywords in _KW.items():
        total = 0.0
        n = 0
        for kw in keywords:
            if kw in lower:
                total += max(1.0, len(kw) * 0.3)
                n += 1
        if n:
            weighted[sub] = total
            hits[sub] = n

    if not weighted:
        if contains_code(lower):
            return "code_generation", 1
        if lower.endswith("?") or lower.startswith(
            ("what ", "who ", "when ", "where ", "how ", "why ", "is ", "are ", "can ")
        ):
            return "concept_explanation", 1
        return "unclassified", 0

    best_sub = max(weighted.items(), key=lambda kv: kv[1])[0]
    return best_sub, hits[best_sub]


def _guess_output_type(lower: str, subcategory: str) -> str:
    if "json" in lower or "as json" in lower:
        return "json"
    if "yaml" in lower:
        return "yaml"
    if "table" in lower or "rows and columns" in lower:
        return "table"
    if "bullet" in lower or "list of" in lower:
        return "bullet_list"
    if "step by step" in lower or "steps to" in lower:
        return "numbered_steps"
    if "outline" in lower:
        return "outline"
    if subcategory in {
        "code_generation", "sql_query", "regex_pattern", "test_writing",
        "devops_script", "spreadsheet_formula",
    }:
        return "code_block"
    if subcategory in {"email_draft", "business_email", "cover_letter"}:
        return "email_draft"
    if subcategory == "translation":
        return "translation"
    if subcategory in {"rewriting", "tone_adjustment", "proofreading"}:
        return "rewrite"
    if subcategory == "comparison":
        return "comparison_matrix"
    if subcategory in {"recommendation", "tradeoff_analysis", "risk_assessment"}:
        return "decision_recommendation"
    if subcategory in {"entity_extraction", "json_extraction", "table_extraction"}:
        return "extracted_fields"
    if subcategory == "classification":
        return "classification_label"
    if subcategory == "image_prompt_crafting":
        return "image_prompt"
    if subcategory == "diagram_spec":
        return "diagram_spec"
    if subcategory == "math_problem":
        return "math_answer"
    if subcategory == "casual_chat":
        return "conversation_turn"
    return "prose"


def _guess_task_structure(subcategory: str, category: str, lower: str) -> str:
    if subcategory in {"entity_extraction", "json_extraction", "table_extraction"}:
        return "extract"
    if subcategory == "classification":
        return "classify"
    if subcategory in {"translation", "rewriting", "tone_adjustment", "proofreading", "format_conversion"}:
        return "transform"
    if subcategory in {"comparison", "tradeoff_analysis", "risk_assessment", "recommendation"}:
        return "reason"
    if subcategory in {"roadmap", "goto_market", "project_plan", "hiring_plan", "personal_planning", "multi_step_plan"}:
        return "plan"
    if subcategory == "code_review":
        return "critique"
    if subcategory in {"agentic_workflow", "web_browse_task"}:
        return "compose"
    if subcategory == "fact_check":
        return "retrieve"
    if any(cue in lower for cue in _AGENTIC_CUES):
        return "compose"
    if category in {
        "writing_content", "creative_narrative", "communication_drafting",
        "brainstorming_ideation", "visual_description",
    }:
        return "generate"
    return "generate"


def _guess_intent(subcategory: str, lower: str) -> str:
    if subcategory in {"debugging", "fix_problem"}:
        return "fix_problem"
    if subcategory in {"recommendation", "tradeoff_analysis"}:
        return "make_choice"
    if subcategory in {"concept_explanation", "eli5", "tutorial"}:
        return "understand_concept"
    if subcategory in {"fact_check"}:
        return "verify_information"
    if subcategory in {"casual_chat", "emotional_support", "venting"}:
        return "vent_or_chat"
    if subcategory in {"fiction_writing", "poetry", "song_lyrics", "roleplay", "worldbuilding"}:
        return "explore_creative"
    if subcategory in {"agentic_workflow", "web_browse_task", "multi_step_plan"}:
        return "delegate_task"
    if subcategory in {"interview_prep", "study_help"}:
        return "practice_skill"
    if "what do you think" in lower or "your opinion" in lower:
        return "get_opinion"
    return "produce_artifact"


def _guess_goal(subcategory: str, lower: str) -> str:
    if subcategory in {"concept_explanation", "eli5", "tutorial", "study_help"}:
        return "learn"
    if subcategory in {"recommendation", "tradeoff_analysis", "risk_assessment"}:
        return "decide"
    if subcategory in {"debugging", "refactoring"}:
        return "get_unstuck"
    if subcategory in {"casual_chat", "roleplay"}:
        return "entertain"
    if subcategory in {"idea_generation", "naming_branding", "product_ideation"}:
        return "explore_options"
    if subcategory in {"translation", "format_conversion", "rewriting"}:
        return "translate_understanding"
    if subcategory == "summarization":
        return "compress_information"
    if subcategory in {"agentic_workflow", "web_browse_task"}:
        return "automate"
    if "quickly" in lower or "asap" in lower or "fast" in lower:
        return "save_time"
    return "produce_deliverable"


def _guess_domain(lower: str) -> str:
    best = ("unknown", 0)
    for d, keywords in _DOMAIN_KW.items():
        hits = sum(1 for kw in keywords if kw in lower)
        if hits > best[1]:
            best = (d, hits)
    return best[0]


def _guess_risk(lower: str) -> str:
    for risk, keywords in _RISK_KW.items():
        if any(kw in lower for kw in keywords):
            return risk
    return "unrestricted"


def _guess_reasoning_intensity(lower: str, category: str, subcategory: str) -> int:
    score = 2
    if any(cue in lower for cue in _REASONING_CUES):
        score += 2
    if subcategory in {"debugging", "architecture_design", "refactoring", "literature_review", "tradeoff_analysis"}:
        score += 1
    if subcategory in {"math_problem", "statistics"}:
        score += 2
    if category in {"coding_engineering", "analysis_research"}:
        score += 1
    return max(1, min(5, score))


def _guess_creativity(lower: str, category: str) -> int:
    score = 2
    if any(cue in lower for cue in _CREATIVE_CUES):
        score += 2
    if category in {"creative_narrative", "brainstorming_ideation", "visual_description"}:
        score += 2
    if category in {"extraction_structuring", "data_calculation", "coding_engineering"}:
        score -= 1
    return max(1, min(5, score))


def _guess_precision(lower: str, output_type: str, subcategory: str) -> int:
    score = 2
    if any(cue in lower for cue in _PRECISION_CUES):
        score += 2
    if output_type in {"json", "yaml", "code_block", "extracted_fields", "classification_label"}:
        score += 2
    if subcategory in {"math_problem", "fact_check", "sql_query", "test_writing"}:
        score += 1
    return max(1, min(5, score))


def _guess_latency(lower: str) -> int:
    score = 2
    if any(cue in lower for cue in _LATENCY_CUES):
        score += 2
    if "real-time" in lower or "realtime" in lower:
        score += 1
    return max(1, min(5, score))


def _guess_cost(lower: str) -> int:
    score = 2
    if any(cue in lower for cue in _COST_CUES):
        score += 2
    return max(1, min(5, score))


def _guess_complexity(lower: str, word_count: int, category: str) -> int:
    score = 2
    if word_count > 400:
        score += 3
    elif word_count > 200:
        score += 2
    elif word_count > 80:
        score += 1
    if category in {"coding_engineering", "analysis_research", "planning_strategy"}:
        score += 1
    if "and also" in lower or "additionally" in lower or "furthermore" in lower:
        score += 1
    if lower.count(".") + lower.count("?") + lower.count("!") > 6:
        score += 1
    return max(1, min(10, score))


def _guess_ambiguity(lower: str, hits: int) -> float:
    if hits >= 3:
        return 0.1
    if hits == 2:
        return 0.25
    if hits == 1:
        return 0.45
    if len(lower.split()) < 6:
        return 0.85
    return 0.65


def _guess_craft(raw: str, word_count: int) -> int:
    score = 2
    if word_count >= 30:
        score += 1
    if word_count >= 100:
        score += 1
    if re.search(r"```|##|^- |^\d+\.", raw, re.MULTILINE):
        score += 1
    if "for example" in raw.lower() or "e.g." in raw.lower():
        score += 1
    return max(1, min(5, score))


def _guess_structure(lower: str) -> str:
    if lower.endswith("?") or lower.startswith(
        ("what ", "who ", "when ", "where ", "how ", "why ", "is ", "are ", "can ", "does ", "could ", "would ")
    ):
        return "question"
    if re.match(r"^(write|create|make|build|generate|draft|design|implement|fix|refactor|translate|summarize)\b", lower):
        return "command"
    if "```" in lower or lower.count("\n") >= 4:
        return "specification"
    if len(lower.split()) < 12:
        return "conversation"
    return "specification"


def _calibrate_confidence(sub_hits: int, word_count: int, category: str) -> float:
    if sub_hits == 0:
        return 0.35
    base = 0.55 + 0.1 * min(sub_hits, 4)
    if word_count >= 30:
        base += 0.05
    if word_count >= 100:
        base += 0.05
    if category == "meta_ai":
        base -= 0.1
    return max(0.1, min(0.95, base))


# Re-export contains_code/contains_url for callers that enrich events with
# structural features from the same module.
__all__ = (
    "HeuristicLabels",
    "HEURISTIC_CLASSIFIER_VERSION",
    "classify",
    "contains_code",
    "contains_url",
)
