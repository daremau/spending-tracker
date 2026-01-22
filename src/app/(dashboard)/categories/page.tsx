export const dynamic = "force-dynamic";

import { getCategories } from "@/actions/categories";
import { CategoryForm } from "./category-form";
import { CategoryCard } from "./category-card";

export default async function CategoriesPage() {
  const categories = await getCategories();

  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Categories</h2>
        <CategoryForm />
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No categories yet</p>
          <p className="text-sm">Create your first category to organize transactions</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Income Categories */}
          {incomeCategories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Income ({incomeCategories.length})
              </h3>
              <div className="space-y-2">
                {incomeCategories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            </div>
          )}

          {/* Expense Categories */}
          {expenseCategories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Expense ({expenseCategories.length})
              </h3>
              <div className="space-y-2">
                {expenseCategories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
