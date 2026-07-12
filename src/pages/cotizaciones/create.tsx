import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useSelect, useGetIdentity, useNavigation } from "@refinedev/core";
import { supabaseClient } from "@/providers/supabase-client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, Save, ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

type FormValues = {
  cliente_id: string;
  is_new_client: boolean;
  nuevo_cliente: {
    name: string;
    identification: string;
    email: string;
    telefono: string;
    city: string;
  };
  valida_hasta: string;
  notas: string;
  origen: string;
  items: {
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
  }[];
};

export const CotizacionCreate = () => {
  const { list } = useNavigation();
  const { data: user } = useGetIdentity<{ id: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  
  // Combobox states
  const [openCliente, setOpenCliente] = useState(false);
  const [openProductos, setOpenProductos] = useState<Record<number, boolean>>({});

  const { register, control, handleSubmit, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      cliente_id: "",
      is_new_client: false,
      nuevo_cliente: { name: "", identification: "", email: "", telefono: "", city: "" },
      valida_hasta: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notas: "",
      origen: "Local",
      items: [{ producto_id: "", cantidad: 1, precio_unitario: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const isNewClient = watch("is_new_client");

  const { options: clienteOptions, query: clienteQuery, onSearch: onSearchCliente } = useSelect({
    resource: "clientes",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "name", order: "asc" }],
    pagination: { pageSize: 50 },
    meta: { select: "*" },
    onSearch: (value) => [
      {
        operator: "or",
        value: [
          { field: "name", operator: "contains", value },
          { field: "identification", operator: "contains", value },
          { field: "email", operator: "contains", value },
        ],
      },
    ],
  });

  const { options: productoOptions, query: productoQuery, onSearch: onSearchProducto } = useSelect({
    resource: "productos",
    optionLabel: "code",
    optionValue: "sligo_id",
    sorters: [{ field: "nombre", order: "asc" }],
    pagination: { pageSize: 50 },
    meta: { select: "*" },
    onSearch: (value) => [
      {
        operator: "or",
        value: [
          { field: "code", operator: "contains", value },
          { field: "nombre", operator: "contains", value },
        ],
      },
    ],
  });

  const watchItems = watch("items");

  const total = watchItems.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
  const subtotal = Math.round(total / 1.19);
  const iva = total - subtotal;

  const handleCreateClient = async () => {
    const data = getValues();
    if (!data.nuevo_cliente.name || !data.nuevo_cliente.identification) {
      toast.error("El Nombre y el NIT son obligatorios para crear un nuevo cliente.");
      return;
    }

    setIsCreatingClient(true);
    try {
      let siigoCustomerId = null;
      // --- Integración Siigo (Crear Cliente) ---
      try {
        const siigoApiUrl = import.meta.env.DEV ? "http://localhost:3001/api/siigo/customers" : "/api/siigo/customers";
        const res = await fetch(siigoApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "Customer",
            person_type: "Company",
            id_type: "31",
            identification: data.nuevo_cliente.identification,
            name: [data.nuevo_cliente.name],
            contacts: [{
              first_name: data.nuevo_cliente.name.substring(0, 50),
              last_name: "",
              email: data.nuevo_cliente.email || ""
            }],
            phones: [{ number: data.nuevo_cliente.telefono || "0000000" }]
          })
        });
        if (res.ok) {
          const siigoData = await res.json();
          siigoCustomerId = siigoData.id;
        } else {
           console.error("Siigo Client Error:", await res.text());
           toast.warning("El cliente no se pudo crear en Siigo, pero se guardará localmente.");
        }
      } catch (err) {
        console.error("Siigo Error:", err);
      }
      // ----------------------------------------

      const { data: newClient, error: clientError } = await supabaseClient
        .from("clientes")
        .insert({
          name: data.nuevo_cliente.name,
          identification: data.nuevo_cliente.identification,
          email: data.nuevo_cliente.email || null,
          "Telefono": data.nuevo_cliente.telefono ? Number(data.nuevo_cliente.telefono) : null,
          city: data.nuevo_cliente.city || null,
          siigo_id: siigoCustomerId
        })
        .select("id")
        .single();

      if (clientError) {
        throw new Error("No se pudo guardar el cliente localmente. " + clientError.message);
      }
      
      toast.success("Cliente creado exitosamente");
      setValue("cliente_id", newClient.id);
      setValue("is_new_client", false);
      clienteQuery.refetch(); 
    } catch (error: any) {
      toast.error("Error al crear cliente: " + error.message);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const onFinish = async (data: FormValues) => {
    if (data.is_new_client) {
      toast.error("Por favor, guarda el cliente nuevo haciendo clic en 'Guardar Cliente' antes de continuar con la cotización.");
      return;
    }
    if (!data.cliente_id) {
      toast.error("Seleccione un cliente existente o cree uno nuevo.");
      return;
    }
    if (data.is_new_client && (!data.nuevo_cliente.name || !data.nuevo_cliente.identification)) {
      toast.error("El Nombre y el NIT son obligatorios para crear un nuevo cliente.");
      return;
    }
    if (data.items.length === 0) {
      toast.error("Agregue al menos un producto");
      return;
    }

    const hasEmptyProduct = data.items.some(item => !item.producto_id || item.cantidad <= 0);
    if (hasEmptyProduct) {
      toast.error("Asegúrese de seleccionar un producto y una cantidad válida en todas las líneas");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalClientId = data.cliente_id;

      // 1. Integración Siigo (Crear Cotización)
      let siigoQuoteNumber = null;
      let siigoQuoteId = null;

      try {
        const clientDoc = (clienteQuery.data?.data as any[])?.find(c => c.id === finalClientId)?.identification;
        
        const siigoItems = data.items.map(i => {
           const prod = (productoQuery.data?.data as any[])?.find(p => p.sligo_id === i.producto_id);
           return {
             code: prod?.sku || i.producto_id,
             quantity: i.cantidad,
             price: i.precio_unitario
           }
        });

        const siigoQuoteUrl = import.meta.env.DEV ? "http://localhost:3001/api/siigo/quotations" : "/api/siigo/quotations";
        const res = await fetch(siigoQuoteUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             document: { id: 1 }, // Siigo Cloud document ID para Cotizacion, usualmente 1, pero puede variar por cuenta
             date: new Date().toISOString().split('T')[0],
             customer: {
               identification: clientDoc
             },
             items: siigoItems
          })
        });

        if (res.ok) {
           const siigoData = await res.json();
           siigoQuoteNumber = siigoData.name; // Ej: CQ-23
           siigoQuoteId = siigoData.id;
        } else {
           console.error("Siigo Quote Error:", await res.text());
        }
      } catch (err) {
        console.error("Siigo Quote Fetch Error:", err);
      }

      // 1.5. Insertar Cotización (Master)
      const insertData: any = {
          cliente_id: finalClientId,
          vendedor_id: user?.id,
          estado: "borrador",
          origen: data.origen,
          notas: data.notas,
          valida_hasta: data.valida_hasta,
          subtotal: subtotal,
          iva: iva,
          total: total,
          siigo_id: siigoQuoteId
      };
      // Si recibimos un número de Siigo, lo guardamos para reemplazar el serial por defecto
      if (siigoQuoteNumber) insertData.numero = siigoQuoteNumber;

      const { data: cotizacion, error: cotError } = await supabaseClient
        .from("cotizaciones")
        .insert(insertData)
        .select("id")
        .single();

      if (cotError) throw cotError;

      // 2. Preparar Items
      const itemsToInsert = data.items.map((item) => ({
        cotizacion_id: cotizacion.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.cantidad * item.precio_unitario,
        descuento_pct: 0
      }));

      // 3. Insertar Items (Detail)
      const { error: itemsError } = await supabaseClient
        .from("cotizacion_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 4. Enviar correo usando el backend local
      try {
        let emailTo = "";
        let nameTo = "";
        let nitTo = "";

        const client = (clienteQuery.data?.data as any[])?.find(c => c.id === finalClientId);
        emailTo = client?.email || "";
        nameTo = client?.name || "Cliente";
        nitTo = client?.identification || "";

        if (emailTo) {
          const itemsForEmail = data.items.map(item => {
            const product = (productoQuery.data?.data as any[])?.find(p => p.sligo_id === item.producto_id);
            return {
              nombre: product ? product.nombre : "Producto",
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              subtotal: item.cantidad * item.precio_unitario
            };
          });

          const apiUrl = import.meta.env.DEV ? "http://localhost:3001/api/send-quote" : "/api/send-quote";
          await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: emailTo,
              clientName: nameTo,
              clientNit: nitTo,
              date: new Date().toLocaleDateString('es-CO'),
              quoteId: cotizacion.id.split('-')[0].toUpperCase(),
              items: itemsForEmail,
              subtotal,
              iva,
              total,
              expiration: data.valida_hasta,
              notes: data.notas
            })
          });
          toast.success("Cotización creada y correo enviado");
        } else {
          toast.success("Cotización creada (Cliente sin correo)");
        }
      } catch (emailErr) {
        console.error("Error enviando correo:", emailErr);
        toast.warning("Cotización creada, pero hubo un error enviando el correo");
      }

      list("cotizaciones");

    } catch (error: any) {
      toast.error("Error al crear: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit(onFinish)} className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => list("cotizaciones")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nueva Cotización</h1>
          <p className="text-muted-foreground">Crear cotización multi-línea con cálculo automático</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles Generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 flex flex-col">
              <Label>Cliente</Label>
              <Controller
                control={control}
                name="cliente_id"
                render={({ field }) => (
                  <Popover open={openCliente} onOpenChange={setOpenCliente}>
                    <PopoverTrigger 
                      className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between", isNewClient ? "border-primary" : "")}
                    >
                        {isNewClient ? (
                          <span className="text-primary font-medium">✨ Creando nuevo cliente...</span>
                        ) : field.value ? (
                          clienteOptions?.find((c) => c.value === field.value)?.label
                        ) : (
                          "Buscar por nombre, NIT o email..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command
                        shouldFilter={false}
                      >
                        <CommandInput 
                          placeholder="Escribe nombre, NIT o email..." 
                          onValueChange={(val) => onSearchCliente(val)}
                        />
                        <CommandList>
                          <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                          <CommandGroup heading="Opciones">
                            <CommandItem
                              value="new-client"
                              onSelect={() => {
                                setValue("is_new_client", true);
                                setValue("cliente_id", "");
                                setOpenCliente(false);
                              }}
                              className="text-primary font-medium cursor-pointer"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Crear nuevo cliente
                            </CommandItem>
                          </CommandGroup>
                          <CommandGroup heading="Clientes Existentes">
                            {clienteOptions?.map((opt) => (
                              <CommandItem
                                key={opt.value}
                                value={opt.value as string}
                                onSelect={(currentValue) => {
                                  setValue("cliente_id", currentValue);
                                  setValue("is_new_client", false);
                                  setOpenCliente(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === opt.value && !isNewClient ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {opt.label}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  NIT: {((clienteQuery.data?.data as any[])?.find(c => c.id === opt.value))?.identification}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            {isNewClient && (
              <div className="bg-muted/50 p-4 rounded-md border space-y-4 mt-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-sm">Datos del Nuevo Cliente</h4>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue("is_new_client", false)}>
                    Cancelar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Razón Social *</Label>
                    <Input {...register("nuevo_cliente.name")} placeholder="Ej. Inserauto SAS" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIT / Cédula *</Label>
                    <Input {...register("nuevo_cliente.identification")} placeholder="Ej. 900.699.896" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono</Label>
                    <Input {...register("nuevo_cliente.telefono")} placeholder="Opcional" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input {...register("nuevo_cliente.email")} type="email" placeholder="Opcional" className="h-8" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Ciudad</Label>
                    <Input {...register("nuevo_cliente.city")} placeholder="Opcional" className="h-8" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" size="sm" onClick={handleCreateClient} disabled={isCreatingClient}>
                    {isCreatingClient ? "Guardando..." : "Guardar Cliente en Base de Datos y Siigo"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 mt-4">
              <Label>Origen de la Venta</Label>
              <Controller
                control={control}
                name="origen"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Origen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Local">Local</SelectItem>
                      <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Referido">Referido</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condiciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Válida hasta</Label>
              <Input type="date" {...register("valida_hasta")} />
            </div>
            <div className="space-y-2">
              <Label>Notas Adicionales</Label>
              <Input placeholder="Tiempos de entrega, condiciones especiales..." {...register("notas")} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Líneas de Productos</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ producto_id: "", cantidad: 1, precio_unitario: 0 })}>
            <Plus className="h-4 w-4 mr-2" /> Agregar Línea
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">SKU</TableHead>
                  <TableHead className="w-[30%]">Descripción</TableHead>
                  <TableHead className="w-[15%] text-right">Cant.</TableHead>
                  <TableHead className="w-[15%] text-right">Vr. Unit.</TableHead>
                  <TableHead className="w-[15%] text-right">Vr. Total</TableHead>
                  <TableHead className="w-[5%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const qty = watchItems[index]?.cantidad || 0;
                  const price = watchItems[index]?.precio_unitario || 0;
                  const lineSubtotal = qty * price;
                  
                  const selectedProductId = watchItems[index]?.producto_id;
                  const selectedProduct = (productoQuery.data?.data as any[])?.find(p => p.sligo_id === selectedProductId);

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`items.${index}.producto_id`}
                          render={({ field: { onChange, value } }) => (
                            <Popover 
                              open={openProductos[index]} 
                              onOpenChange={(isOpen) => setOpenProductos(prev => ({...prev, [index]: isOpen}))}
                            >
                              <PopoverTrigger 
                                className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-mono text-xs")}
                              >
                                  {value
                                    ? productoOptions?.find((opt) => opt.value === value)?.label || "Desconocido"
                                    : "Buscar SKU..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <Command
                                  shouldFilter={false}
                                >
                                  <CommandInput 
                                    placeholder="Buscar por SKU o Descripción..." 
                                    onValueChange={(val) => onSearchProducto(val)}
                                  />
                                  <CommandList>
                                    <CommandEmpty>No se encontró el producto.</CommandEmpty>
                                    <CommandGroup>
                                      {productoOptions?.map((opt) => {
                                        const prodInfo = (productoQuery.data?.data as any[])?.find(p => p.sligo_id === opt.value);
                                        return (
                                          <CommandItem
                                            key={opt.value}
                                            value={opt.value as string}
                                            onSelect={(currentValue) => {
                                              onChange(currentValue);
                                              setOpenProductos(prev => ({...prev, [index]: false}));
                                              // Auto-fill price
                                              const prod = (productoQuery.data?.data as any[])?.find((p: any) => p.sligo_id === currentValue);
                                              if (prod) {
                                                setValue(`items.${index}.precio_unitario`, prod.precio);
                                              }
                                            }}
                                          >
                                            <div className="flex flex-col">
                                              <div className="flex items-center">
                                                <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                                                <span className="font-mono text-xs font-semibold">{opt.label}</span>
                                              </div>
                                              <span className="text-xs text-muted-foreground ml-6 truncate max-w-[320px]">
                                                {prodInfo?.nombre}
                                              </span>
                                            </div>
                                          </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        {selectedProduct ? selectedProduct.nombre : <span className="text-muted-foreground italic">Seleccione un SKU</span>}
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          step="0.01"
                          min="0.01"
                          className="text-right h-8"
                          {...register(`items.${index}.cantidad`, { valueAsNumber: true })} 
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          step="0.01"
                          className="text-right h-8"
                          {...register(`items.${index}.precio_unitario`, { valueAsNumber: true })} 
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatMoney(lineSubtotal)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive h-8 w-8"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-3 border p-4 rounded-md bg-muted/20">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bruto</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (19%)</span>
                <span>{formatMoney(iva)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total a Pagar</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => list("cotizaciones")} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Cotización"}
            {!isSubmitting && <Save className="ml-2 h-4 w-4" />}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
