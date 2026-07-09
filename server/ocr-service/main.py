from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, Dict, Any

from scheduler import setup_scheduler
from siigo_client import siigo_client
from supabase import create_client, Client

app = FastAPI(title="OCR & Siigo Sync Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Iniciar el scheduler en background
    setup_scheduler(app)
    
# Initialize models lazily
ocr_model = None
llm_model = None

def get_ocr():
    global ocr_model
    if ocr_model is None:
        from paddleocr import PaddleOCR
        ocr_model = PaddleOCR(use_angle_cls=True, lang='en')
    return ocr_model

from openai import AsyncOpenAI
import os
from dotenv import load_dotenv

# Cargar .env por si no está cargado globalmente
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/api/extract-invoice")
async def extract_invoice(file: UploadFile = File(...)):
    try:
        temp_dir = Path("temp")
        temp_dir.mkdir(exist_ok=True)
        
        file_path = temp_dir / file.filename
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if file.filename.lower().endswith(".pdf"):
            from pdf2image import convert_from_path
            pages = convert_from_path(str(file_path))
            if len(pages) > 0:
                img_path = temp_dir / f"{file.filename}.jpg"
                pages[0].save(img_path, 'JPEG')
                file_path = img_path
        
        ocr = get_ocr()
        result = ocr.ocr(str(file_path), cls=True)
        
        extracted_text = ""
        if result and result[0]:
            for line in result[0]:
                extracted_text += line[1][0] + "\n"
                
        if not extracted_text.strip():
             return {"status": "error", "message": "No text detected in the document."}
                
        prompt = f"""
        Extract the following fields from this invoice text and return ONLY a valid JSON object.
        Keys to include: Invoice Number, Invoice Date, Customer Name, Customer Address, Purchased Items (List of objects with Item Name, Quantity, Price), SGST, CGST, Tax Total, Full Total.
        If a field is not found, leave it as null.
        
        Invoice Text:
        {extracted_text}
        
        JSON Output:
        """
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )
        
        json_text = response.choices[0].message.content.strip()
        
        try:
            parsed_data = json.loads(json_text)
        except json.JSONDecodeError:
            parsed_data = {"raw_llm_response": json_text, "extracted_text": extracted_text}
        
        return {"status": "success", "data": parsed_data}

        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
