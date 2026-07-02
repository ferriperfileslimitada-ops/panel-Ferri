import { useTable, useUpdate, useCreate } from "@refinedev/core";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Save, X, Edit2, Plus, Package } from "lucide-react";
import { toast } from "sonner";

export const Productos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newProduct, setNewProduct] = useState({ sku: "", nombre: "", precio: "", stock: "" });

  const { tableQuery } = useTable({
    resource: "productos",
    pagination: { pageSize: 200 },
    sorters: { initial: [{ field: "stock", order: "asc" }] },
  });
  const { data, isLoading } = tableQuery;

  const { mutate: updateProduct } = useUpdate();
  const { mutate: createProduct } = useCreate();

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

  const handleEditClick = (producto: any) => {
    setEditingId(producto.sligo_id);
    setEditStock(String(producto.stock ?? ""));
    setEditPrecio(String(producto.precio ?? ""));
  };

  const handleSaveClick = (id: string) => {
    const newStock = parseFloat(editStock);
    const newPrecio = parseFloat(editPrecio);

    if (isNaN(newStock) || newStock < 0) {
      toast.error("Stock inválido");
      return;
    }
    if (isNaN(newPrecio) || newPrecio < 0) {
      toast.error("Precio inválido");
      return;
    }

    updateProduct(
      {
        resource: "productos",
        id,
        values: { stock: newStock, precio: newPrecio },
      },
      {
        onSuccess: () => {
          toast.success("Producto actualizado en Supabase ✅");
          setEditingId(null);
        },
        onError: (error) => {
          toast.error("Error al actualizar: " + error.message);
        },
      }
    );
  };

  const handleCreateProduct = () => {
    const precio = parseFloat(newProduct.precio);
    const stock = parseFloat(newProduct.stock);

    if (!newProduct.sku.trim() || !newProduct.nombre.trim()) {
      toast.error("SKU y Nombre son obligatorios");
      return;
    }
    if (isNaN(precio) || precio < 0) {
      toast.error("Precio inválido");
      return;
    }
    if (isNaN(stock) || stock < 0) {
      toast.error("Stock inválido");
      return;
    }

    createProduct(
      {
        resource: "productos",
        values: {
          sku: newProduct.sku.trim(),
          nombre: newProduct.nombre.trim(),
          precio,
          stock,
        },
      },
      {
        onSuccess: () => {
          toast.success("Producto creado en Supabase ✅");
          setShowCreate(false);
          setNewProduct({ sku: "", nombre: "", precio: "", stock: "" });
        },
        onError: (error) => {
          toast.error("Error al crear producto: " + error.message);
        },
      }
    );
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(v);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-muted-foreground">Gestiona el inventario y catálogo sincronizado con Siigo</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
        </Button>
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
                        {editingId === producto.sligo_id ? (
                          <Input
                            type="number"
                            className="w-28 text-right ml-auto"
                            value={editPrecio}
                            onChange={(e) => setEditPrecio(e.target.value)}
                          />
                        ) : (
                          formatMoney(producto.precio)
                        )}
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
                            onClick={() => handleEditClick(producto)}
                            title="Editar precio y stock"
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

      {/* Modal Crear Producto */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Package className="h-5 w-5 text-primary" /> Nuevo Producto
            </DialogTitle>
            <DialogDescription>
              Se creará directamente en Supabase
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="np-sku">SKU *</Label>
              <Input
                id="np-sku"
                placeholder="Ej: PERF-001"
                value={newProduct.sku}
                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-nombre">Nombre del Producto *</Label>
              <Input
                id="np-nombre"
                placeholder="Ej: Perfil de aluminio 6m"
                value={newProduct.nombre}
                onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="np-precio">Precio (COP)</Label>
                <Input
                  id="np-precio"
                  type="number"
                  placeholder="0"
                  value={newProduct.precio}
                  onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="np-stock">Stock Inicial</Label>
                <Input
                  id="np-stock"
                  type="number"
                  placeholder="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateProduct}>
              <Plus className="mr-2 h-4 w-4" /> Crear Producto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
