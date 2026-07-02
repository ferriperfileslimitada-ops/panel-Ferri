import { useTable } from "@refinedev/core";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye, Building2, MapPin, Phone, Mail, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);

  const { tableQuery, setFilters } = useTable({
    resource: "clientes",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "name", order: "asc" }] },
  });

  const { data, isLoading: isPending } = tableQuery;

  // Debounce for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Apply filters when debounced search changes
  useEffect(() => {
    if (!debouncedSearch) {
      setFilters([], "replace");
      return;
    }

    setFilters([
      {
        operator: "or",
        value: [
          { field: "name", operator: "contains", value: debouncedSearch },
          { field: "identification", operator: "contains", value: debouncedSearch },
          { field: "Telefono", operator: "contains", value: debouncedSearch },
          { field: "email", operator: "contains", value: debouncedSearch },
          { field: "city", operator: "contains", value: debouncedSearch }
        ],
      },
    ], "replace");
  }, [debouncedSearch, setFilters]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Directorio de Clientes</h1>
        <p className="text-muted-foreground">Listado de clientes sincronizado con Siigo</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Listado de Clientes</CardTitle>
          <div className="flex w-full max-w-sm items-center space-x-2 relative">
            <Input 
              type="text" 
              placeholder="Escribe para buscar (nombre, NIT, email...)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
            <Search className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificación</TableHead>
                  <TableHead>Nombre / Razón Social</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10">Cargando clientes...</TableCell></TableRow>
                ) : data?.data.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10">No se encontraron clientes.</TableCell></TableRow>
                ) : (
                  data?.data.map((cliente: any) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.identification}</TableCell>
                      <TableCell>{cliente.name}</TableCell>
                      <TableCell>{cliente.city}</TableCell>
                      <TableCell>{cliente.email}</TableCell>
                      <TableCell>{cliente.Telefono}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => setSelectedCliente(cliente)}
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

      {/* Modal Ficha Cliente */}
      <Dialog open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedCliente?.name}
            </DialogTitle>
            <DialogDescription>
              Ficha completa del cliente
            </DialogDescription>
          </DialogHeader>
          
          {selectedCliente && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Correo Electrónico
                  </span>
                  <span className="font-medium truncate" title={selectedCliente.email}>{selectedCliente.email || 'N/A'}</span>
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
