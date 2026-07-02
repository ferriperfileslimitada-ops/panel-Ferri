import { useTable, useDelete, useUpdate, useCreate } from "@refinedev/core";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Edit, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/providers/supabase-client";

export const CotizacionesList = () => {
  const { tableQuery } = useTable({
    resource: "cotizaciones",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    meta: {
      select: "*, cliente_id(id, name, email, identification)",
    }
  });

  const { mutate: deleteCotizacion } = useDelete();
  const { mutate: updateCotizacion } = useUpdate();
  const { mutate: createDespacho } = useCreate();
  const { data, isLoading: isPending } = tableQuery;

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar esta cotización?")) {
      try {
        // Eliminar items primero para evitar error de foreign key
        const { error } = await supabaseClient
          .from("cotizacion_items")
          .delete()
          .eq("cotizacion_id", id);
          
        if (error) throw error;
        
        deleteCotizacion({ resource: "cotizaciones", id }, {
          onSuccess: () => toast.success("Cotización eliminada"),
          onError: () => toast.error("No se pudo eliminar la cotización")
        });
      } catch (err: any) {
        toast.error(`Error al eliminar items: ${err.message}`);
      }
    }
  };

  const handlePagado = async (c: any) => {
    if (!window.confirm(`¿Confirmas que la cotización #${c.numero} ha sido PAGADA?`)) return;

    updateCotizacion({
      resource: "cotizaciones",
      id: c.id,
      values: { estado: "pagada" },
    }, {
      onSuccess: () => {
        createDespacho({
          resource: "despachos",
          values: {
            cotizacion_id: c.id,
            cliente_id: c.cliente_id?.id,
            estado: "en_alistamiento",
          },
        }, {
          onSuccess: async (despachoData) => {
            const despachoId = despachoData?.data?.id;
            try {
              const apiUrl = import.meta.env.DEV ? "http://localhost:3001/api/despacho-create" : "/api/despacho-create";
              await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clienteEmail: c.cliente_id?.email || "",
                  clienteName: c.cliente_id?.name || "Cliente",
                  clienteNit: c.cliente_id?.identification || "",
                  quoteId: c.id,
                  quoteNumero: c.numero,
                  items: c.items || [],
                  subtotal: c.subtotal || 0,
                  iva: c.iva || 0,
                  total: c.total || 0,
                  date: new Date().toLocaleDateString("es-CO"),
                  despachoId,
                }),
              });
              toast.success(`✅ Pedido #${c.numero} marcado como pagado. Correos enviados.`);
            } catch {
              toast.error("Despacho creado pero no se pudieron enviar los correos.");
            }
          },
          onError: () => toast.error("Error al crear el despacho."),
        });
      },
      onError: () => toast.error("Error al actualizar la cotización."),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pagada': return 'default';
      case 'aprobada': return 'secondary';
      case 'rechazada': return 'destructive';
      case 'enviada': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada',
      rechazada: 'Rechazada', pagada: '✅ Pagada',
    };
    return labels[status] || status;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-muted-foreground">Gestiona las cotizaciones de clientes</p>
        </div>
        <Link to="/cotizaciones/create" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Cotización
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Cotizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">Cargando...</TableCell></TableRow>
                ) : data?.data.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">No hay cotizaciones.</TableCell></TableRow>
                ) : (
                  data?.data.map((c) => (
                    <TableRow key={c.id} className={c.estado === 'pagada' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                      <TableCell className="font-medium">#{c.numero}</TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{c.cliente_id?.name || "Desconocido"}</TableCell>
                      <TableCell>{c.origen || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(c.estado)}>{getStatusLabel(c.estado)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.total)}
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        <Link to={`/cotizaciones/show/${c.id}`} className={buttonVariants({ size: "icon", variant: "ghost" })}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/cotizaciones/edit/${c.id}`} className={buttonVariants({ size: "icon", variant: "ghost" })}>
                          <Edit className="h-4 w-4" />
                        </Link>
                        {c.estado !== 'pagada' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Marcar como Pagada"
                            onClick={() => handlePagado(c)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id as string)}>
                          <Trash2 className="h-4 w-4" />
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
  );
};
