from mcp.server.fastmcp import FastMCP
from typing import Dict, Any

from .siigo_client import siigo_client

mcp = FastMCP("Siigo")

@mcp.tool()
def search_customer(identification: str) -> Dict[str, Any]:
    \"\"\"Busca un cliente (tercero) en Siigo por su identificacion (NIT o Cédula).\"\"\"
    # Siigo v1/customers?identification=...
    from .siigo_client import SIIGO_BASE_URL
    url = f"{SIIGO_BASE_URL}/v1/customers?identification={identification}"
    import requests
    response = requests.get(url, headers=siigo_client._get_headers())
    response.raise_for_status()
    results = response.json().get('results', [])
    if results:
        return results[0]
    return {"error": "No encontrado"}

@mcp.tool()
def create_customer(data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea un nuevo cliente en Siigo. Data debe cumplir con la estructura de Siigo API."""
    return siigo_client.create_customer(data)

@mcp.tool()
def create_sales_invoice(data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una factura de venta electrónica en Siigo."""
    return siigo_client.create_sales_invoice(data)

@mcp.tool()
def create_purchase_invoice(data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una factura de compra en Siigo (ideal para procesar con OCR)."""
    return siigo_client.create_purchase_invoice(data)

if __name__ == "__main__":
    print("Iniciando servidor Siigo MCP (Modo stdio)...")
    mcp.run()
