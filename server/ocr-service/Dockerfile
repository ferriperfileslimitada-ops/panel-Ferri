# Usa una imagen oficial de Python ligera
FROM python:3.11-slim

# Instala dependencias del sistema necesarias para algunas librerias (ej. PyMuPDF)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de requerimientos primero (para aprovechar la cache de Docker)
COPY requirements.txt .

# Instala las dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo el resto del codigo de tu backend al contenedor
COPY . .

# Expone el puerto 8000 (el que usara FastAPI)
EXPOSE 8000

# Comando para encender el servidor Uvicorn en modo produccion
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
