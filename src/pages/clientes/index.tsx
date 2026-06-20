import { useTable } from "@refinedev/core";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye } from "lucide-react";

export const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { tableQuery, setFilters } = useTable({
    resource: "clientes",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "name", order: "asc" }] },
  });

  const { data, isLoading: isPending } = tableQuery;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) {
      setFilters([], "replace");
      return;
    }

    setFilters([
      {
        operator: "or",
        value: [
          { field: "name", operator: "contains", value: searchTerm },
          { field: "identification", operator: "contains", value: searchTerm },
          { field: "Telefono", operator: "contains", value: searchTerm },
        ],
      },
    ], "replace");
  };



  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Directorio de Clientes</h1>
        <p className="text-muted-foreground">Listado de clientes sincronizado con Siigo</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Listado de Clientes</CardTitle>
          <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
            <Input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
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
                          className="h-8 w-8"
                          onClick={() => {
                            // TODO: Add view details modal
                          }}
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
    </div>
  );
};
