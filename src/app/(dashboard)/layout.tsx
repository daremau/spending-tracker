import { getCurrencyConfiguration } from "@/actions/settings";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currencyConfiguration = await getCurrencyConfiguration();
  const portfolioEnabled = process.env.PORTFOLIO_ENABLED === "true";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar portfolioEnabled={portfolioEnabled} />
      <div className="md:pl-60">
        <Header currencyConfiguration={currencyConfiguration} />
        <main className="pb-20 md:pb-10 mx-auto w-full max-w-lg md:max-w-none">
          {children}
        </main>
      </div>
      <MobileNav portfolioEnabled={portfolioEnabled} />
    </div>
  );
}
