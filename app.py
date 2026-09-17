"""
app.py — MemeForge AI Backend (Flask)
Upgraded: supports multimodal (images/videos), variable modes (Caption, Comment, Both),
and humor intensity (1-10).
"""

from flask import Flask, request, jsonify, render_template
import requests
import os
import re

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)

# ── API Config ──────────────────────────────────────────
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
# Multimodal model supporting text and vision
MODEL              = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.5-flash")


# ── Routes ──────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    api_key = os.environ.get("OPENROUTER_API_KEY") or OPENROUTER_API_KEY
    if not api_key:
        return jsonify({
            "error": "OPENROUTER_API_KEY is not set. Please add OPENROUTER_API_KEY to your environment or .env file."
        }), 400

    data  = request.get_json() or {}
    topic = data.get("topic", "").strip()
    media_data = data.get("media_data", "") # Base64 string
    media_type = data.get("media_type", "") # e.g. "image/jpeg"
    
    mode = data.get("mode", "Caption").strip()
    try:
        intensity = int(data.get("intensity", 5))
    except (ValueError, TypeError):
        intensity = 5

    count = 3 if mode == "Both" else 5
    
    if not topic and not media_data:
        return jsonify({"error": "Please enter a topic or upload an image!"}), 400

    intensity_desc = {
        1: "Clean, lighthearted, slightly funny, safe for work.",
        2: "Very mild, safe for work, slight chuckle.",
        3: "Playful, light meme energy.",
        4: "Witty, standard internet humor.",
        5: "Genuinely witty, memey, mild sarcasm.",
        6: "Sarcastic, a bit edgy, internet culture.",
        7: "Snarky, roast-adjacent, very memey.",
        8: "Dark humor, roast-style, unhinged.",
        9: "Absurd, chaotic, internet chaos mode.",
        10: "Maximum chaos, dark, highly absurd, absolute roast."
    }.get(intensity, "Genuinely witty, memey, mild sarcasm.")

    # ── Build Prompt ────────────────────────────────────
    if mode == "Both":
        task_desc = f"Generate {count} pairs of (Caption and Comment) together."
        format_rules = "Each pair must be formatted exactly like this:\n1. Caption: [text] | Comment: [text]"
    elif mode == "Comment":
        task_desc = f"Generate {count} funny, relatable reply-style comments."
        format_rules = "Number each comment (1. ... 2. ... etc.)"
    else: # Caption
        task_desc = f"Generate {count} punchy, meme-style captions."
        format_rules = "Number each caption (1. ... 2. ... etc.)"

    prompt_text = f"""You are a professional meme writer and internet culture expert.
{task_desc}

Settings:
- Spiciness Level (1-10): {intensity}/10 ({intensity_desc})
- Topic/Context: {topic if topic else 'Based entirely on the image'}

Rules:
1. {format_rules}
2. Match the Spiciness Level tone precisely.
3. No explanation, just the numbered outputs.
"""

    content = [{"type": "text", "text": prompt_text}]

    if media_data and media_type:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{media_type};base64,{media_data}"
            }
        })

    # ── Call OpenRouter API ─────────────────────────────
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "MemeForge AI"
    }

    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 800,
        "temperature": 0.9 + (intensity * 0.02),
        "top_p": 0.95
    }

    try:
        resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=40)
        resp.raise_for_status()

        raw = resp.json()["choices"][0]["message"]["content"].strip()

        # ── Parse Outputs ──────────────────────────────
        lines = raw.split("\n")
        results = []

        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Remove line numbering (1. 2) etc)
            cleaned = re.sub(r"^\*?\*?\d+[\.\)\:]?\*?\*?\s*", "", line).strip()
            
            if cleaned and len(cleaned) > 2:
                if mode == "Both":
                    # Try splitting by "|" or matching "Caption:" and "Comment:"
                    if "|" in cleaned:
                        parts = cleaned.split("|", 1)
                        c_cap = re.sub(r"^(Caption|Caption:)\s*", "", parts[0], flags=re.IGNORECASE).strip()
                        c_com = re.sub(r"^(Comment|Comment:)\s*", "", parts[1], flags=re.IGNORECASE).strip()
                        results.append({"caption": c_cap, "comment": c_com})
                    else:
                        match = re.search(r"Caption:\s*(.*?)\s*Comment:\s*(.*)", cleaned, re.IGNORECASE)
                        if match:
                            results.append({"caption": match.group(1).strip(), "comment": match.group(2).strip()})
                        else:
                            results.append({"caption": cleaned, "comment": ""})
                else:
                    # Strip extraneous mode prefixes if generated
                    cleaned = re.sub(r"^(Caption|Comment):\s*", "", cleaned, flags=re.IGNORECASE).strip()
                    results.append(cleaned)

        # Basic deduplication
        unique = []
        if mode == "Both":
            seen = set()
            for r in results:
                sig = r["caption"].lower() + "|||" + r["comment"].lower()
                if sig not in seen and (r["caption"] or r["comment"]):
                    seen.add(sig)
                    unique.append(r)
        else:
            seen = set()
            for r in results:
                if r.lower() not in seen:
                    seen.add(r.lower())
                    unique.append(r)

        return jsonify({"results": unique[:count]})

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to OpenRouter API timed out. Please try again."}), 504
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            return jsonify({"error": "Invalid API key. Check your OpenRouter key in environment or .env file."}), 401
        return jsonify({"error": f"API error: {e.response.status_code} - {e.response.text}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    print("\n[MemeForge AI] Server is starting...")
    print("[MemeForge AI] Open http://localhost:5000 in your browser\n")
    app.run(debug=True, port=5000)
