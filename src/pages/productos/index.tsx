import { useTable, useUpdate, useCreate } from "@refinedev/core";
import { useState, useMemo, useEffect } from "react";
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

  const { tableQuery, currentPage, setCurrentPage, pageCount, setFilters } = useTable({
    resource: "productos",
    pagination: { pageSize: 20 },
    sorters: { initial: [{ field: "stock", order: "asc" }] },
  });
  const { data, isLoading } = tableQuery;

  const { mutate: updateProduct } = useUpdate();
  const { mutate: createProduct } = useCreate();

  // Server-side filtering with debounce
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setFilters([], "replace");
    } else {
      setFilters([
        {
          operator: "or",
          value: [
            { field: "nombre", operator: "contains", value: debouncedSearch.trim() },
            { field: "code", operator: "contains", value: debouncedSearch.trim() },
          ],
        },
      ], "replace");
      setCurrentPage(1); // Reset page on search
    }
  }, [debouncedSearch, setFilters, setCurrentPage]);

  const filteredData = data?.data || [];
  const totalProductos = data?.total || 0;

  const handleEditClick = (producto: any) => {
    setEditingId(producto.supa_id);
    setEditStock(String(producto.stock ?? ""));
    setEditPrecio(String(producto.precio ?? ""));
  };

  const API_URL = import.meta.env.VITE_API_URL || (window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin);

  const handleSaveClick = async (id: string) => {
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

    try {
      const response = await fetch(`${API_URL}/api/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, precio: newPrecio })
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success("Producto actualizado en Siigo y Supabase ✅");
      setEditingId(null);
    } catch (error: any) {
      toast.error("Error al actualizar: " + error.message);
    }
  };

  const handleCreateProduct = async () => {
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

    try {
      const response = await fetch(`${API_URL}/api/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: newProduct.sku.trim(),
          nombre: newProduct.nombre.trim(),
          precio,
          stock,
        })
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success("Producto creado en Siigo y Supabase ✅");
      setShowCreate(false);
      setNewProduct({ sku: "", nombre: "", precio: "", stock: "" });
    } catch (error: any) {
      toast.error("Error al crear producto: " + error.message);
    }
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(v);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-muted-foreground">Gestiona el inventario y catálogo sincronizado con Siigo</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 pb-4">
          <CardTitle className="text-base sm:text-lg">Listado de Productos</CardTitle>
          <div className="relative w-full sm:max-w-sm">
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
        <CardContent className="px-2 sm:px-6">
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[550px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">SKU</TableHead>
                  <TableHead className="whitespace-nowrap">Nombre del Producto</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Precio</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Stock</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">Cargando productos...</TableCell></TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">{searchTerm ? "Sin resultados para esta búsqueda." : "No se encontraron productos."}</TableCell></TableRow>
                ) : (
                  filteredData.map((producto: any) => (
                    <TableRow key={producto.supa_id}>
                      <TableCell className="font-medium">{producto.code || producto.sku || "-"}</TableCell>
                      <TableCell>{producto.nombre}</TableCell>
                      <TableCell className="text-right">
                        {editingId && editingId === producto.supa_id ? (
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
                        {editingId && editingId === producto.supa_id ? (
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
                        {editingId && editingId === producto.supa_id ? (
                          <div className="flex justify-center space-x-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleSaveClick(producto.supa_id)}
                            >
                              <Save className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4 text-red-600" />
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

          {/* Paginación */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-4 pt-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {pageCount} ({totalProductos} productos en total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === pageCount}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
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
