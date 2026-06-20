import { useTable, useUpdate } from "@refinedev/core";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Save, X, Edit2 } from "lucide-react";
import { toast } from "sonner";

export const Productos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<string>("");

  const { tableQuery, setFilters } = useTable({
    resource: "productos",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "stock", order: "asc" }] },
  });
  const { data, isLoading } = tableQuery;

  const { mutate: updateProduct } = useUpdate();

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
          { field: "nombre", operator: "contains", value: searchTerm },
          { field: "sku", operator: "contains", value: searchTerm },
        ],
      },
    ], "replace");
  };

  const handleEditClick = (id: string, currentStock: number) => {
    setEditingId(id);
    setEditStock(currentStock.toString());
  };

  const handleSaveClick = (id: string) => {
    const newStock = parseFloat(editStock);
    if (isNaN(newStock) || newStock < 0) {
      toast.error("Stock inválido");
      return;
    }

    updateProduct(
      {
        resource: "productos",
        id,
        values: {
          stock: newStock,
        },
      },
      {
        onSuccess: () => {
          toast.success("Stock actualizado exitosamente");
          setEditingId(null);
        },
        onError: (error) => {
          toast.error("Error al actualizar el stock: " + error.message);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
        <p className="text-muted-foreground">Gestiona el inventario y catálogo sincronizado con Siigo</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Listado de Productos</CardTitle>
          <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
            <Input 
              type="text" 
              placeholder="Buscar producto..." 
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
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre del Producto</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">Cargando productos...</TableCell></TableRow>
                ) : data?.data.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">No se encontraron productos.</TableCell></TableRow>
                ) : (
                  data?.data.map((producto) => (
                    <TableRow key={producto.sligo_id}>
                      <TableCell className="font-medium">{producto.sku}</TableCell>
                      <TableCell>{producto.nombre}</TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(producto.precio)}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === producto.sligo_id ? (
                          <Input
                            type="number"
                            className="w-24 text-right ml-auto"
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className={producto.stock <= 10 ? "text-destructive font-bold" : ""}>
                            {producto.stock}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {editingId === producto.sligo_id ? (
                          <div className="flex justify-center space-x-2">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleSaveClick(producto.sligo_id)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => handleEditClick(producto.sligo_id, producto.stock)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
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
