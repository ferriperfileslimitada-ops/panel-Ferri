import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, RefreshCw, Trash2, Terminal, ShieldAlert, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type LogEntry = {
  id: string;
  timestamp: string;
  service: string;
  message: string;
  details: any;
};

export const LogsPanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || (window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/logs`);
      if (!response.ok) throw new Error("Error cargando los logs");
      const data = await response.json();
      setLogs(data);
    } catch (err: any) {
      toast.error(err.message || "No se pudieron cargar los logs.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("¿Seguro que deseas vaciar el panel de logs? Esto eliminará el historial persistido.")) return;
    try {
      const response = await fetch(`${API_URL}/api/logs/clear`, { method: "POST" });
      if (!response.ok) throw new Error("Error al limpiar los logs");
      setLogs([]);
      toast.success("Historial de logs vaciado.");
    } catch (err: any) {
      toast.error(err.message || "Fallo al limpiar logs.");
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="flex flex-col gap-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-red-500" />
            Panel de Logs y Errores
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitoreo y fallos en tiempo real — Configurado con alertas SMTP automáticas
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading} className="flex-1 sm:flex-initial">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearLogs} disabled={logs.length === 0} className="flex-1 sm:flex-initial">
            <Trash2 className="mr-2 h-4 w-4" />
            Vaciar Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-red-500/20 bg-slate-950/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Terminal className="h-5 w-5 text-red-400" />
              Historial de Eventos Críticos
            </CardTitle>
            <CardDescription>
              Todos los errores y fallas registradas se muestran aquí. Se envían avisos a agency.adsbigger@gmail.com.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp (UTC)</TableHead>
                    <TableHead className="w-[150px]">Servicio</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead className="w-[80px] text-center">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
                        Cargando logs del sistema...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2 opacity-80" />
                        No hay fallos registrados. ¡Todo funciona correctamente!
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString("es-CO")}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20">
                            {log.service}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate font-medium text-red-500 text-xs sm:text-sm">
                          {log.message}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-8 text-xs text-primary"
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Detalle de Log */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl text-red-500">
              <AlertCircle className="h-5 w-5 shrink-0" />
              Detalles del Error
            </DialogTitle>
            <DialogDescription>
              Fallo registrado en {selectedLog && new Date(selectedLog.timestamp).toLocaleString("es-CO")}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">Servicio afectado:</span>
                  <span className="font-medium text-red-400">{selectedLog.service}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">ID Evento:</span>
                  <span className="font-mono text-xs">{selectedLog.id}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground block mb-1">Mensaje de Error:</span>
                <p className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 font-medium">
                  {selectedLog.message}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Traza / Datos Técnicos:</span>
                  <pre className="p-4 bg-slate-900 border rounded-lg text-xs font-mono overflow-auto max-h-[250px] whitespace-pre-wrap text-slate-300">
                    {typeof selectedLog.details === "object"
                      ? JSON.stringify(selectedLog.details, null, 2)
                      : selectedLog.details}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
