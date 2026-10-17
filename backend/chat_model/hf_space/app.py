"""
BreathFresh — 7-Day Quit Plan Generator API (GGUF / CPU)

Runs on HuggingFace Spaces FREE CPU tier (16GB RAM).
Uses llama-cpp-python to load the GGUF quantized model.
"""

import os
import json
import gradio as gr
from llama_cpp import Llama
from huggingface_hub import hf_hub_download

# ============================================================================
# Configuration
# ============================================================================
GGUF_REPO = "alyyjaved70/plan-quit-smoking-gguf"
GGUF_FILE = "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf"

SYSTEM_PROMPT = (
    "You are a clinical smoking cessation specialist AI. "
    "Given a user's smoking profile (baseline stats, last week's performance, craving logs, and quit preference), "
    "generate a personalized 7-day quit plan. "
    "You MUST respond with valid JSON only — no markdown, no extra text. "
    'The JSON must have these keys: '
    '"7_day_plan" (array of 7 objects, each with: "day", "cigarette_target", "key_interventions" (array of strings), "motivational_message"), '
    '"alternative_suggestions" (array of strings), '
    '"assessment" (string), '
    '"clinical_reasoning" (string), '
    '"financial_milestone" (string with PKR amount).'
)

# ============================================================================
# Download & Load Model
# ============================================================================
print(f"Downloading GGUF model from {GGUF_REPO}...")
model_path = hf_hub_download(
    repo_id=GGUF_REPO,
    filename=GGUF_FILE,
)
print(f"Model downloaded to: {model_path}")

print("Loading model into llama.cpp (this takes ~30-60 seconds)...")
llm = Llama(
    model_path=model_path,
    n_ctx=4096,        # Context window
    n_threads=2,       # Free tier has 2 vCPUs
    n_gpu_layers=0,    # CPU only (no GPU on free tier)
    verbose=False,
)
print("Model loaded and ready!")


def parse_json_output(raw_text: str) -> dict:
    """Extract JSON from model output."""
    cleaned = raw_text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

    brace_start = cleaned.find("{")
    if brace_start == -1:
        return {"error": "No JSON found in output", "raw": raw_text, "success": False}

    depth = 0
    brace_end = -1
    for i in range(brace_start, len(cleaned)):
        if cleaned[i] == "{":
            depth += 1
        elif cleaned[i] == "}":
            depth -= 1
            if depth == 0:
                brace_end = i
                break

    if brace_end == -1:
        return {"error": "Incomplete JSON in output", "raw": raw_text, "success": False}

    try:
        result = json.loads(cleaned[brace_start:brace_end + 1])
        result["success"] = True
        return result
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "raw": raw_text, "success": False}


def generate_plan(user_data_json: str) -> str:
    """Generate a 7-day quit smoking plan from user data JSON."""
    # Validate input
    try:
        json.loads(user_data_json)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid input JSON: {e}", "success": False})

    # Build LLaMA 3.1 Instruct prompt
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_data_json},
    ]

    try:
        response = llm.create_chat_completion(
            messages=messages,
            max_tokens=2048,
            temperature=0.7,
            repeat_penalty=1.1,
        )

        raw_output = response["choices"][0]["message"]["content"]
        result = parse_json_output(raw_output)
        return json.dumps(result, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": str(e), "success": False})


# ============================================================================
# Gradio Interface
# ============================================================================
example_input = json.dumps({
    "user": {
        "baseline": {
            "cigs_per_day": 20,
            "years_smoked": 5,
            "motivation": 8,
            "pack_cost": 450
        },
        "last_week_target": 15,
        "last_week_actual": 18,
        "craving_logs": [
            {"intensity": 7, "trigger": "Morning Tea", "notes": "Strong urge after waking."}
        ],
        "quit_preference": "gradual"
    }
}, indent=2)

demo = gr.Interface(
    fn=generate_plan,
    inputs=gr.Textbox(
        label="User Data (JSON)",
        placeholder="Paste user smoking profile JSON here...",
        lines=15,
        value=example_input,
    ),
    outputs=gr.Textbox(label="Generated Plan (JSON)", lines=20),
    title="BreathFresh — 7-Day Quit Plan Generator",
    description=(
        "Paste a user's smoking profile in JSON format. "
        "The fine-tuned LLaMA 3.1 8B model will generate a personalized 7-day quit plan. "
        "First request may take 1-2 minutes (CPU inference)."
    ),
    allow_flagging="never",
)

demo.launch()
