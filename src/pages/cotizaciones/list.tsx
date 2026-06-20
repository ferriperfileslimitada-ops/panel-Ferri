import { useTable, useDelete } from "@refinedev/core";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";

export const CotizacionesList = () => {
  const { tableQuery } = useTable({
    resource: "cotizaciones",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    meta: {
      select: "*, cliente_id(name)",
    }
  });

  const { mutate: deleteCotizacion } = useDelete();
  const { data, isLoading: isPending } = tableQuery;

  const handleDelete = (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar esta cotización?")) {
      deleteCotizacion({ resource: "cotizaciones", id });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aprobada': return 'default';
      case 'rechazada': return 'destructive';
      case 'enviada': return 'secondary';
      default: return 'outline';
    }
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
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">#{c.numero}</TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{c.cliente_id?.name || "Desconocido"}</TableCell>
                      <TableCell>{c.origen || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(c.estado)}>{c.estado}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.total)}
                      </TableCell>
                      <TableCell className="text-center space-x-2">
                        <Link to={`/cotizaciones/show/${c.id}`} className={buttonVariants({ size: "icon", variant: "ghost" })}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/cotizaciones/edit/${c.id}`} className={buttonVariants({ size: "icon", variant: "ghost" })}>
                          <Edit className="h-4 w-4" />
                        </Link>
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
