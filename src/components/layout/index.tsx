import React, { PropsWithChildren } from "react";
import { useMenu, useLogout, useIsAuthenticated, useGetIdentity } from "@refinedev/core";
import { Link, Outlet } from "react-router";
import { LogOut, Package, Users, FileText, Truck, BarChart3, Menu as MenuIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeProvider } from "@/components/theme-provider";

const icons: Record<string, React.ReactNode> = {
  productos: <Package className="h-5 w-5" />,
  clientes: <Users className="h-5 w-5" />,
  cotizaciones: <FileText className="h-5 w-5" />,
  despachos: <Truck className="h-5 w-5" />,
  analitica: <BarChart3 className="h-5 w-5" />,
};

export const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const { menuItems, selectedKey } = useMenu();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ name: string; email: string }>();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">AdsBigger OS</h2>
          <p className="text-xs text-muted-foreground">Ferriperfiles</p>
        </div>
      </div>
      <div className="flex-1 py-6 space-y-1 px-4 overflow-y-auto">
        {menuItems.map((item) => (
          <Link
            key={item.key}
            to={item.route || "/"}
            className={buttonVariants({
              variant: selectedKey === item.key ? "secondary" : "ghost",
              className: "w-full justify-start mb-1"
            })}
          >
            {icons[item.name] || <div className="h-5 w-5" />}
            <span className="ml-3">{item.label}</span>
          </Link>
        ))}
      </div>
      
      <div className="px-4 py-2">
        <h3 className="mb-2 px-2 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
          Herramientas
        </h3>
        <Link
          to="/herramientas/procesar-factura"
          className={buttonVariants({
            variant: "ghost",
            className: "w-full justify-start mb-1"
          })}
        >
          <FileText className="h-5 w-5 mr-3" />
          Procesar Factura
        </Link>
      </div>

      <div className="p-4 border-t">
        <div className="mb-4 px-2">
          <p className="text-sm font-medium">{identity?.name || "Usuario"}</p>
          <p className="text-xs text-muted-foreground">{identity?.email}</p>
        </div>
        <Button variant="outline" className="w-full justify-start" onClick={() => logout()}>
          <LogOut className="h-5 w-5 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );

  return (
    <ThemeProvider defaultTheme="dark" storageKey="ferriperfiles-theme">
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
          <SidebarContent />
        </div>

        {/* Mobile Sidebar & Header */}
        <div className="flex flex-col flex-1 md:pl-64">
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <Sheet>
              <SheetTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Open sidebar</span>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
              {/* Header content, breadcrumbs, search, etc can go here */}
            </div>
          </header>

          <main className="flex-1">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};
