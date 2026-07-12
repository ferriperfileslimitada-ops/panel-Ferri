import os
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from supabase import create_client, Client
from dotenv import load_dotenv

from siigo_client import siigo_client

# Cargar variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)

supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_key:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY es obligatoria para las sincronizaciones de Siigo")
supabase: Client = create_client(supabase_url, supabase_key)


def _customer_name(customer):
    """Obtiene un nombre legible sin inventar valores para datos incompletos."""
    company_name = customer.get("company_name")
    if isinstance(company_name, str) and company_name.strip():
        return company_name.strip()

    name = customer.get("name")
    if isinstance(name, list):
        value = " ".join(str(part).strip() for part in name if str(part).strip())
    else:
        value = str(name or "").strip()
    return value or None


def _first_contact_value(customer, key):
    contacts = customer.get("contacts") or []
    if contacts and isinstance(contacts[0], dict):
        value = contacts[0].get(key)
        return str(value).strip() if value is not None and str(value).strip() else None
    return None


def _first_phone(customer):
    phones = customer.get("phones") or []
    if phones and isinstance(phones[0], dict):
        value = phones[0].get("number")
        return str(value).strip() if value is not None and str(value).strip() else None
    return None


def _record_customer_issue(siigo_id, identification, issue_type, message):
    supabase.rpc("record_siigo_sync_issue", {
        "p_entity_type": "customer",
        "p_siigo_id": str(siigo_id),
        "p_siigo_code": str(identification or ""),
        "p_issue_type": issue_type,
        "p_message": message,
    }).execute()


async def sync_siigo_customers(trigger_source="schedule"):
    """Replica clientes de Siigo sin sobrescribir su identidad local en Supabase."""
    run = supabase.table("siigo_sync_runs").insert({
        "sync_type": "customers",
        "trigger_source": trigger_source,
        "status": "running",
    }).execute()
    run_id = run.data[0]["id"]
    counters = {"records_read": 0, "records_created": 0, "records_updated": 0,
                "records_skipped": 0, "records_failed": 0}
    page, page_size = 1, 10
    fatal_error = None

    try:
        while True:
            response = siigo_client.get_customers(page=page, page_size=page_size)
            customers = response.get("results", [])
            if not customers:
                break

            for listed_customer in customers:
                siigo_id = listed_customer.get("id")
                identification = listed_customer.get("identification")
                counters["records_read"] += 1
                try:
                    if not siigo_id:
                        counters["records_skipped"] += 1
                        continue

                    try:
                        customer = siigo_client.get_customer(siigo_id)
                    except Exception as error:
                        _record_customer_issue(siigo_id, identification, "siigo_api_error", str(error))
                        counters["records_failed"] += 1
                        continue

                    identification = customer.get("identification") or identification
                    name = _customer_name(customer)
                    if not identification:
                        _record_customer_issue(siigo_id, None, "missing_identification", "El cliente no tiene identificación.")
                        counters["records_skipped"] += 1
                        continue
                    if not name:
                        _record_customer_issue(siigo_id, identification, "missing_name", "El cliente no tiene nombre o razón social.")
                        counters["records_skipped"] += 1
                        continue

                    address = customer.get("address") or {}
                    city = address.get("city") or {}
                    result = supabase.rpc("sync_siigo_cliente", {
                        "p_siigo_id": str(siigo_id),
                        "p_identification": str(identification),
                        "p_name": name,
                        "p_email": _first_contact_value(customer, "email"),
                        "p_phone": _first_phone(customer),
                        "p_city": city.get("name") if isinstance(city, dict) else None,
                        "p_address": address.get("address") if isinstance(address, dict) else None,
                    }).execute()
                    action = result.data.get("sync_action") if isinstance(result.data, dict) else None
                    counters["records_created" if action == "created" else "records_updated"] += 1
                except Exception as error:
                    counters["records_failed"] += 1
                    try:
                        _record_customer_issue(siigo_id, identification, "supabase_error", str(error))
                    except Exception as issue_error:
                        print(f"[Siigo Sync] No se pudo registrar la incidencia de cliente {siigo_id}: {issue_error}")

            page += 1
            await asyncio.sleep(3)
    except Exception as error:
        fatal_error = str(error)
        print(f"[Siigo Sync] Error crítico sincronizando clientes: {error}")
    finally:
        status = "failed" if fatal_error else ("partial" if counters["records_failed"] or counters["records_skipped"] else "success")
        supabase.table("siigo_sync_runs").update({
            **counters,
            "status": status,
            "error_summary": fatal_error,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()

    if fatal_error:
        raise RuntimeError(fatal_error)
    return counters

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
    scheduler.add_job(
        sync_siigo_customers,
        CronTrigger(hour=0, minute=30),
        id="sync_siigo_customers_nightly",
        replace_existing=True
    )
    scheduler.start()
    print("[Scheduler] CronJob nocturno registrado y en ejecución.")
