import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, Pencil, Send, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";

export const ProcesarFactura = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableJson, setEditableJson] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [siigoUrl, setSiigoUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setIsEditing(false);
      setSiigoUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setResult(null);
    setIsEditing(false);
    setSiigoUrl(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      console.log("=== DEBUG API URL ===");
      console.log("VITE_API_URL enviroment variable:", import.meta.env.VITE_API_URL);
      console.log("Final URL used for fetch:", apiUrl);
      
      const response = await fetch(`${apiUrl}/api/extract-invoice`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error procesando la factura");
      }

      const data = await response.json();
      if (data.status === "success") {
        setResult(data.data);
        setEditableJson(JSON.stringify(data.data, null, 2));
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

  const handleStartEditing = () => {
    setEditableJson(JSON.stringify(result, null, 2));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(editableJson);
      setResult(parsed);
      setIsEditing(false);
      toast.success("Datos actualizados correctamente");
    } catch (error) {
      toast.error("JSON inválido. Revisa la sintaxis antes de guardar.");
    }
  };

  const handleCancelEdit = () => {
    setEditableJson(JSON.stringify(result, null, 2));
    setIsEditing(false);
  };

  const handleUploadToSiigo = async () => {
    if (!result) return;

    setIsUploading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      console.log("=== DEBUG SIIGO API URL ===");
      console.log("VITE_API_URL enviroment variable:", import.meta.env.VITE_API_URL);
      console.log("Final URL used for Siigo upload:", apiUrl);

      const response = await fetch(`${apiUrl}/api/upload-to-siigo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      if (!response.ok) {
        throw new Error("Error subiendo a Siigo");
      }

      const data = await response.json();
      if (data.status === "success") {
        setSiigoUrl(data.siigo_url || null);
        toast.success("Factura subida a Siigo exitosamente");
      } else {
        throw new Error(data.message || "Error subiendo a Siigo");
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo subir la factura a Siigo");
    } finally {
      setIsUploading(false);
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
                  Procesando con IA (GPT-4o)...
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
            <CardDescription>Revisa los datos obtenidos antes de subirlos a Siigo.</CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center h-40 space-y-4 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm animate-pulse">Analizando factura con GPT-4o...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Extracción completada
                </div>

                {isEditing ? (
                  <textarea
                    className="w-full h-96 p-3 font-mono text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    value={editableJson}
                    onChange={(e) => setEditableJson(e.target.value)}
                    spellCheck={false}
                  />
                ) : (
                  <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                  </div>
                )}

                {/* Mostrar URL de Siigo si ya se subió */}
                {siigoUrl && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Factura subida exitosamente a Siigo
                      </p>
                      <a
                        href={siigoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 dark:text-green-400 hover:underline break-all"
                      >
                        {siigoUrl}
                      </a>
                    </div>
                    <a
                      href={siigoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="flex-shrink-0">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Confirmar
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm text-center">
                <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                No hay datos para mostrar. Sube una factura primero.
              </div>
            )}
          </CardContent>
          {result && (
            <CardFooter className="flex gap-2">
              {isEditing ? (
                <>
                  <Button className="flex-1" onClick={handleSaveEdit} variant="default">
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </Button>
                  <Button className="flex-1" onClick={handleCancelEdit} variant="outline">
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button className="flex-1" onClick={handleStartEditing} variant="outline">
                    <Pencil className="mr-2 h-4 w-4" />
                    Corregir
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleUploadToSiigo}
                    disabled={isUploading || !!siigoUrl}
                    variant="default"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Subiendo a Siigo...
                      </>
                    ) : siigoUrl ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Subido a Siigo
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Revisado, subir a Siigo
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};
