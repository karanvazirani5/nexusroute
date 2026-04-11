"""
Synchronous PII redaction pipeline.

Runs before any prompt hits long-term storage. Tier 0 consent only ever
stores the redacted version; the raw prompt is discarded unless the user
has explicitly granted Tier 1 research contribution.

Principles:
- Never "redact later". Redact before storage or the prompt never lands in
  a persistent table.
- Preserve structural properties (length, code presence, numeric shape) so
  classifiers can still learn from the redacted text.
- Prefer obvious false positives to obvious false negatives — the cost of
  leaking PII is categorically worse than the cost of over-redacting.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

REDACTION_VERSION = "1.0.0"

# Order matters: run the most specific regexes first so an email isn't
# partially munched by a looser pattern.
_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = (
    # Credentials and tokens ------------------------------------------------
    (
        "api_key",
        re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b"),
        "[REDACTED_API_KEY]",
    ),
    (
        "api_key",
        re.compile(r"\b(?:xox[baprs]-|ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_\-]{20,}\b"),
        "[REDACTED_API_KEY]",
    ),
    (
        "aws_key",
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        "[REDACTED_AWS_KEY]",
    ),
    (
        "jwt",
        re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
        "[REDACTED_JWT]",
    ),
    (
        "bearer",
        re.compile(r"(?i)\bBearer\s+[A-Za-z0-9_\-\.=]{12,}\b"),
        "Bearer [REDACTED_TOKEN]",
    ),
    # Financial identifiers -------------------------------------------------
    (
        "credit_card",
        re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
        "[REDACTED_CC]",
    ),
    (
        "iban",
        re.compile(r"\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}\b"),
        "[REDACTED_IBAN]",
    ),
    (
        "routing_number",
        re.compile(r"\brouting[:\s#]*\d{9}\b", re.IGNORECASE),
        "routing: [REDACTED]",
    ),
    # Identity --------------------------------------------------------------
    (
        "ssn",
        re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "[REDACTED_SSN]",
    ),
    (
        "passport",
        re.compile(r"\b[A-PR-WYa-pr-wy][0-9]{7}\b"),
        "[REDACTED_PASSPORT]",
    ),
    # Contact info ----------------------------------------------------------
    (
        "email",
        re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
        "[REDACTED_EMAIL]",
    ),
    (
        "phone",
        re.compile(
            r"(?:(?:\+?\d{1,3}[\s.\-])?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})\b"
        ),
        "[REDACTED_PHONE]",
    ),
    # URLs (preserved with domain stripped of query/path) ------------------
    (
        "url",
        re.compile(r"https?://[^\s<>\"]+", re.IGNORECASE),
        "[REDACTED_URL]",
    ),
    # IPs -------------------------------------------------------------------
    (
        "ipv4",
        re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
        "[REDACTED_IP]",
    ),
)


# Words that commonly precede a person's full name. When we see them, we're
# more aggressive about lowering confidence on a nearby capitalized token.
_NAME_CUES = re.compile(
    r"(?i)\b(?:my name is|i am|i'm|signed|regards|sincerely|from|to|hi|hello|dear)\s+"
    r"([A-Z][a-zA-Z]{1,20}(?:\s+[A-Z][a-zA-Z]{1,20}){0,2})"
)


@dataclass
class RedactionResult:
    redacted_text: str
    prompt_hash: str
    redaction_counts: dict[str, int]
    redaction_version: str = REDACTION_VERSION

    @property
    def any_redaction(self) -> bool:
        return sum(self.redaction_counts.values()) > 0


def redact(text: str) -> RedactionResult:
    """Run the redaction pipeline on `text`.

    Returns a :class:`RedactionResult` containing the safe-to-store string,
    a sha256 hash of the *original* prompt (stable across redaction version
    bumps), and per-pattern counts for observability.
    """
    if not text:
        return RedactionResult(
            redacted_text="",
            prompt_hash=hashlib.sha256(b"").hexdigest(),
            redaction_counts={},
        )

    original_hash = hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()
    counts: dict[str, int] = {}
    redacted = text

    for name, pattern, replacement in _PATTERNS:
        new_text, n = pattern.subn(replacement, redacted)
        if n:
            counts[name] = counts.get(name, 0) + n
            redacted = new_text

    # Name cue replacement is softer: only the captured name group is
    # redacted, the surrounding cue is kept so the classifier still sees
    # "my name is [REDACTED_NAME]".
    def _name_sub(m: re.Match[str]) -> str:
        counts["name"] = counts.get("name", 0) + 1
        return m.group(0).replace(m.group(1), "[REDACTED_NAME]")

    redacted = _NAME_CUES.sub(_name_sub, redacted)

    return RedactionResult(
        redacted_text=redacted,
        prompt_hash=original_hash,
        redaction_counts=counts,
    )


def contains_code(text: str) -> bool:
    """Heuristic: does the text look like it contains code?"""
    if "```" in text:
        return True
    code_markers = (
        r"\bdef\s+\w+\(",
        r"\bclass\s+\w+",
        r"\bfunction\s+\w+\(",
        r"\bimport\s+[\w\.]+",
        r"\bfrom\s+[\w\.]+\s+import",
        r"=>\s*\{",
        r"console\.log\(",
        r"System\.out\.",
        r"#include\s*<",
        r"public\s+(?:static\s+)?(?:void|class)",
    )
    return any(re.search(p, text) for p in code_markers)


def contains_url(text: str) -> bool:
    return bool(re.search(r"https?://", text, re.IGNORECASE))
