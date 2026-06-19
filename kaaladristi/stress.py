import requests
import threading

URL = "http://localhost:11434/api/generate"

def worker():
    while True:
        requests.post(
            URL,
            json={
                "model": "gemma",
                "prompt": "Write a detailed explanation of AI."
            },
            timeout=300
        )

for i in range(20):
    threading.Thread(target=worker, daemon=True).start()

input("Running... Press Enter to stop")