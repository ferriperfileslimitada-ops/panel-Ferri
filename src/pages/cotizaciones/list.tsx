import { useTable, useDelete, useUpdate, useCreate } from "@refinedev/core";
import { Link } from "react-router";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Edit, Trash2, CheckCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/providers/supabase-client";

export const CotizacionesList = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { tableQuery } = useTable({
    resource: "cotizaciones",
    pagination: { pageSize: 10000 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    meta: {
      select: "*, cliente_id(id, name, email, identification)",
    }
  });

  const { mutate: deleteCotizacion } = useDelete();
  const { mutate: updateCotizacion } = useUpdate();
  const { mutate: createDespacho } = useCreate();
  const { data, isLoading: isPending } = tableQuery;

  // Filtrado local case-insensitive
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!searchTerm.trim()) return data.data;

    const term = searchTerm.toLowerCase().trim();
    return data.data.filter((c: any) => {
      const numero = String(c.numero || "").toLowerCase();
      const cliente = String(c.cliente_id?.name || "").toLowerCase();
      const estado = String(c.estado || "").toLowerCase();
      const origen = String(c.origen || "").toLowerCase();
      const total = String(c.total || "");
      return numero.includes(term) || cliente.includes(term) || estado.includes(term) || origen.includes(term) || total.includes(term);
    });
  }, [data?.data, searchTerm]);

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
    <div className="flex flex-col gap-4 sm:gap-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">Gestiona las cotizaciones de clientes</p>
        </div>
        <Link to="/cotizaciones/create" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Cotización
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 pb-4">
          <CardTitle className="text-base sm:text-lg">Listado de Cotizaciones</CardTitle>
          <div className="relative w-full sm:max-w-sm">
            <Input
              type="text"
              placeholder="Buscar por número, cliente, estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
            <Search className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Número</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="whitespace-nowrap">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap hidden sm:table-cell">Origen</TableHead>
                  <TableHead className="whitespace-nowrap">Estado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">Cargando...</TableCell></TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">{searchTerm ? "Sin resultados para esta búsqueda." : "No hay cotizaciones."}</TableCell></TableRow>
                ) : (
                  filteredData.map((c: any) => (
                    <TableRow key={c.id} className={c.estado === 'pagada' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                      <TableCell className="font-medium text-xs sm:text-sm">#{c.numero}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-[150px] truncate">{c.cliente_id?.name || "Desconocido"}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{c.origen || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(c.estado)}>{getStatusLabel(c.estado)}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
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
                        </div>
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
