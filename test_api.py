import requests
import json
url = "http://localhost:8000/api/extract-invoice"
file_path = r"C:\Users\crisg\.gemini\antigravity\brain\a1ff1395-3d82-4d3b-af94-6062637325c9\media__1783613276847.pdf"

with open(file_path, "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)

print(response.status_code)
print(json.dumps(response.json(), indent=2))
