import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-20 max-w-lg mx-auto">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
