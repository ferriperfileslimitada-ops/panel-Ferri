import { useShow, useNavigation } from "@refinedev/core";
import { supabaseClient } from "@/providers/supabase-client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Printer, Send } from "lucide-react";
import { toast } from "sonner";

export const CotizacionShow = () => {
  const { query } = useShow({
    resource: "cotizaciones",
    meta: {
      select: "*, cliente:clientes(*)",
    }
  });
  
  const { list } = useNavigation();
  const { data, isLoading } = query;
  const cotizacion = data?.data;

  const [items, setItems] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isQueueingForSiigo, setIsQueueingForSiigo] = useState(false);

  useEffect(() => {
    if (cotizacion?.id) {
      supabaseClient
        .from("cotizacion_items")
        .select("*, producto:productos(*)")
        .eq("cotizacion_id", cotizacion.id)
        .then(({ data }) => {
          if (data) setItems(data);
        });
    }
  }, [cotizacion?.id]);

  if (isLoading) {
    return <div>Cargando cotización...</div>;
  }

  if (!cotizacion) {
    return <div>No se encontró la cotización.</div>;
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const itemsForEmail = items.map(item => ({
        nombre: item.producto?.nombre || "Producto",
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal
      }));

      const apiUrl = import.meta.env.DEV ? "http://localhost:3001/api/send-quote" : "/api/send-quote";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: cotizacion.cliente?.email || "",
          clientName: cotizacion.cliente?.name || "Cliente",
          clientNit: cotizacion.cliente?.identification || "",
          date: new Date(cotizacion.created_at).toLocaleDateString('es-CO'),
          quoteId: String(cotizacion.numero),
          items: itemsForEmail,
          subtotal: cotizacion.subtotal,
          iva: cotizacion.iva,
          total: cotizacion.total,
          expiration: cotizacion.valida_hasta,
          notes: cotizacion.notas
        })
      });

      if (!res.ok) throw new Error("Error del servidor de correos");
      toast.success("Correo enviado exitosamente");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo enviar el correo");
    } finally {
      setIsSending(false);
    }
  };

  const handleApproveAndQueueForSiigo = async () => {
    const confirmed = window.confirm(
      "¿Apruebas enviar esta cotización a Siigo? La solicitud quedará registrada y no se enviará dos veces."
    );
    if (!confirmed) return;

    setIsQueueingForSiigo(true);
    try {
      const { error } = await supabaseClient.rpc("queue_approved_quotation_for_siigo", {
        p_quotation_id: cotizacion.id,
      });

      if (error) throw error;

      toast.success("Cotización aprobada y encolada para envío a Siigo.");
      await query.refetch();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "No se pudo aprobar la cotización para Siigo.");
    } finally {
      setIsQueueingForSiigo(false);
    }
  };

  const isSyncedWithSiigo = cotizacion.siigo_sync_status === "synced";
  const isAwaitingSiigo = ["queued", "processing"].includes(cotizacion.siigo_sync_status);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => list("cotizaciones")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cotización #{cotizacion.numero}</h1>
            <p className="text-muted-foreground">{new Date(cotizacion.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isSyncedWithSiigo && (
            <Button
              onClick={handleApproveAndQueueForSiigo}
              disabled={isQueueingForSiigo || isAwaitingSiigo}
            >
              <Send className="mr-2 h-4 w-4" />
              {isQueueingForSiigo
                ? "Aprobando..."
                : isAwaitingSiigo
                  ? "En espera de Siigo"
                  : "Aprobar y enviar a Siigo"}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={handleSendEmail} disabled={isSending || !cotizacion.cliente?.email}>
            <Mail className="mr-2 h-4 w-4" /> {isSending ? "Enviando..." : "Enviar por Correo"}
          </Button>
        </div>
      </div>

      {!cotizacion.cliente?.email && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          Este cliente no tiene correo electrónico registrado. No se puede enviar por correo.
        </div>
      )}

      <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
        {isSyncedWithSiigo ? (
          <span>Sincronizada con Siigo{cotizacion.siigo_quotation_number ? `: ${cotizacion.siigo_quotation_number}` : "."}</span>
        ) : isAwaitingSiigo ? (
          <span>La cotización fue aprobada y está esperando procesamiento seguro en Siigo.</span>
        ) : cotizacion.siigo_sync_status === "failed" ? (
          <span className="text-destructive">El último envío a Siigo falló. Puedes aprobarla nuevamente para reintentar.</span>
        ) : (
          <span>Esta cotización aún no ha sido aprobada para enviarse a Siigo.</span>
        )}
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold text-primary mb-1">FERRIPERFILES LIMITADA</h2>
              <p className="text-sm text-muted-foreground">NIT 900.133.263-6</p>
              <p className="text-sm text-muted-foreground">CL 13 A 81 A 22</p>
              <p className="text-sm text-muted-foreground">Tel: (6014122227) 3223797945 - Ext. 3142138977</p>
              <p className="text-sm text-muted-foreground">Bogotá - Colombia</p>
            </div>
            <div className="text-right">
              <h3 className="font-semibold text-lg text-foreground">COTIZACIÓN OFICIAL</h3>
              <p className="text-sm font-medium">#{cotizacion.numero}</p>
              <p className="text-sm text-muted-foreground mt-2">Fecha: {new Date(cotizacion.created_at).toLocaleDateString('es-CO')}</p>
              <p className="text-sm text-muted-foreground">Validez: {cotizacion.valida_hasta || 'N/A'}</p>
            </div>
          </div>

          <div className="border-t border-b py-4 mb-8">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">SEÑOR(ES):</h4>
            <p className="font-medium text-lg">{cotizacion.cliente?.name}</p>
            <p className="text-sm text-muted-foreground">NIT/Cédula: {cotizacion.cliente?.identification || 'N/A'}</p>
            {cotizacion.cliente?.email && <p className="text-sm text-muted-foreground">Email: {cotizacion.cliente?.email}</p>}
            {cotizacion.cliente?.telefono && <p className="text-sm text-muted-foreground">Tel: {cotizacion.cliente?.telefono}</p>}
          </div>

          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="border-b">
                <th className="text-left font-semibold py-2">Código</th>
                <th className="text-left font-semibold py-2">Descripción</th>
                <th className="text-right font-semibold py-2">Cant.</th>
                <th className="text-right font-semibold py-2">Precio Unit.</th>
                <th className="text-right font-semibold py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-muted/50 last:border-0">
                  <td className="py-3 font-mono text-xs">{item.producto?.sku}</td>
                  <td className="py-3">{item.producto?.nombre}</td>
                  <td className="py-3 text-right">{item.cantidad}</td>
                  <td className="py-3 text-right">{formatMoney(item.precio_unitario)}</td>
                  <td className="py-3 text-right font-medium">{formatMoney(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatMoney(cotizacion.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (19%):</span>
                <span>{formatMoney(cotizacion.iva)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-lg">
                <span>Total:</span>
                <span>{formatMoney(cotizacion.total)}</span>
              </div>
            </div>
          </div>

          {cotizacion.notas && (
            <div className="mt-8 pt-4 border-t">
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Notas Adicionales:</h4>
              <p className="text-sm">{cotizacion.notas}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
