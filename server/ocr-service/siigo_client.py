import os
import requests
import json
from dotenv import load_dotenv

# Cargar .env desde la raíz del proyecto
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)

SIIGO_USERNAME = os.getenv("SIIGO_USERNAME")
SIIGO_ACCESS_KEY = os.getenv("SIIGO_ACCESS_KEY")
SIIGO_BASE_URL = "https://api.siigo.com"

class SiigoClient:
    def __init__(self):
        self.token = None

    def _get_headers(self):
        if not self.token:
            self.authenticate()
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Partner-Id": "" # Opcional si no es requerido
        }

    def authenticate(self):
        url = f"{SIIGO_BASE_URL}/auth"
        payload = {
            "username": SIIGO_USERNAME,
            "access_key": SIIGO_ACCESS_KEY
        }
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        data = response.json()
        self.token = data.get("access_token")
        return self.token

    def get_products(self, page=1, page_size=50):
        url = f"{SIIGO_BASE_URL}/v1/products?page={page}&page_size={page_size}"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def get_customers(self, page=1, page_size=50):
        url = f"{SIIGO_BASE_URL}/v1/customers?page={page}&page_size={page_size}"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def get_customer(self, customer_id):
        url = f"{SIIGO_BASE_URL}/v1/customers/{customer_id}"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def update_product(self, product_id, data):
        url = f"{SIIGO_BASE_URL}/v1/products/{product_id}"
        response = requests.put(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def create_customer(self, data):
        url = f"{SIIGO_BASE_URL}/v1/customers"
        response = requests.post(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def update_customer(self, customer_id, data):
        url = f"{SIIGO_BASE_URL}/v1/customers/{customer_id}"
        response = requests.put(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def create_quotation(self, data):
        url = f"{SIIGO_BASE_URL}/v1/quotations"
        response = requests.post(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def create_purchase_invoice(self, data):
        url = f"{SIIGO_BASE_URL}/v1/purchases"
        response = requests.post(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def create_sales_invoice(self, data):
        url = f"{SIIGO_BASE_URL}/v1/invoices"
        response = requests.post(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

# Instancia global
siigo_client = SiigoClient()
