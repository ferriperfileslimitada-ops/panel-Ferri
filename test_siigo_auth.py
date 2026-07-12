import requests

url = "https://api.siigo.com/auth"
payload = {
    "username": "ferriperfiles@hotmail.com",
    "access_key": "ODRiNTUyODQtNjZlOC00ZDhkLTk3NzUtYjI5NjU5YjUzOGRkOjl5Y2U9dlQ0LVU="
}
headers = {
    "Content-Type": "application/json",
    "Partner-Id": "ferriperfilesPanel"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print(e)
