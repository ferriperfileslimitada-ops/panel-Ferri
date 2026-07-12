import { useList, useUpdate } from "@refinedev/core";
import { useState, useMemo } from "react";
import { DndContext, useDroppable, useDraggable, DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Package, User, DollarSign, Calendar, Truck, Eye, Edit3, Save, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

const COLUMNAS = [
  { id: "en_alistamiento", label: "📦 En Alistamiento", color: "bg-amber-50 border-amber-200 dark:bg-amber-950/20", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", dot: "bg-amber-400" },
  { id: "en_cargue",       label: "🏗️ En Cargue",       color: "bg-blue-50 border-blue-200 dark:bg-blue-950/20",   badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",   dot: "bg-blue-400" },
  { id: "en_transito",     label: "🚛 En Tránsito",     color: "bg-purple-50 border-purple-200 dark:bg-purple-950/20", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", dot: "bg-purple-400" },
  { id: "entregado",       label: "✅ Entregado",        color: "bg-green-50 border-green-200 dark:bg-green-950/20",  badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",  dot: "bg-green-400" },
];

const ORDEN = ["en_alistamiento", "en_cargue", "en_transito", "entregado"];

const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const Despachos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewDespacho, setViewDespacho] = useState<any | null>(null);
  const [editDespacho, setEditDespacho] = useState<any | null>(null);
  const [notas, setNotas] = useState("");

  const { query: { data, isLoading, refetch } } = useList({
    resource: "despachos",
    pagination: { pageSize: 10000 },
    sorters: [{ field: "created_at", order: "desc" }],
    meta: {
      select: "*, cotizacion_id(*, items:cotizacion_items(*, producto:productos(*))), cliente_id(*)",
    },
  });

  const { mutate: updateDespacho } = useUpdate();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const despachoId = active.id;
    const nuevoEstado = over.id;

    const despacho = filteredData.find((d: any) => d.id === despachoId);
    if (!despacho || despacho.estado === nuevoEstado) return;

    // Actualizamos optimísticamente en Refine y mandamos el estado
    updateDespacho({
      resource: "despachos",
      id: despacho.id,
      values: { estado: nuevoEstado },
    }, {
      onSuccess: async () => {
        refetch();
        try {
          const apiUrl = import.meta.env.DEV ? "http://localhost:3001/api/despacho-status" : "/api/despacho-status";
          await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              estado: nuevoEstado,
              clienteEmail: despacho.cliente_id?.email || "",
              clienteName: despacho.cliente_id?.name || "Cliente",
              quoteNumero: despacho.cotizacion_id?.numero,
              despachoId: despacho.id,
            }),
          });
          toast.success(`Pedido movido a "${COLUMNAS.find((c: any) => c.id === nuevoEstado)?.label}". Correo enviado.`);
        } catch {
          toast.warning("Estado actualizado, pero falló el envío del correo.");
        }
      },
      onError: () => toast.error("Error al actualizar el estado."),
    });
  };

  const DraggableCard = ({ d, setEditDespacho, setNotas, setViewDespacho }: any) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: d.id,
      data: d,
    });
    
    const style = {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 50 : 1,
    };

    const cot = d.cotizacion_id;
    const itemsCount = cot?.items?.length || 0;

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pb-3">
        {/* Render Card here */}
        <Card className="hover:shadow-md transition-shadow dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="p-3 pb-0">
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className="font-mono text-xs bg-slate-100 dark:bg-slate-800 pointer-events-none">
                {cot?.numero ? `#${cot.numero}` : "Sin Cot."}
              </Badge>
              <div className="flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-500 hover:text-primary" onClick={(e) => { e.stopPropagation(); setViewDespacho(d); }} title="Ver detalles">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-500 hover:text-amber-600" onClick={(e) => { e.stopPropagation(); setEditDespacho(d); setNotas(d.notas || ""); }} title="Añadir notas">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 pointer-events-none">
            <div className="text-sm space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium truncate" title={d.cliente_id?.name}>{d.cliente_id?.name || "Sin Cliente"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mt-2">
                <Package className="h-3 w-3" />
                <span>{itemsCount} item{itemsCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 flex flex-col">
                  <span>Creado</span>
                  <span>{new Date(d.created_at).toLocaleDateString('es-CO', {day:'2-digit', month:'short'})}</span>
                </div>
                <span className="font-bold text-foreground">{formatMoney(cot?.total || 0)}</span>
              </div>
            </div>

            {d.notas && (
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-[10px] p-1.5 rounded border border-amber-200 mt-2 line-clamp-2">
                {d.notas}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const DroppableColumn = ({ col, tarjetas, setEditDespacho, setNotas, setViewDespacho }: any) => {
    const { setNodeRef, isOver } = useDroppable({
      id: col.id,
    });
    
    return (
      <div className={`flex flex-col w-72 sm:w-80 shrink-0 rounded-xl border-2 ${isOver ? 'border-primary ring-2 ring-primary/20' : col.color} bg-white dark:bg-slate-950 shadow-sm overflow-hidden h-full transition-all`}>
        <div className="flex items-center justify-between p-3 border-b border-inherit bg-inherit shrink-0">
          <h2 className="font-bold text-sm sm:text-base">{col.label}</h2>
          <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold ${col.badge}`}>
            {tarjetas.length}
          </span>
        </div>
        <div ref={setNodeRef} className="flex-1 p-2 sm:p-3 overflow-y-auto space-y-3 min-h-[150px]">
          {tarjetas.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <Package className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs font-medium">Sin pedidos aquí</p>
              <p className="text-[10px]">Arrastra tarjetas a esta columna</p>
            </div>
          ) : (
            tarjetas.map((d: any) => {
              return (
                <DraggableCard 
                  key={d.id} 
                  d={d} 
                  setEditDespacho={setEditDespacho}
                  setNotas={setNotas}
                  setViewDespacho={setViewDespacho}
                />
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Filtrado local
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!searchTerm.trim()) return data.data;
    const term = searchTerm.toLowerCase().trim();
    return data.data.filter((d: any) => {
      const numero = String(d.cotizacion_id?.numero || "").toLowerCase();
      const cliente = String(d.cliente_id?.name || "").toLowerCase();
      const nit = String(d.cliente_id?.identification || "").toLowerCase();
      return numero.includes(term) || cliente.includes(term) || nit.includes(term);
    });
  }, [data?.data, searchTerm]);

  const despachosPorEstado = (estado: string) =>
    filteredData.filter((d: any) => d.estado === estado);


  const handleSaveNotas = () => {
    if (!editDespacho) return;
    updateDespacho({
      resource: "despachos",
      id: editDespacho.id,
      values: { notas },
    }, {
      onSuccess: () => {
        toast.success("Notas guardadas correctamente.");
        setEditDespacho(null);
        refetch();
      },
      onError: () => toast.error("Error al guardar notas.")
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground animate-pulse mb-3" />
          <p className="text-muted-foreground">Cargando tablero de despachos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-2 sm:px-0 h-[calc(100vh-100px)] overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel de Despachos</h1>
          <p className="text-sm text-muted-foreground">Flujo y logística de pedidos — {data?.total || 0} pedido(s)</p>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Input
            type="text"
            placeholder="Buscar por cliente o # pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Kanban Board - Scrollable horizontally and vertically */}
      <div className="flex-1 overflow-auto rounded-lg border bg-slate-50/50 dark:bg-slate-900/20 p-2 sm:p-4">
        <DndContext onDragEnd={handleDragEnd}>
        <div className="flex flex-nowrap gap-4 min-w-max h-full">
          {COLUMNAS.map((col) => {
            const tarjetas = despachosPorEstado(col.id);
            return (
              <DroppableColumn 
                key={col.id} 
                col={col} 
                tarjetas={tarjetas} 
                setEditDespacho={setEditDespacho}
                setNotas={setNotas}
                setViewDespacho={setViewDespacho}
              />
            );
          })}
        </div>
        </DndContext>
      </div>

      {/* Modal Visoror Completo */}
      <Dialog open={!!viewDespacho} onOpenChange={(open) => !open && setViewDespacho(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Truck className="h-5 w-5 text-primary" />
              Detalle del Pedido #{viewDespacho?.cotizacion_id?.numero}
            </DialogTitle>
            <DialogDescription>
              Ficha completa de despacho e información del cliente.
            </DialogDescription>
          </DialogHeader>
          
          {viewDespacho && (
            <div className="grid gap-6 py-4">
              {/* Info Cliente & Dirección */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-primary flex items-center gap-1.5"><User className="h-4 w-4"/> Datos del Comprador</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{viewDespacho.cliente_id?.name}</span></p>
                    <p><span className="text-muted-foreground">NIT/CC:</span> <span className="font-medium">{viewDespacho.cliente_id?.identification}</span></p>
                    <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{viewDespacho.cliente_id?.email}</span></p>
                    <p><span className="text-muted-foreground">Tel:</span> <span className="font-medium">{viewDespacho.cliente_id?.Telefono || viewDespacho.cliente_id?.telefono}</span></p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-primary flex items-center gap-1.5"><MapPin className="h-4 w-4"/> Dirección de Envío</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Ciudad:</span> <span className="font-medium">{viewDespacho.cliente_id?.city || 'No especificada'}</span></p>
                    <p><span className="text-muted-foreground">Dirección:</span> <span className="font-medium">{viewDespacho.cliente_id?.address || 'No especificada'}</span></p>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {viewDespacho.notas && (
                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200">
                  <h3 className="font-semibold text-sm mb-1 text-amber-800 dark:text-amber-400">Notas de Despacho</h3>
                  <p className="text-sm text-amber-900 dark:text-amber-200">{viewDespacho.notas}</p>
                </div>
              )}

              {/* Items del pedido */}
              <div>
                <h3 className="font-semibold text-sm mb-3 text-primary flex items-center gap-1.5"><Package className="h-4 w-4"/> Productos a Despachar</h3>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="p-2 text-left font-medium">Producto</th>
                        <th className="p-2 text-right font-medium w-16">Cant.</th>
                        <th className="p-2 text-right font-medium w-24">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(viewDespacho.cotizacion_id?.items || []).map((item: any, i: number) => (
                        <tr key={i} className="bg-white dark:bg-slate-900">
                          <td className="p-2">{item.nombre || item.producto?.nombre}</td>
                          <td className="p-2 text-right font-medium">{item.cantidad}</td>
                          <td className="p-2 text-right">{formatMoney(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <td colSpan={2} className="p-2 text-right font-semibold">Total Pedido:</td>
                        <td className="p-2 text-right font-bold text-primary">{formatMoney(viewDespacho.cotizacion_id?.total || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Editar Notas */}
      <Dialog open={!!editDespacho} onOpenChange={(open) => !open && setEditDespacho(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Añadir o Editar Notas</DialogTitle>
            <DialogDescription>
              Pedido #{editDespacho?.cotizacion_id?.numero}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="notas">Instrucciones o novedades del despacho</Label>
              <Textarea 
                id="notas"
                placeholder="Ej. Entregar en portería, el cliente solo está en la tarde..." 
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="h-32 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDespacho(null)}>Cancelar</Button>
            <Button onClick={handleSaveNotas}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Notas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
