"""
Email Subject Triage AI - FastAPI Backend
Uses OpenAI Responses API for email categorization.
"""

import os
import re
import time
import json
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

import openai

# ---------------------------------------------------------------------------
# App & Middleware
# ---------------------------------------------------------------------------
app = FastAPI(title="Email Triage AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# OpenAI Client
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client = openai.OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# ---------------------------------------------------------------------------
# Rate Limiter
# ---------------------------------------------------------------------------
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 8
_rate_store: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(ip: str) -> bool:
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_store[ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_store[ip].append(now)
    return True


# ---------------------------------------------------------------------------
# Input Model
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    subjects: list[str] = Field(..., min_length=1, max_length=2000)

    @field_validator("subjects", mode="before")
    @classmethod
    def clean_subjects(cls, v: list) -> list:
        cleaned = []
        for item in v:
            if isinstance(item, str):
                s = item.strip()
                if s:
                    cleaned.append(s[:200])
        if not cleaned:
            raise ValueError("No valid non-empty subjects provided")
        return cleaned


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------
_TAG_RE = re.compile(r"<[^>]+>")


def sanitize(text: str) -> str:
    text = _TAG_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:200]


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a precise email triage assistant.
Categorize email subjects and return a concise structured summary.
Always return only valid JSON, no markdown fences, no extra text."""

def build_user_prompt(subjects: list[str]) -> str:
    count = len(subjects)
    subject_list = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(subjects))
    return f"""You are an inbox triage assistant.

Analyze the following email subject lines.
Group them into sensible categories such as:
Urgent, Work, Newsletters, Notifications, Personal, Finance,
Shopping, Travel, Security, Promotions, Updates, Other.

There are {count} emails.

Subjects:
{subject_list}

Return only valid JSON in this exact format:
{{
  "summary": "A short overview of the inbox in 1-2 sentences",
  "categories": [
    {{
      "name": "CategoryName",
      "subjects": ["Subject 1", "Subject 2"]
    }}
  ]
}}

Rules:
- summary must be a concise 1-2 sentence overview
- categories must be ordered by number of subjects (largest first)
- use only these category names when applicable: Urgent, Work, Newsletters, Notifications, Personal, Finance, Shopping, Travel, Security, Promotions, Updates, Other
- every subject must appear in exactly one category
- subjects within each category should preserve their original text
- return ONLY the JSON object, no markdown fences, no explanation"""


# ---------------------------------------------------------------------------
# OpenAI Call
# ---------------------------------------------------------------------------
def call_openai(subjects: list[str]) -> dict:
    if client is None:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key is not configured. Please set OPENAI_API_KEY.",
        )

    user_prompt = build_user_prompt(subjects)

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_output_tokens=4000,
        )

        # Extract text from response
        output_text = ""
        for item in response.output:
            if item.type == "message":
                for content in item.content:
                    if content.type == "output_text":
                        output_text += content.text

        output_text = output_text.strip()

        # Strip markdown fences if present
        if output_text.startswith("```"):
            lines = output_text.split("\n")
            # Remove first and last lines (fences)
            if lines[-1].strip() == "```":
                lines = lines[1:-1]
            elif lines[0].strip().startswith("```"):
                lines = lines[1:]
            output_text = "\n".join(lines).strip()

        # Parse JSON
        result = json.loads(output_text)

        # Validate structure
        if "summary" not in result or "categories" not in result:
            raise ValueError("Response missing required fields: summary, categories")

        if not isinstance(result["categories"], list):
            raise ValueError("categories must be an array")

        # Clean up categories
        cleaned_categories = []
        for cat in result["categories"]:
            if not isinstance(cat, dict):
                continue
            name = str(cat.get("name", "Other")).strip()
            raw_subjects = cat.get("subjects", [])
            if not isinstance(raw_subjects, list):
                raw_subjects = []
            cleaned_subjects = [str(s).strip() for s in raw_subjects if s]
            if cleaned_subjects:
                cleaned_categories.append({
                    "name": name,
                    "subjects": cleaned_subjects,
                })

        return {
            "summary": str(result["summary"]).strip(),
            "categories": cleaned_categories,
        }

    except openai.AuthenticationError:
        raise HTTPException(
            status_code=500,
            detail="Invalid OpenAI API key. Check your OPENAI_API_KEY environment variable.",
        )
    except openai.RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="OpenAI API rate limit exceeded. Please try again later.",
        )
    except openai.APIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI API error: {str(e)}",
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse AI response as JSON: {str(e)}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Invalid AI response format: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Endpoint: POST /api/analyze
# ---------------------------------------------------------------------------
@app.post("/api/analyze")
async def analyze(request: Request, body: AnalyzeRequest):
    # Rate limit
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment before trying again.",
        )

    # Sanitize subjects
    subjects = [sanitize(s) for s in body.subjects]
    subjects = [s for s in subjects if s]

    if not subjects:
        raise HTTPException(status_code=400, detail="No valid subjects provided after sanitization.")

    # Call OpenAI
    result = call_openai(subjects)

    # Add count
    result["count"] = len(subjects)

    return result


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "api_key_configured": bool(OPENAI_API_KEY),
    }


# ---------------------------------------------------------------------------
# Vercel handler
# ---------------------------------------------------------------------------
handler = app
