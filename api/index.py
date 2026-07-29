"""
Email Subject Generator - FastAPI Backend
Uses Groq API for generating email subjects.
"""

import os
import time
import json
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from groq import Groq

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Email Subject Generator API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 10
_rate_store: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(ip: str) -> bool:
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_store[ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_store[ip].append(now)
    return True


class GenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    count: int = Field(default=10, ge=1, le=50)
    tone: str = Field(default="professional")
    length: str = Field(default="medium")
    emoji: bool = Field(default=False)


@app.post("/api/generate")
async def generate(request: Request, body: GenerateRequest):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests.")

    if client is None:
        raise HTTPException(
            status_code=500,
            detail="Groq API key not configured. Set GROQ_API_KEY in Vercel dashboard (Settings > Environment Variables) or in a .env file for local dev.",
        )

    length_desc = {
        "short": "short and concise (2-5 words)",
        "medium": "medium-length (5-10 words)",
        "long": "long and descriptive (10-20 words)",
    }
    emoji_req = "Include relevant emojis in some of the subjects." if body.emoji else "Do not use any emojis."

    prompt = f"""Generate {body.count} email subject lines about "{body.topic}" with a {body.tone} tone.
Each subject should be {length_desc.get(body.length, 'medium-length (5-10 words)')}.
{emoji_req}
Return ONLY a valid JSON array of strings, no markdown fences.
Example format: ["Subject 1", "Subject 2", "Subject 3"]"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an email subject line generator. Return only valid JSON arrays."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        output_text = response.choices[0].message.content.strip()

        if output_text.startswith("```"):
            lines = output_text.split("\n")
            if lines[-1].strip() == "```":
                lines = lines[1:-1]
            elif lines[0].strip().startswith("```"):
                lines = lines[1:]
            output_text = "\n".join(lines).strip()

        subjects = json.loads(output_text)

        if not isinstance(subjects, list):
            raise ValueError("Response is not an array")

        subjects = [str(s).strip() for s in subjects if s]

        return {"subjects": subjects}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Generation error: {str(e)}",
        )


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "api_key_configured": bool(GROQ_API_KEY),
    }


handler = app
