import asyncio
import sys
import os

# Asegurar que el directorio actual este en el path para poder importar
sys.path.append(os.path.join(os.path.dirname(__file__), 'server', 'ocr-service'))

from scheduler import sync_siigo_products

async def test_sync():
    print("=== Iniciando prueba manual de Sincronizacion Siigo -> Supabase ===")
    await sync_siigo_products()
    print("=== Prueba terminada ===")

if __name__ == "__main__":
    asyncio.run(test_sync())
