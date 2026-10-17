import os
import json
import logging
import requests
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration — Kaggle + ngrok approach
# ============================================================================
# The model runs on Kaggle's free T4 GPU, tunneled via ngrok.
# Update NGROK_URL in .env every time you restart the Kaggle notebook.
NGROK_URL = os.getenv("NGROK_URL", "")
API_ENDPOINT = f"{NGROK_URL}/api/generate-plan" if NGROK_URL else ""

REQUEST_TIMEOUT = 200  # GPU inference is fast (~10-20s), but allow margin


def _parse_json_output(raw_text: str) -> Dict[str, Any]:
    """Extract the first valid JSON object from raw model output."""
    cleaned = raw_text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

    brace_start = cleaned.find("{")
    if brace_start == -1:
        raise ValueError("No JSON object found in model output")

    depth, brace_end = 0, -1
    for i in range(brace_start, len(cleaned)):
        if cleaned[i] == "{":
            depth += 1
        elif cleaned[i] == "}":
            depth -= 1
            if depth == 0:
                brace_end = i
                break

    if brace_end == -1:
        raise ValueError("Unbalanced JSON braces")

    return json.loads(cleaned[brace_start : brace_end + 1])


def generate_7day_plan(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calls the Kaggle-hosted model API to generate a personalized 7-day quit plan.

    Expected user_data format:
    {
        "user": {
            "baseline": {
                "cigs_per_day": int,
                "years_smoked": int,
                "motivation": int,
                "pack_cost": float
            },
            "last_week_target": int,
            "last_week_actual": int,
            "craving_logs": [
                {"intensity": int, "trigger": str, "notes": str},
            ],
            "quit_preference": "gradual" | "cold_turkey"
        }
    }
    """
    if not NGROK_URL:
        return {
            "error": (
                "NGROK_URL is not set in .env. "
                "Start the Kaggle notebook first, then paste the ngrok URL."
            ),
            "success": False,
        }

    try:
        logger.info(f"Calling Kaggle API at {API_ENDPOINT}")

        response = requests.post(
            API_ENDPOINT,
            json=user_data,
            headers={
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
            },
            timeout=REQUEST_TIMEOUT,
        )

        if response.status_code != 200:
            error_detail = response.text[:500]
            logger.error(f"API returned {response.status_code}: {error_detail}")
            return {
                "error": f"API error ({response.status_code}): {error_detail}",
                "success": False,
            }

        result = response.json()

        # The Kaggle Flask endpoint already returns parsed JSON
        if result.get("success") is False:
            return result

        logger.info("Successfully received 7-day plan from Kaggle.")
        return result

    except requests.exceptions.ConnectionError:
        return {
            "error": (
                f"Cannot connect to {NGROK_URL}. "
                "Make sure the Kaggle notebook is running and the ngrok URL is correct."
            ),
            "success": False,
        }
    except requests.exceptions.Timeout:
        return {
            "error": "Request timed out. The model may still be processing.",
            "success": False,
        }
    except Exception as e:
        logger.error(f"Exception: {e}")
        return {"error": str(e), "success": False}


if __name__ == "__main__":
    import pprint

    test_case = {
        "user": {
            "baseline": {
                "cigs_per_day": 35,
                "years_smoked": 15,
                "motivation": 9,
                "pack_cost": 450,
            },
            "last_week_target": 25,
            "last_week_actual": 30,
            "craving_logs": [
                {"intensity": 9, "trigger": "Morning Tea", "notes": "Strong withdrawal."},
                {"intensity": 8, "trigger": "Work Stress", "notes": "Deadline pressure."},
            ],
            "quit_preference": "gradual",
        }
    }

    result = generate_7day_plan(test_case)
    pprint.pprint(result)
