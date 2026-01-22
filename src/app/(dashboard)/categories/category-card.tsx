"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { deleteCategory, updateCategory } from "@/actions/categories";

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
    color: string;
  };
}

export function CategoryCard({ category }: CategoryCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this category? Transactions using this category will have their category removed."
      )
    ) {
      return;
    }

    setDeleting(true);
    await deleteCategory(category.id);
    setDeleting(false);
  }

  async function handleUpdate(formData: FormData) {
    setSaving(true);
    setError(null);

    const result = await updateCategory(category.id, formData);

    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditOpen(false);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${category.color}20` }}
            >
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            </div>
            <div>
              <h3 className="font-medium">{category.name}</h3>
              <Badge
                variant="secondary"
                className={`text-xs ${
                  category.type === "INCOME"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {category.type}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>Edit Category</SheetTitle>
            <SheetDescription>Update the category name or color.</SheetDescription>
          </SheetHeader>
          <form action={handleUpdate} className="space-y-4 px-4 pb-6">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`name-${category.id}`}>Category Name</Label>
              <Input
                id={`name-${category.id}`}
                name="name"
                defaultValue={category.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`color-${category.id}`}>Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`color-${category.id}`}
                  name="color"
                  type="color"
                  defaultValue={category.color}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  Click to choose a color
                </span>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
