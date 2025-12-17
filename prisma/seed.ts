import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.category.count();
  if (existing > 0) {
    console.log("Categories already exist, skipping seed");
    return;
  }

  const categories = [
    { name: "Salario", type: "INCOME" as const, color: "#22c55e" },
    { name: "Freelance", type: "INCOME" as const, color: "#10b981" },
    { name: "Inversiones", type: "INCOME" as const, color: "#14b8a6" },
    { name: "Otros Ingresos", type: "INCOME" as const, color: "#06b6d4" },
    { name: "Comida", type: "EXPENSE" as const, color: "#f43f5e" },
    { name: "Transporte", type: "EXPENSE" as const, color: "#ef4444" },
    { name: "Compras", type: "EXPENSE" as const, color: "#f97316" },
    { name: "Servicios", type: "EXPENSE" as const, color: "#eab308" },
    { name: "Entretenimiento", type: "EXPENSE" as const, color: "#a855f7" },
    { name: "Salud", type: "EXPENSE" as const, color: "#ec4899" },
    { name: "Otros Gastos", type: "EXPENSE" as const, color: "#6366f1" },
  ];

  await prisma.category.createMany({ data: categories });
  console.log("Seeded categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
