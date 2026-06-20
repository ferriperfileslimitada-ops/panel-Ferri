import { useList } from "@refinedev/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Package, FileText, ShoppingCart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Dashboard = () => {
  // Fetch views data
  const { query: { data: stockBajo, isLoading: loadingStock } } = useList({
    resource: "v_stock_bajo_minimo",
    pagination: { pageSize: 5 },
  });

  const { query: { data: ventasOrigen, isLoading: loadingOrigen } } = useList({
    resource: "marketing_spend",
  });

  const { query: { data: cotizacionesRecientes, isLoading: loadingCotizaciones } } = useList({
    resource: "cotizaciones",
    pagination: { pageSize: 5 },
    sorters: [{ field: "created_at", order: "desc" }],
    meta: { select: "*, cliente_id(name)" }
  });

  const totalStockWarnings = stockBajo?.total || 0;
  
  // Calculate total revenue from origins (assuming current month for now, or just sum of all)
  const totalRevenue = ventasOrigen?.data?.reduce((acc, curr) => acc + Number(curr.revenue || 0), 0) || 0;
  const totalVentas = ventasOrigen?.data?.reduce((acc, curr) => acc + Number(curr.aprobadas || 0), 0) || 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard General</h1>
        <p className="text-muted-foreground">Resumen de operaciones de Ferriperfiles</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos (Histórico Aprobado)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones Aprobadas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalVentas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones Recientes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cotizacionesRecientes?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Alertas de Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalStockWarnings}</div>
            <p className="text-xs text-muted-foreground">Productos bajo el mínimo (10)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Quotes */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Últimas Cotizaciones</CardTitle>
            <CardDescription>
              Las 5 cotizaciones más recientes creadas en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCotizaciones ? (
                  <TableRow><TableCell colSpan={4} className="text-center">Cargando...</TableCell></TableRow>
                ) : (
                  cotizacionesRecientes?.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">#{c.numero}</TableCell>
                      <TableCell>
                        <Badge variant={c.estado === 'aprobada' ? 'default' : c.estado === 'borrador' ? 'outline' : 'secondary'}>
                          {c.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.origen || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Inventario Crítico</CardTitle>
            <CardDescription>
              Productos con menos de 10 unidades.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingStock ? (
                <div className="text-center text-sm text-muted-foreground">Cargando...</div>
              ) : stockBajo?.data.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">Todo en orden</div>
              ) : (
                stockBajo?.data.map((item) => (
                  <div key={item.sligo_id} className="flex items-center">
                    <Package className="h-9 w-9 p-2 bg-muted rounded-full mr-4" />
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none line-clamp-1" title={item.nombre}>{item.nombre}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                    <div className="ml-auto font-medium text-destructive">
                      {item.stock} u.
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
