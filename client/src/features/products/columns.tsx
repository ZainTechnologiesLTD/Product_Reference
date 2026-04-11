import type { ColumnDef } from "@tanstack/react-table";
import type { Product } from "../../../../drizzle/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { getSelectColumn } from "@/components/DataTable";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  discontinued: "destructive",
};

export function getProductColumns(actions: {
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (product: Product) => void;
}): ColumnDef<Product, unknown>[] {
  return [
    getSelectColumn<Product>(),
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("category")}</Badge>
      ),
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
          {row.getValue("reference")}
        </code>
      ),
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => row.getValue("sku") || "—",
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Price
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const price = row.getValue("price") as string | null;
        if (!price) return "—";
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(price));
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={statusVariant[status] ?? "outline"}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return new Date(date).toLocaleDateString();
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onEdit(product)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onDuplicate(product)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => actions.onDelete(product)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
