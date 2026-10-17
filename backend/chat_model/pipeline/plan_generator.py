"""7-day quit plan generation via Groq (no local / Kaggle model)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from .groq_client import chat_completion, get_groq_client, parse_json_object

logger = logging.getLogger(__name__)

PLAN_SYSTEM = """You are a clinical smoking-cessation coach for BreathFresh.
Return ONLY valid JSON (no markdown) matching this schema exactly:
{
  "success": true,
  "clinical_reasoning": "short paragraph",
  "motivational_message": "one encouraging sentence",
  "assessment": {
    "struggle_factors": ["..."],
    "success_factors": ["..."],
    "risk_level": "low|moderate|high"
  },
  "week_summary": {
    "baseline_daily_avg": number,
    "target_by_day_7": number,
    "total_reduction_percent": number,
    "projected_quit_date": "YYYY-MM-DD or empty string"
  },
  "financial_milestone": {
    "cigarettes_reduced": number,
    "savings_pkr": number,
    "equivalent_to": "short string"
  },
  "days": [
    {
      "day": 1,
      "cigarette_target": number,
      "craving_window": "e.g. 8-10am",
      "nrt_guidance": null,
      "interventions": [
        {"trigger": "...", "strategy": "...", "rationale": "..."}
      ]
    }
  ]
}
Rules:
- Exactly 7 day objects, day values 1..7
- Gradual reduction unless quit_preference is cold_turkey
- Targets must be integers >= 0 and non-increasing across the week
- Day 1 target near current cigs_per_day; day 7 meaningfully lower
- 2-3 interventions per day
"""


def generate_7day_plan(user_data: Dict[str, Any]) -> Dict[str, Any]:
    if get_groq_client() is None:
        return {
            "success": False,
            "error": "GROQ_API_KEY is not set in backend/chat_model/.env",
        }

    try:
        user_blob = json.dumps(user_data.get("user", user_data), ensure_ascii=False)
        raw = chat_completion(
            [
                {"role": "system", "content": PLAN_SYSTEM},
                {
                    "role": "user",
                    "content": (
                        "Create a personalized 7-day quit plan for this user profile:\n"
                        f"{user_blob}"
                    ),
                },
            ],
            temperature=0.3,
            max_tokens=1800,
        )
        result = parse_json_object(raw)
        result["success"] = True

        days = result.get("days") or []
        if not isinstance(days, list) or len(days) < 7:
            return {
                "success": False,
                "error": "Model returned an incomplete 7-day plan. Please try again.",
                "raw": result,
            }

        normalized_days = []
        for i, day in enumerate(days[:7], start=1):
            if not isinstance(day, dict):
                continue
            raw_interventions = day.get("interventions") or day.get("tasks") or []
            interventions = []
            for item in list(raw_interventions)[:3]:
                if isinstance(item, str):
                    interventions.append(
                        {
                            "trigger": "General",
                            "strategy": item,
                            "rationale": "",
                        }
                    )
                elif isinstance(item, dict):
                    interventions.append(
                        {
                            "trigger": str(item.get("trigger", "General")),
                            "strategy": str(
                                item.get("strategy")
                                or item.get("action")
                                or "Follow your plan"
                            ),
                            "rationale": str(item.get("rationale") or item.get("reason") or ""),
                        }
                    )
            if not interventions:
                interventions = [
                    {
                        "trigger": "General",
                        "strategy": "Use delay, water, and deep breathing for urges",
                        "rationale": "Interrupts the craving cycle",
                    }
                ]
            normalized_days.append(
                {
                    "day": int(day.get("day", i)),
                    "cigarette_target": max(0, int(day.get("cigarette_target", 0))),
                    "craving_window": str(day.get("craving_window") or day.get("peak_craving") or ""),
                    "nrt_guidance": day.get("nrt_guidance", day.get("nrt")),
                    "interventions": interventions,
                }
            )
        result["days"] = normalized_days
        logger.info("Generated 7-day plan via Groq (%s days)", len(normalized_days))
        return result
    except Exception as e:
        logger.error("Plan generation failed: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}
