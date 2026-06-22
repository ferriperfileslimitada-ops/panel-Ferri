import { useList, useUpdate } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Package, User, DollarSign, Calendar, Truck } from "lucide-react";
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
  const { query: { data, isLoading, refetch } } = useList({
    resource: "despachos",
    pagination: { pageSize: 200 },
    sorters: [{ field: "created_at", order: "desc" }],
    meta: {
      select: "*, cotizacion_id(numero, total, created_at), cliente_id(name, email, identification)",
    },
  });

  const { mutate: updateDespacho } = useUpdate();

  const moverDespacho = async (despacho: any, direccion: "next" | "prev") => {
    const idxActual = ORDEN.indexOf(despacho.estado);
    const idxNuevo = direccion === "next" ? idxActual + 1 : idxActual - 1;
    if (idxNuevo < 0 || idxNuevo >= ORDEN.length) return;

    const nuevoEstado = ORDEN[idxNuevo];

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
          toast.success(`Pedido movido a "${COLUMNAS.find(c => c.id === nuevoEstado)?.label}". Correo enviado.`);
        } catch {
          toast.warning("Estado actualizado, pero falló el envío del correo.");
        }
      },
      onError: () => toast.error("Error al actualizar el estado."),
    });
  };

  const despachosPorEstado = (estado: string) =>
    (data?.data || []).filter((d: any) => d.estado === estado);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground animate-pulse mb-3" />
          <p className="text-muted-foreground">Cargando despachos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Despachos</h1>
        <p className="text-muted-foreground">Seguimiento en tiempo real — {data?.total || 0} pedido(s)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNAS.map((col) => {
          const tarjetas = despachosPorEstado(col.id);
          return (
            <div key={col.id} className={`rounded-xl border-2 ${col.color} p-4 min-h-[500px]`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">{col.label}</h2>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${col.badge}`}>
                  {tarjetas.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {tarjetas.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-xs opacity-60">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Sin pedidos
                  </div>
                ) : (
                  tarjetas.map((d: any) => {
                    const idxActual = ORDEN.indexOf(d.estado);
                    const cot = d.cotizacion_id;
                    const cli = d.cliente_id;
                    return (
                      <Card key={d.id} className="shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-card">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold">#{cot?.numero || "—"}</CardTitle>
                            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate font-medium text-foreground">{cli?.name || "—"}</span>
                          </div>
                          {cli?.identification && (
                            <div className="text-xs text-muted-foreground pl-5">NIT: {cli.identification}</div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <DollarSign className="h-3 w-3 shrink-0" />
                            <span className="font-semibold text-foreground">{formatMoney(cot?.total || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>{cot?.created_at ? new Date(cot.created_at).toLocaleDateString("es-CO") : "—"}</span>
                          </div>

                          <div className="flex gap-2 pt-2">
                            {idxActual > 0 && (
                              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => moverDespacho(d, "prev")}>
                                <ArrowLeft className="h-3 w-3 mr-1" /> Anterior
                              </Button>
                            )}
                            {idxActual < ORDEN.length - 1 && (
                              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => moverDespacho(d, "next")}>
                                Siguiente <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                            {d.estado === "entregado" && (
                              <Badge variant="outline" className="flex-1 justify-center text-xs text-green-700 border-green-300">
                                Completado ✓
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
