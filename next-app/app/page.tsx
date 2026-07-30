import { AppSidebar } from "@/components/app-sidebar";
import { MomentFeed } from "@/components/moments/moment-feed";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { moments } from "@/lib/moments";

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
        <div className="flex flex-1 gap-6 p-4 lg:p-6">
          <div className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-2xl">
              <MomentFeed moments={moments} />
            </div>
          </div>
          {/* Rail slot — Dad panel lands here in commit 3. */}
          <aside className="hidden w-80 shrink-0 xl:block" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
