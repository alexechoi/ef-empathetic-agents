import { AppSidebar } from "@/components/app-sidebar";
import { MomentsScreen } from "@/components/moments-screen";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { memories, moments, plannerTrace, recentCalls } from "@/lib/moments";

export default function Page() {
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
        <SiteHeader />
        <MomentsScreen
          initialMoments={moments}
          trace={plannerTrace}
          initialMemories={memories}
          initialCalls={recentCalls}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
