import { useList } from "@refinedev/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, FileText, ShoppingCart,
  Users, Package, Truck, BarChart2, AlertTriangle, Clock, Target
} from "lucide-react";

const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const formatNum = (n: number) =>
  new Intl.NumberFormat("es-CO").format(n);

// Mini bar component
const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="w-full bg-muted rounded-full h-2 mt-1">
    <div
      className={`h-2 rounded-full ${color} transition-all`}
      style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }}
    />
  </div>
);

// KPI Card
const KpiCard = ({ title, value, sub, icon: Icon, trend, trendLabel, color = "text-foreground" }: any) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trendLabel}
        </div>
      )}
    </CardContent>
  </Card>
);

export const Analitica = () => {
  const { query: { data: cotizaciones, isLoading: loadingCot } } = useList({
    resource: "cotizaciones",
    pagination: { pageSize: 1000 },
    meta: { select: "id, estado, total, subtotal, iva, origen, created_at, cliente_id" },
  });

  const { query: { data: clientes } } = useList({
    resource: "clientes",
    pagination: { pageSize: 1 },
  });

  const { query: { data: productos } } = useList({
    resource: "productos",
    pagination: { pageSize: 1 },
  });

  const { query: { data: despachos } } = useList({
    resource: "despachos",
    pagination: { pageSize: 1000 },
    meta: { select: "id, estado, created_at" },
  });

  const { query: { data: stockBajo } } = useList({
    resource: "v_stock_bajo_minimo",
    pagination: { pageSize: 100 },
  });

  const { query: { data: ventasOrigen } } = useList({
    resource: "v_ventas_por_origen",
  });

  const allCot = cotizaciones?.data || [];

  // ── Revenue & Conversion ────────────────────────────────────────────────────
  const pagadas = allCot.filter((c: any) => c.estado === "pagada");
  const aprobadas = allCot.filter((c: any) => c.estado === "aprobada");
  const enviadas = allCot.filter((c: any) => c.estado === "enviada");
  const borradores = allCot.filter((c: any) => c.estado === "borrador");
  const rechazadas = allCot.filter((c: any) => c.estado === "rechazada");

  const revenueTotal = pagadas.reduce((a: number, c: any) => a + Number(c.total || 0), 0);
  const ticketPromedio = pagadas.length > 0 ? revenueTotal / pagadas.length : 0;
  const tasaConversion = allCot.length > 0 ? ((pagadas.length / allCot.length) * 100).toFixed(1) : "0";

  // ── Este mes vs mes anterior ────────────────────────────────────────────────
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

  const cotMes = allCot.filter((c: any) => new Date(c.created_at) >= inicioMes);
  const cotMesAnt = allCot.filter((c: any) => {
    const d = new Date(c.created_at);
    return d >= inicioMesAnterior && d < inicioMes;
  });

  const revenueMes = cotMes.filter((c: any) => c.estado === "pagada").reduce((a: number, c: any) => a + Number(c.total || 0), 0);
  const revenueMesAnt = cotMesAnt.filter((c: any) => c.estado === "pagada").reduce((a: number, c: any) => a + Number(c.total || 0), 0);
  const variacionRevenue = revenueMesAnt > 0 ? (((revenueMes - revenueMesAnt) / revenueMesAnt) * 100).toFixed(1) : null;

  // ── Canales (origen) ────────────────────────────────────────────────────────
  const origenes: Record<string, { total: number; count: number; revenue: number }> = {};
  allCot.forEach((c: any) => {
    const key = c.origen || "Sin origen";
    if (!origenes[key]) origenes[key] = { total: 0, count: 0, revenue: 0 };
    origenes[key].count++;
    if (c.estado === "pagada") origenes[key].revenue += Number(c.total || 0);
  });
  const origenesArr = Object.entries(origenes).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxRevOrigen = Math.max(...origenesArr.map(([, v]) => v.revenue), 1);

  // ── Despachos por estado ────────────────────────────────────────────────────
  const despachoData = despachos?.data || [];
  const despachosStats = {
    en_alistamiento: despachoData.filter((d: any) => d.estado === "en_alistamiento").length,
    en_cargue: despachoData.filter((d: any) => d.estado === "en_cargue").length,
    en_transito: despachoData.filter((d: any) => d.estado === "en_transito").length,
    entregado: despachoData.filter((d: any) => d.estado === "entregado").length,
  };

  // ── Cotizaciones en riesgo (enviadas hace > 7 días sin respuesta) ──────────
  const hace7dias = new Date();
  hace7dias.setDate(hace7dias.getDate() - 7);
  const enRiesgo = enviadas.filter((c: any) => new Date(c.created_at) < hace7dias);

  if (loadingCot) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground animate-pulse mb-3" />
          <p className="text-muted-foreground">Cargando analítica...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard de Analítica</h1>
        <p className="text-muted-foreground">Visión gerencial y de crecimiento · Datos en tiempo real</p>
      </div>

      {/* ── Sección 1: KPIs de Revenue ─────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" /> Revenue & Conversión
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Revenue del Mes"
            value={formatMoney(revenueMes)}
            sub="Cotizaciones pagadas este mes"
            icon={TrendingUp}
            trend={variacionRevenue !== null ? Number(variacionRevenue) : undefined}
            trendLabel={variacionRevenue !== null ? `${variacionRevenue}% vs mes anterior` : undefined}
            color="text-green-700"
          />
          <KpiCard
            title="Revenue Total Histórico"
            value={formatMoney(revenueTotal)}
            sub={`${pagadas.length} pedidos pagados`}
            icon={DollarSign}
          />
          <KpiCard
            title="Ticket Promedio"
            value={formatMoney(ticketPromedio)}
            sub="Por cotización pagada"
            icon={Target}
          />
          <KpiCard
            title="Tasa de Conversión"
            value={`${tasaConversion}%`}
            sub={`${pagadas.length} pagadas de ${allCot.length} totales`}
            icon={ShoppingCart}
            color={Number(tasaConversion) >= 20 ? "text-green-700" : "text-amber-600"}
          />
        </div>
      </section>

      {/* ── Sección 2: Pipeline de Ventas (funnel) ────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" /> Pipeline de Ventas
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Embudo de Cotizaciones</CardTitle>
              <CardDescription>De borrador a pagado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Borradores", count: borradores.length, color: "bg-slate-400", text: "text-slate-600" },
                { label: "Enviadas", count: enviadas.length, color: "bg-blue-400", text: "text-blue-600" },
                { label: "Aprobadas", count: aprobadas.length, color: "bg-amber-400", text: "text-amber-600" },
                { label: "Pagadas ✓", count: pagadas.length, color: "bg-green-500", text: "text-green-700" },
                { label: "Rechazadas", count: rechazadas.length, color: "bg-red-400", text: "text-red-600" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`font-medium ${item.text}`}>{item.label}</span>
                    <span className="font-bold">{item.count}</span>
                  </div>
                  <MiniBar value={item.count} max={allCot.length} color={item.color} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* En riesgo */}
          <Card className={enRiesgo.length > 0 ? "border-amber-300" : ""}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Cotizaciones en Riesgo
              </CardTitle>
              <CardDescription>Enviadas hace más de 7 días sin respuesta</CardDescription>
            </CardHeader>
            <CardContent>
              {enRiesgo.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  ✅ Todo en orden — sin cotizaciones en riesgo
                </div>
              ) : (
                <div className="space-y-2">
                  {enRiesgo.slice(0, 8).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span className="font-medium">#{c.id?.slice(-6)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString("es-CO")}</span>
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                          {Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)}d
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {enRiesgo.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center">+{enRiesgo.length - 8} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Sección 3: Rendimiento por Canal ──────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-purple-600" /> Rendimiento por Canal
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue e Impacto por Origen</CardTitle>
            <CardDescription>Qué canal genera más ingresos confirmados</CardDescription>
          </CardHeader>
          <CardContent>
            {origenesArr.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin datos de canales</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 text-xs text-muted-foreground font-medium border-b pb-2">
                  <span>Canal</span>
                  <span className="text-right">Cotizaciones</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Conversión</span>
                </div>
                {origenesArr.map(([origen, stats]) => {
                  const convRate = stats.count > 0 ? ((stats.revenue > 0 ? 1 : 0) * 100).toFixed(0) : "0";
                  return (
                    <div key={origen}>
                      <div className="grid grid-cols-4 text-sm items-center">
                        <span className="font-medium truncate">{origen}</span>
                        <span className="text-right text-muted-foreground">{formatNum(stats.count)}</span>
                        <span className="text-right font-semibold text-green-700">{formatMoney(stats.revenue)}</span>
                        <span className="text-right">
                          <Badge variant={stats.revenue > 0 ? "default" : "outline"} className="text-xs">
                            {stats.revenue > 0 ? "Con ventas" : "Sin ventas"}
                          </Badge>
                        </span>
                      </div>
                      <MiniBar value={stats.revenue} max={maxRevOrigen} color="bg-purple-400" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Sección 4: Operaciones + Inventario ───────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-orange-600" /> Operaciones e Inventario
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Despachos por estado */}
          <Card className="col-span-1 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm">Estado de Despachos</CardTitle>
              <CardDescription>Pedidos en cada etapa logística</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "📦 En Alistamiento", count: despachosStats.en_alistamiento, color: "bg-amber-400" },
                { label: "🏗️ En Cargue", count: despachosStats.en_cargue, color: "bg-blue-400" },
                { label: "🚛 En Tránsito", count: despachosStats.en_transito, color: "bg-purple-400" },
                { label: "✅ Entregados", count: despachosStats.entregado, color: "bg-green-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <MiniBar value={item.count} max={Math.max(despachoData.length, 1)} color={item.color} />
                    </div>
                    <span className="font-bold w-6 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Total activos</span>
                <span className="font-bold">{despachosStats.en_alistamiento + despachosStats.en_cargue + despachosStats.en_transito}</span>
              </div>
            </CardContent>
          </Card>

          {/* KPIs adicionales */}
          <div className="col-span-1 grid grid-rows-2 gap-4">
            <KpiCard
              title="Total Clientes"
              value={formatNum(clientes?.total || 0)}
              sub="Clientes registrados"
              icon={Users}
            />
            <KpiCard
              title="Total Productos"
              value={formatNum(productos?.total || 0)}
              sub="En catálogo"
              icon={Package}
            />
          </div>

          {/* Stock crítico */}
          <Card className="col-span-1 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Inventario Crítico
              </CardTitle>
              <CardDescription>Productos bajo mínimo de stock</CardDescription>
            </CardHeader>
            <CardContent>
              {(stockBajo?.data || []).length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">✅ Stock en niveles normales</div>
              ) : (
                <div className="space-y-3">
                  {(stockBajo?.data || []).slice(0, 6).map((item: any) => (
                    <div key={item.sligo_id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs" title={item.nombre}>{item.nombre}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                      </div>
                      <Badge variant="destructive" className="ml-2 shrink-0">{item.stock} u.</Badge>
                    </div>
                  ))}
                  {(stockBajo?.data || []).length > 6 && (
                    <p className="text-xs text-muted-foreground text-center">+{(stockBajo?.data || []).length - 6} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
