import os
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

API_KEY = os.environ.get("OPENROUTER_API_KEY")

if not API_KEY:
    print("[ERROR] OPENROUTER_API_KEY is missing! Set it in your environment or .env file.")
    exit(1)

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

body = {
    "model": "google/gemini-2.5-flash",
    "messages": [
        {"role": "user", "content": "Say hello in one funny sentence."}
    ],
    "max_tokens": 100
}

try:
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=body,
        timeout=15
    )
    print("Status Code:", response.status_code)
    if response.status_code == 200:
        print("[SUCCESS] OpenRouter API is working!")
        content = response.json()["choices"][0]["message"]["content"]
        print("AI Response:", content.encode('ascii', errors='replace').decode('ascii'))
    else:
        print("[ERROR] API Error:", response.text)
except Exception as e:
    print("[ERROR] Exception connecting to OpenRouter:", str(e))
