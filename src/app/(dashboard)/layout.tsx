import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-60">
        <Header />
        <main className="pb-20 md:pb-10 mx-auto w-full max-w-lg md:max-w-none">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
