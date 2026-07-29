import Link from "next/link";
import { BarChart3, FileSpreadsheet, Tags } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const destinations = [
  {
    href: "/categories",
    title: "Categories",
    description: "Manage income and expense categories",
    icon: Tags,
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Review income and spending trends",
    icon: BarChart3,
  },
];

export default function MorePage() {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">More</h1>
        <p className="text-sm text-muted-foreground">
          Additional tools and settings.
        </p>
      </div>
      <div className="space-y-3">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <Link key={destination.href} href={destination.href}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-medium">{destination.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {destination.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full bg-primary/10 p-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-medium">Backup</h2>
              <p className="text-sm text-muted-foreground">
                Export and import remain available from the page header.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
