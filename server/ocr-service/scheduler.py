import os
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from supabase import create_client, Client
from dotenv import load_dotenv

from siigo_client import siigo_client

# Cargar variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)

supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

async def sync_siigo_products():
    """
    Sincroniza los productos de Siigo a Supabase.
    Procesa lotes de 50 productos y luego espera 15 minutos para no colapsar la API.
    """
    print("[Siigo Sync] Iniciando sincronización nocturna de productos...")
    page = 1
    page_size = 50

    try:
        while True:
            print(f"[Siigo Sync] Procesando página {page}...")
            # Obtener productos de Siigo
            response = siigo_client.get_products(page=page, page_size=page_size)
            products = response.get('results', [])
            
            if not products:
                print("[Siigo Sync] No hay más productos por procesar. Sincronización finalizada.")
                break
                
            for p in products:
                # Extraer datos relevantes
                siigo_id = p.get('id')
                code = p.get('code')
                name = p.get('name')
                prices = p.get('prices', [])
                price = prices[0].get('price_list', [{}])[0].get('value', 0) if prices else 0
                
                # Intentar buscar el producto en Supabase por código o siigo_id
                # (Aquí adaptamos a la estructura real de la base de datos de Refine)
                # Supongamos que la tabla se llama 'products' y tenemos columnas 'siigo_id', 'name', 'price', etc.
                try:
                    # En upsert, asumiendo que 'siigo_id' o 'code' es única
                    supabase.table("products").upsert({
                        "siigo_id": siigo_id,
                        "name": name,
                        "price": price,
                        # ... mapear inventario si viene en el payload
                    }).execute()
                except Exception as e:
                    print(f"[Siigo Sync] Error actualizando {name} en BD: {e}")

            # Esperar 15 minutos antes de la siguiente página para evitar rate limits excesivos
            print("[Siigo Sync] Lote completado. Esperando 15 minutos...")
            await asyncio.sleep(15 * 60)
            page += 1

    except Exception as e:
        print(f"[Siigo Sync] Error crítico en la sincronización: {e}")


def setup_scheduler(app):
    """
    Inicializa APScheduler y registra la tarea programada.
    Se ejecuta a las 00:00 (Media noche).
    """
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_siigo_products,
        CronTrigger(hour=0, minute=0),
        id="sync_siigo_products_midnight",
        replace_existing=True
    )
    scheduler.start()
    print("[Scheduler] CronJob nocturno registrado y en ejecución.")
