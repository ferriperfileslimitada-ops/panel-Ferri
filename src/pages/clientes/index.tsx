import { useTable } from "@refinedev/core";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Building2, MapPin, Phone, Mail, Hash, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);

  const { tableQuery } = useTable({
    resource: "clientes",
    pagination: { pageSize: 10000 },
    sorters: { initial: [{ field: "name", order: "asc" }] },
  });

  const { data, isLoading: isPending } = tableQuery;

  // Filtrado local case-insensitive
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!searchTerm.trim()) return data.data;

    const term = searchTerm.toLowerCase().trim();
    return data.data.filter((c: any) => {
      const name = String(c.name || "").toLowerCase();
      const identification = String(c.identification || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      const city = String(c.city || "").toLowerCase();
      const telefono = String(c.Telefono || c.telefono || "").toLowerCase();
      const address = String(c.address || "").toLowerCase();
      return name.includes(term) || identification.includes(term) || email.includes(term) || city.includes(term) || telefono.includes(term) || address.includes(term);
    });
  }, [data?.data, searchTerm]);

  const totalClientes = data?.data?.length || 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 px-2 sm:px-0">
      {/* Header responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Directorio de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {isPending ? "Cargando..." : `${totalClientes} clientes sincronizados con Siigo`}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 pb-4">
          <CardTitle className="text-base sm:text-lg">Listado de Clientes</CardTitle>
          <div className="relative w-full sm:max-w-sm">
            <Input 
              type="text" 
              placeholder="Buscar por nombre, NIT, email, ciudad..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
            <Search className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {/* Contador de resultados */}
          {searchTerm && !isPending && (
            <p className="text-sm text-muted-foreground mb-3">
              {filteredData.length} resultado{filteredData.length !== 1 ? "s" : ""} encontrado{filteredData.length !== 1 ? "s" : ""}
            </p>
          )}

          {/* Tabla responsive con scroll horizontal */}
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Identificación</TableHead>
                  <TableHead className="whitespace-nowrap">Nombre / Razón Social</TableHead>
                  <TableHead className="whitespace-nowrap">Ciudad</TableHead>
                  <TableHead className="whitespace-nowrap hidden sm:table-cell">Email</TableHead>
                  <TableHead className="whitespace-nowrap hidden md:table-cell">Teléfono</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2">
                      <Users className="h-5 w-5 animate-pulse" />
                      Cargando todos los clientes...
                    </div>
                  </TableCell></TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10">{searchTerm ? "Sin resultados para esta búsqueda." : "No se encontraron clientes."}</TableCell></TableRow>
                ) : (
                  filteredData.map((cliente: any) => (
                    <TableRow key={cliente.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCliente(cliente)}>
                      <TableCell className="font-medium text-xs sm:text-sm">{cliente.identification}</TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-[200px] truncate">{cliente.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{cliente.city || "-"}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden sm:table-cell truncate max-w-[180px]">{cliente.email || "-"}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden md:table-cell">{cliente.Telefono || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={(e) => { e.stopPropagation(); setSelectedCliente(cliente); }}
                          title="Ver ficha completa"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Modal Ficha Cliente - Responsive */}
      <Dialog open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{selectedCliente?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Ficha completa del cliente
            </DialogDescription>
          </DialogHeader>
          
          {selectedCliente && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Identificación (NIT/CC)
                  </span>
                  <span className="font-medium">{selectedCliente.identification || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Tipo
                  </span>
                  <span className="font-medium capitalize">{selectedCliente.tipo || 'Desconocido'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Correo Electrónico
                  </span>
                  <span className="font-medium text-sm break-all">{selectedCliente.email || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Teléfono
                  </span>
                  <span className="font-medium">{selectedCliente.Telefono || selectedCliente.telefono || 'N/A'}</span>
                </div>
              </div>

              <div className="grid gap-4 border-t pt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Ciudad / Dirección
                  </span>
                  <span className="font-medium">
                    {selectedCliente.city ? selectedCliente.city : ''}
                    {selectedCliente.address ? ` - ${selectedCliente.address}` : ''}
                    {(!selectedCliente.city && !selectedCliente.address) ? 'N/A' : ''}
                  </span>
                </div>
                
                {selectedCliente.contact_name && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Contacto Principal</span>
                    <span className="font-medium">{selectedCliente.contact_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
