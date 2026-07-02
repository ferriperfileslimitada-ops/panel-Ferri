import { useTable, useUpdate } from "@refinedev/core";
import { useState, useMemo } from "react";
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

  const { tableQuery } = useTable({
    resource: "productos",
    pagination: { pageSize: 200 },
    sorters: { initial: [{ field: "stock", order: "asc" }] },
  });
  const { data, isLoading } = tableQuery;

  const { mutate: updateProduct } = useUpdate();

  // Filtrado local case-insensitive
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!searchTerm.trim()) return data.data;

    const term = searchTerm.toLowerCase().trim();
    return data.data.filter((p: any) => {
      const nombre = String(p.nombre || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      const precio = String(p.precio || "");
      const stock = String(p.stock || "");
      return nombre.includes(term) || sku.includes(term) || precio.includes(term) || stock.includes(term);
    });
  }, [data?.data, searchTerm]);

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
          <div className="flex w-full max-w-sm items-center space-x-2 relative">
            <Input 
              type="text" 
              placeholder="Buscar por nombre, SKU, precio..." 
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
                ) : filteredData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">{searchTerm ? "Sin resultados para esta búsqueda." : "No se encontraron productos."}</TableCell></TableRow>
                ) : (
                  filteredData.map((producto: any) => (
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
