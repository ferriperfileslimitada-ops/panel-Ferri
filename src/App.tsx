import { GitHubBanner, Refine, Authenticated } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { liveProvider } from "@refinedev/supabase";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import "./App.css";
import authProvider from "./providers/auth";
import { dataProvider } from "./providers/data";
import { supabaseClient } from "./providers/supabase-client";
import { Layout } from "@/components/layout";
import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { Productos } from "@/pages/productos";
import { Clientes } from "@/pages/clientes";
import { CotizacionesList } from "@/pages/cotizaciones/list";
import { CotizacionCreate } from "@/pages/cotizaciones/create";
import { CotizacionShow } from "@/pages/cotizaciones/show";
import { CotizacionEdit } from "@/pages/cotizaciones/edit";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <DevtoolsProvider>
          <Refine
            dataProvider={dataProvider}
            liveProvider={liveProvider(supabaseClient)}
            authProvider={authProvider}
            routerProvider={routerProvider}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              projectId: "aOCaIE-lRvyAL-FI8rGv",
            }}
            resources={[
              {
                name: "dashboard",
                list: "/",
                meta: { label: "Dashboard" }
              },
              {
                name: "productos",
                list: "/productos",
                meta: { label: "Productos" }
              },
              {
                name: "clientes",
                list: "/clientes",
                meta: { label: "Clientes" }
              },
              {
                name: "cotizaciones",
                list: "/cotizaciones",
                create: "/cotizaciones/create",
                edit: "/cotizaciones/edit/:id",
                show: "/cotizaciones/show/:id",
                meta: { label: "Cotizaciones" }
              },
              {
                name: "despachos",
                list: "/despachos",
                meta: { label: "Despachos" }
              },
              {
                name: "analitica",
                list: "/analitica",
                meta: { label: "Analítica" }
              }
            ]}
          >
            <Routes>
              <Route
                element={
                  <Authenticated
                    key="authenticated-inner"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <Layout>
                      <Outlet />
                    </Layout>
                  </Authenticated>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="/productos" element={<Productos />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/cotizaciones">
                  <Route index element={<CotizacionesList />} />
                  <Route path="create" element={<CotizacionCreate />} />
                  <Route path="edit/:id" element={<CotizacionEdit />} />
                  <Route path="show/:id" element={<CotizacionShow />} />
                </Route>
                <Route path="/despachos" element={<div>Despachos (En construcción)</div>} />
                <Route path="/analitica" element={<div>Analítica (En construcción)</div>} />
                <Route path="*" element={<div>Página no encontrada</div>} />
              </Route>
              <Route
                element={
                  <Authenticated key="authenticated-outer" fallback={<Outlet />}>
                    <CatchAllNavigate to="/" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<Login />} />
              </Route>
            </Routes>
            <RefineKbar />
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
          <DevtoolsPanel />
          <Toaster />
        </DevtoolsProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
