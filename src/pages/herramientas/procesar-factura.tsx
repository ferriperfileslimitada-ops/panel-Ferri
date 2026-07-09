import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const ProcesarFactura = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Usamos el microservicio de python corriendo en el puerto 8000
      const response = await fetch("http://localhost:8000/api/extract-invoice", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error procesando la factura");
      }

      const data = await response.json();
      if (data.status === "success") {
        setResult(data.data);
        toast.success("Factura procesada con éxito");
      } else {
        throw new Error(data.message || "Error procesando la factura");
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo conectar con el servicio de OCR");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Procesar Factura</h1>
        <p className="text-muted-foreground">
          Sube una imagen o PDF de una factura para extraer los datos usando Inteligencia Artificial.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subir Comprobante</CardTitle>
            <CardDescription>Formatos soportados: JPG, PNG, PDF</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg border-muted-foreground/25 bg-muted/20">
              <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm font-semibold text-primary hover:underline">
                  Selecciona un archivo
                </span>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                {file ? file.name : "O arrástralo y suéltalo aquí"}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={handleUpload} 
              disabled={!file || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando con IA...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Extraer Datos
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos Extraídos</CardTitle>
            <CardDescription>Revisa los datos obtenidos antes de guardarlos.</CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center h-40 space-y-4 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm animate-pulse">Analizando estructura y texto...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Extracción completada
                </div>
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                  <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm text-center">
                <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                No hay datos para mostrar. Sube una factura primero.
              </div>
            )}
          </CardContent>
          {result && (
            <CardFooter>
              {/* En el futuro aquí podemos conectar estos datos con un formulario de creación de factura */}
              <Button className="w-full" variant="secondary">Usar datos para nueva Cotización / Compra</Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};
