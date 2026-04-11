"""
Intent Panel Taxonomy — v1.0.0

Multi-axis taxonomy for classifying prompts in the instrumentation layer.
Orthogonal axes let one prompt belong to multiple useful dimensions at once.

Every classifier output tags the taxonomy version so historical events can be
correctly aggregated even as the taxonomy evolves. Labels are additive-only:
splits happen by introducing new labels and deprecating old ones, never by
mutating an existing label in place.
"""

from __future__ import annotations

TAXONOMY_VERSION = "1.0.0"

# ──────────────────────────────────────────────────────────────────
# Axis A — Task Category (primary). One of 16.
# ──────────────────────────────────────────────────────────────────
CATEGORY_PRIMARY = (
    "writing_content",
    "coding_engineering",
    "analysis_research",
    "learning_explanation",
    "brainstorming_ideation",
    "planning_strategy",
    "transformation_reformatting",
    "extraction_structuring",
    "decision_support",
    "communication_drafting",
    "creative_narrative",
    "conversational_companion",
    "data_calculation",
    "visual_description",
    "tools_agents",
    "meta_ai",
)

# Readable labels for dashboards and public reports.
CATEGORY_PRIMARY_LABELS = {
    "writing_content": "Writing & Content",
    "coding_engineering": "Coding & Engineering",
    "analysis_research": "Analysis & Research",
    "learning_explanation": "Learning & Explanation",
    "brainstorming_ideation": "Brainstorming & Ideation",
    "planning_strategy": "Planning & Strategy",
    "transformation_reformatting": "Transformation & Reformatting",
    "extraction_structuring": "Extraction & Structuring",
    "decision_support": "Decision Support",
    "communication_drafting": "Communication Drafting",
    "creative_narrative": "Creative & Narrative",
    "conversational_companion": "Conversational & Companion",
    "data_calculation": "Data & Calculation",
    "visual_description": "Visual Description & Gen Prep",
    "tools_agents": "Tools & Agents",
    "meta_ai": "Meta-AI",
}

# ──────────────────────────────────────────────────────────────────
# Axis B — Task Subcategory. Rollup-able to Axis A via SUBCATEGORY_PARENT.
# ──────────────────────────────────────────────────────────────────
SUBCATEGORY_PARENT = {
    # Writing & Content
    "blog_post": "writing_content",
    "email_draft": "writing_content",
    "linkedin_post": "writing_content",
    "tweet_thread": "writing_content",
    "marketing_copy": "writing_content",
    "press_release": "writing_content",
    "script_writing": "writing_content",
    "newsletter": "writing_content",
    "ad_copy": "writing_content",
    "landing_page": "writing_content",
    "resume_cv": "writing_content",
    "cover_letter": "writing_content",
    # Coding & Engineering
    "code_generation": "coding_engineering",
    "code_review": "coding_engineering",
    "debugging": "coding_engineering",
    "refactoring": "coding_engineering",
    "test_writing": "coding_engineering",
    "architecture_design": "coding_engineering",
    "sql_query": "coding_engineering",
    "regex_pattern": "coding_engineering",
    "devops_script": "coding_engineering",
    "code_explanation": "coding_engineering",
    "code_migration": "coding_engineering",
    "documentation_writing": "coding_engineering",
    # Analysis & Research
    "summarization": "analysis_research",
    "comparison": "analysis_research",
    "literature_review": "analysis_research",
    "fact_check": "analysis_research",
    "competitive_analysis": "analysis_research",
    "financial_analysis": "analysis_research",
    "legal_research": "analysis_research",
    "market_research": "analysis_research",
    # Learning & Explanation
    "concept_explanation": "learning_explanation",
    "tutorial": "learning_explanation",
    "eli5": "learning_explanation",
    "study_help": "learning_explanation",
    "interview_prep": "learning_explanation",
    # Brainstorming & Ideation
    "idea_generation": "brainstorming_ideation",
    "naming_branding": "brainstorming_ideation",
    "product_ideation": "brainstorming_ideation",
    # Planning & Strategy
    "product_strategy": "planning_strategy",
    "roadmap": "planning_strategy",
    "goto_market": "planning_strategy",
    "hiring_plan": "planning_strategy",
    "project_plan": "planning_strategy",
    "personal_planning": "planning_strategy",
    # Transformation & Reformatting
    "translation": "transformation_reformatting",
    "rewriting": "transformation_reformatting",
    "tone_adjustment": "transformation_reformatting",
    "format_conversion": "transformation_reformatting",
    "proofreading": "transformation_reformatting",
    # Extraction & Structuring
    "entity_extraction": "extraction_structuring",
    "json_extraction": "extraction_structuring",
    "table_extraction": "extraction_structuring",
    "classification": "extraction_structuring",
    # Decision Support
    "recommendation": "decision_support",
    "tradeoff_analysis": "decision_support",
    "risk_assessment": "decision_support",
    # Communication Drafting
    "business_email": "communication_drafting",
    "slack_message": "communication_drafting",
    "meeting_notes": "communication_drafting",
    "investor_update": "communication_drafting",
    # Creative & Narrative
    "fiction_writing": "creative_narrative",
    "poetry": "creative_narrative",
    "song_lyrics": "creative_narrative",
    "worldbuilding": "creative_narrative",
    "roleplay": "creative_narrative",
    # Conversational & Companion
    "casual_chat": "conversational_companion",
    "emotional_support": "conversational_companion",
    "venting": "conversational_companion",
    # Data & Calculation
    "math_problem": "data_calculation",
    "statistics": "data_calculation",
    "spreadsheet_formula": "data_calculation",
    "unit_conversion": "data_calculation",
    # Visual Description & Gen Prep
    "image_prompt_crafting": "visual_description",
    "image_description": "visual_description",
    "diagram_spec": "visual_description",
    # Tools & Agents
    "agentic_workflow": "tools_agents",
    "web_browse_task": "tools_agents",
    "multi_step_plan": "tools_agents",
    # Meta-AI
    "prompt_engineering": "meta_ai",
    "model_comparison": "meta_ai",
    "ai_capability_question": "meta_ai",
    # Fallback
    "unclassified": "meta_ai",
}

SUBCATEGORY = tuple(SUBCATEGORY_PARENT.keys())

# ──────────────────────────────────────────────────────────────────
# Axis C — Output Type.
# ──────────────────────────────────────────────────────────────────
OUTPUT_TYPE = (
    "prose",
    "bullet_list",
    "numbered_steps",
    "table",
    "code_block",
    "json",
    "yaml",
    "markdown_doc",
    "email_draft",
    "diagram_spec",
    "outline",
    "classification_label",
    "extracted_fields",
    "decision_recommendation",
    "comparison_matrix",
    "translation",
    "rewrite",
    "conversation_turn",
    "image_prompt",
    "math_answer",
)

# ──────────────────────────────────────────────────────────────────
# Axis D — Task Structure (the computational shape).
# ──────────────────────────────────────────────────────────────────
TASK_STRUCTURE = (
    "generate",
    "transform",
    "extract",
    "classify",
    "reason",
    "plan",
    "critique",
    "simulate",
    "retrieve",
    "compose",  # multi-step
)

# ──────────────────────────────────────────────────────────────────
# Axis G — Domain / Industry (30 values).
# ──────────────────────────────────────────────────────────────────
DOMAIN = (
    "software",
    "marketing",
    "sales",
    "finance",
    "legal",
    "medical",
    "education",
    "research",
    "hr_recruiting",
    "operations",
    "product",
    "design",
    "customer_support",
    "ecommerce",
    "media",
    "gaming",
    "real_estate",
    "nonprofit",
    "government",
    "manufacturing",
    "logistics",
    "hospitality",
    "personal",
    "creative_arts",
    "music",
    "fitness",
    "cooking",
    "parenting",
    "travel",
    "unknown",
)

# ──────────────────────────────────────────────────────────────────
# Axis H — User Goal.
# ──────────────────────────────────────────────────────────────────
GOAL = (
    "learn",
    "decide",
    "produce_deliverable",
    "explore_options",
    "save_time",
    "automate",
    "get_unstuck",
    "validate_idea",
    "entertain",
    "practice",
    "translate_understanding",
    "compress_information",
    "expand_information",
    "generate_variants",
)

# ──────────────────────────────────────────────────────────────────
# Axis K — Risk & Compliance Class.
# ──────────────────────────────────────────────────────────────────
RISK_CLASS = (
    "unrestricted",
    "reputational",
    "privacy_sensitive",
    "financial_sensitive",
    "health_sensitive",
    "legal_sensitive",
    "safety_sensitive",
    "minor_involved",
    "restricted_jurisdiction",
)

# ──────────────────────────────────────────────────────────────────
# Axis L — Intent Label (finer-grained than goal, aligned with job-to-be-done)
# ──────────────────────────────────────────────────────────────────
INTENT = (
    "produce_artifact",
    "understand_concept",
    "fix_problem",
    "make_choice",
    "get_opinion",
    "vent_or_chat",
    "delegate_task",
    "explore_creative",
    "verify_information",
    "practice_skill",
)

# ──────────────────────────────────────────────────────────────────
# Prompt structure labels (from structural heuristics).
# ──────────────────────────────────────────────────────────────────
PROMPT_STRUCTURE = (
    "question",
    "command",
    "specification",
    "conversation",
    "template",
)

# ──────────────────────────────────────────────────────────────────
# Taxonomy validation helpers.
# ──────────────────────────────────────────────────────────────────
_ALL_ENUMS = {
    "category_primary": set(CATEGORY_PRIMARY),
    "subcategory": set(SUBCATEGORY),
    "output_type": set(OUTPUT_TYPE),
    "task_structure": set(TASK_STRUCTURE),
    "domain": set(DOMAIN),
    "goal": set(GOAL),
    "risk_class": set(RISK_CLASS),
    "intent": set(INTENT),
    "prompt_structure": set(PROMPT_STRUCTURE),
}


def is_valid(axis: str, value: str) -> bool:
    """Return True if `value` is a known label on `axis`."""
    return value in _ALL_ENUMS.get(axis, set())


def rollup(subcategory: str) -> str:
    """Map a subcategory to its parent primary category.

    Unknown subcategories roll up to ``unclassified`` → ``meta_ai`` to keep
    the unclassified cell observable as a leading indicator of emerging
    categories.
    """
    return SUBCATEGORY_PARENT.get(subcategory, "meta_ai")


def all_categories_with_labels() -> list[dict]:
    """Serialize the primary category list for dashboards and dropdowns."""
    return [
        {"id": c, "label": CATEGORY_PRIMARY_LABELS[c]}
        for c in CATEGORY_PRIMARY
    ]
