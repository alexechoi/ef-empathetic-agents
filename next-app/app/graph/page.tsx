import { AppSidebar } from "@/components/app-sidebar";
import { GraphView } from "@/components/graph-view";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { memoryGraph } from "@/lib/moments";

export default function GraphPage() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <header className="flex h-(--header-height) shrink-0 items-center border-b px-4 lg:px-6">
          <h1 className="text-base font-medium">Memory graph</h1>
          <span className="ml-auto text-sm text-muted-foreground">
            What he left behind, connected
          </span>
        </header>
        <GraphView graph={memoryGraph} />
      </SidebarInset>
    </SidebarProvider>
  );
}
