import os
import shutil
import json
import base64
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

from scheduler import setup_scheduler
from siigo_client import siigo_client

# Cargar .env
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)

app = FastAPI(title="OCR & Siigo Sync Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.on_event("startup")
async def startup_event():
    # Iniciar el scheduler en background
    setup_scheduler(app)


@app.post("/api/extract-invoice")
async def extract_invoice(file: UploadFile = File(...)):
    try:
        temp_dir = Path("temp")
        temp_dir.mkdir(exist_ok=True)

        file_path = temp_dir / file.filename
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Si es PDF, convertir la primera pagina a imagen con PyMuPDF
        if file.filename.lower().endswith(".pdf"):
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            if len(doc) > 0:
                img_path = temp_dir / f"{file.filename}.png"
                page = doc.load_page(0)
                pix = page.get_pixmap(dpi=200)
                pix.save(str(img_path))
                file_path = img_path
                doc.close()

        # Leer la imagen y convertirla a base64
        with open(file_path, "rb") as img_file:
            image_bytes = img_file.read()
        
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        # Detectar el tipo MIME
        ext = file_path.suffix.lower()
        mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
        mime_type = mime_map.get(ext, "image/png")

        # Enviar la imagen directamente a GPT-4o-mini con vision
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres un asistente experto en extraer datos de facturas y comprobantes. Responde UNICAMENTE con un objeto JSON valido, sin texto adicional."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extrae los siguientes campos de esta factura/comprobante y devuelve SOLO un JSON valido. Campos: numero_factura, fecha, nombre_cliente, direccion_cliente, identificacion_cliente, items (lista de objetos con nombre, cantidad, precio_unitario, precio_total), subtotal, impuestos, total. Si un campo no se encuentra, dejalo como null."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=2000
        )

        json_text = response.choices[0].message.content.strip()

        try:
            parsed_data = json.loads(json_text)
        except json.JSONDecodeError:
            parsed_data = {"raw_llm_response": json_text}

        return {"status": "success", "data": parsed_data}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Error interno: {str(e)}"}


# ==========================================
# WEBHOOKS DE SUPABASE -> SIIGO
# ==========================================

class SupabaseWebhookPayload(BaseModel):
    type: str
    table: str
    record: Dict[str, Any]
    schema_name: str = "public"
    old_record: Optional[Dict[str, Any]] = None

@app.post("/webhook/productos")
async def webhook_productos(payload: SupabaseWebhookPayload):
    # Solo procesar updates o inserts de productos
    if payload.type in ["INSERT", "UPDATE"]:
        record = payload.record
        siigo_id = record.get("siigo_id")
        
        siigo_payload = {
            "code": record.get("code") or str(record.get("id")),
            "name": record.get("name"),
            "prices": [
                {
                    "currency_code": "COP",
                    "price_list": [{"position": 1, "value": record.get("price", 0)}]
                }
            ]
        }
        
        try:
            if siigo_id:
                # Update en siigo
                siigo_client.update_product(siigo_id, siigo_payload)
            else:
                # Deberiamos crearlo? Depende de la regla de negocio
                pass 
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ignored"}

@app.post("/webhook/clientes")
async def webhook_clientes(payload: SupabaseWebhookPayload):
    if payload.type in ["INSERT", "UPDATE"]:
        record = payload.record
        siigo_id = record.get("siigo_id")
        
        # Mapear estructura de cliente Supabase a Siigo
        siigo_payload = {
            "type": "Customer",
            "person_type": "Person" if not record.get("is_company") else "Company",
            "id_type": record.get("id_type", "13"), # Ej. 13 = Cédula
            "identification": record.get("identification"),
            "name": [record.get("first_name", ""), record.get("last_name", "")] if not record.get("is_company") else [],
            "company_name": record.get("company_name", "") if record.get("is_company") else "",
            "address": {"address": record.get("address", "")},
            "phones": [{"number": record.get("phone", "")}],
            "contacts": [{"first_name": record.get("first_name", ""), "last_name": record.get("last_name", ""), "email": record.get("email", "")}]
        }
        
        try:
            if siigo_id:
                siigo_client.update_customer(siigo_id, siigo_payload)
            else:
                resp = siigo_client.create_customer(siigo_payload)
                # Opcional: Actualizar en supabase el siigo_id
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ignored"}

@app.post("/webhook/cotizaciones")
async def webhook_cotizaciones(payload: SupabaseWebhookPayload):
    if payload.type == "INSERT":
        record = payload.record
        # Mapear estructura de cotizacion
        # Requiere el id_customer (Tercero) en Siigo y los items.
        
        try:
            # Construir siigo_payload asumiendo estructura base
            siigo_payload = {
                "document": {"id": 27}, # Tipo cotizacion por defecto en Siigo
                "date": record.get("date"),
                "customer": {"identification": record.get("customer_identification")},
                "items": []
            }
            # Aqui iterariamos los items si estuvieran en el payload.
            # En Supabase, a veces los items estan en una tabla relacionada, por lo que 
            # podria requerir un query a Supabase aqui para sacar los items.
            
            resp = siigo_client.create_quotation(siigo_payload)
            return {"status": "success", "siigo_response": resp}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ignored"}
