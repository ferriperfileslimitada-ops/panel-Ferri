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


import httpx

GOOGLE_VISION_API_KEY = os.getenv("GOOGLE_CLOUD_API_KEY")

async def google_vision_ocr(image_bytes: bytes) -> str:
    """Usa Google Cloud Vision API para extraer texto de una imagen con precision."""
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    
    url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}"
    payload = {
        "requests": [
            {
                "image": {"content": image_base64},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}]
            }
        ]
    }
    
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
    
    result = resp.json()
    annotations = result.get("responses", [{}])[0]
    full_text = annotations.get("fullTextAnnotation", {}).get("text", "")
    return full_text


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
                pix = page.get_pixmap(dpi=300)  # Alta resolucion para mejor OCR
                pix.save(str(img_path))
                file_path = img_path
                doc.close()

        # Leer la imagen
        with open(file_path, "rb") as img_file:
            image_bytes = img_file.read()

        # PASO 1: Google Cloud Vision OCR (precision quirurgica para texto y numeros)
        extracted_text = await google_vision_ocr(image_bytes)
        
        if not extracted_text.strip():
            return {"status": "error", "message": "Google Vision no detectó texto en el documento."}

        # PASO 2: GPT-4o estructura el texto extraido en JSON (sin ver la imagen, solo texto puro)
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un asistente experto en extraer datos de facturas colombianas. "
                        "Se te proporcionará el texto EXACTO extraído por OCR de una factura. "
                        "REGLAS ESTRICTAS:\n"
                        "1. Usa UNICAMENTE el texto proporcionado. NO inventes ni deduzcas datos que no estén en el texto.\n"
                        "2. Los precios en facturas colombianas usan PUNTO como separador de miles y COMA como decimales. Ej: $1.078.100,00 = 1078100.00\n"
                        "3. Lee cada fila de la tabla de items por separado. Cada fila es un item distinto.\n"
                        "4. Copia los codigos, nombres de productos y el CUFE EXACTAMENTE como aparecen en el texto, caracter por caracter.\n"
                        "5. Responde UNICAMENTE con un objeto JSON valido.\n"
                        "6. Si un campo no se encuentra en el texto, dejalo como null.\n"
                        "7. El CUFE suele estar etiquetado como 'CUFE:' y es un codigo hexadecimal MUY largo (96+ caracteres). Copialo COMPLETO."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "A continuación está el texto EXACTO extraído por OCR de una factura colombiana. "
                        "Extrae los datos y devuelve un JSON con esta estructura:\n"
                        "{\n"
                        '  "numero_factura": "string",\n'
                        '  "cufe": "string (codigo alfanumerico largo, copiar EXACTO del texto)",\n'
                        '  "fecha_factura": "YYYY-MM-DD",\n'
                        '  "fecha_vencimiento": "YYYY-MM-DD o null",\n'
                        '  "nombre_proveedor": "string (empresa que EMITE la factura)",\n'
                        '  "nit_proveedor": "string",\n'
                        '  "nombre_cliente": "string (empresa COMPRADORA)",\n'
                        '  "nit_cliente": "string",\n'
                        '  "direccion_cliente": "string completa",\n'
                        '  "ciudad_cliente": "string",\n'
                        '  "telefono_cliente": "string o null",\n'
                        '  "numero_pedido": "string o null",\n'
                        '  "numero_remision": "string o null",\n'
                        '  "orden_compra": "string o null",\n'
                        '  "vendedor": "string o null",\n'
                        '  "forma_pago": "string",\n'
                        '  "items": [\n'
                        '    {\n'
                        '      "codigo": "string",\n'
                        '      "descripcion": "string",\n'
                        '      "cantidad": number,\n'
                        '      "unidad": "string",\n'
                        '      "peso_kg": number o null,\n'
                        '      "precio_unitario": number,\n'
                        '      "descuento": number o 0,\n'
                        '      "valor_total": number\n'
                        '    }\n'
                        '  ],\n'
                        '  "subtotal": number,\n'
                        '  "flete": number o 0,\n'
                        '  "seguro": number o 0,\n'
                        '  "otros_gastos": number o 0,\n'
                        '  "iva": number,\n'
                        '  "tarifa_iva": number,\n'
                        '  "total": number,\n'
                        '  "moneda": "string",\n'
                        '  "observaciones": "string o null"\n'
                        "}\n\n"
                        "REGLAS NUMERICAS: Convierte valores monetarios colombianos a numeros planos. "
                        "Ej: $ 1.078.100,00 → 1078100.00 | $ 58.497,00 → 58497.00\n\n"
                        "===== TEXTO OCR DE LA FACTURA =====\n"
                        f"{extracted_text}\n"
                        "===== FIN DEL TEXTO ====="
                    )
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=4000
        )

        json_text = response.choices[0].message.content.strip()

        try:
            parsed_data = json.loads(json_text)
        except json.JSONDecodeError:
            parsed_data = {"raw_llm_response": json_text, "ocr_text": extracted_text}

        return {"status": "success", "data": parsed_data}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Error interno: {str(e)}"}


# ==========================================
# SUBIR FACTURA EXTRAÍDA A SIIGO
# ==========================================

@app.post("/api/upload-to-siigo")
async def upload_to_siigo(invoice_data: Dict[str, Any]):
    try:
        nit_proveedor = invoice_data.get("nit_proveedor", "")
        cufe = invoice_data.get("cufe", "")
        
        # Construir items para Siigo
        siigo_items = []
        for item in invoice_data.get("items", []):
            siigo_items.append({
                "code": item.get("codigo", ""),
                "description": item.get("descripcion", ""),
                "quantity": item.get("cantidad", 1),
                "price": item.get("precio_unitario", 0),
                "discount": item.get("descuento", 0),
            })
        
        # Construir observaciones con CUFE para trazabilidad
        observaciones = invoice_data.get("observaciones", "") or ""
        if cufe:
            observaciones = f"CUFE: {cufe}\n{observaciones}".strip()
        
        # Calcular total para el pago
        total = invoice_data.get("total", 0)
        
        # Construir payload con estructura correcta de Siigo API
        siigo_payload = {
            "document": {"id": 24},  # Tipo factura de compra (verificar en /v1/document-types)
            "date": invoice_data.get("fecha_factura", ""),
            "supplier": {
                "identification": nit_proveedor,
                "branch_office": 0
            },
            "number": invoice_data.get("numero_factura", ""),
            "items": siigo_items,
            "payments": [
                {
                    "id": 5636,  # Condicion de pago (verificar en /v1/payment-types)
                    "value": total,
                    "due_date": invoice_data.get("fecha_vencimiento") or invoice_data.get("fecha_factura", "")
                }
            ],
            "observations": observaciones,
            "stamp": {
                "send": False
            }
        }
        
        # Enviar a Siigo
        resp = siigo_client.create_purchase_invoice(siigo_payload)
        
        # Construir URL de Siigo para el usuario
        siigo_id = resp.get("id", "") if isinstance(resp, dict) else ""
        siigo_url = f"https://siigonube.siigo.com/#/purchases/{siigo_id}" if siigo_id else "https://siigonube.siigo.com"
        
        return {
            "status": "success",
            "siigo_url": siigo_url,
            "siigo_id": siigo_id,
            "cufe": cufe,
            "siigo_response": resp
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Error subiendo a Siigo: {str(e)}"}


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
