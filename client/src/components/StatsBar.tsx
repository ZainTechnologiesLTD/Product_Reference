import { trpc } from "@/lib/trpc";
import { Package, FolderOpen, Clock } from "lucide-react";
import { useMemo } from "react";
export function StatsBar() {
  const { data: stats } = trpc.products.stats.useQuery();

  const formattedStats = useMemo(() => {
    if (!stats) return null;

    return {
      totalProducts: stats.totalProducts.toLocaleString(),
      totalCategories: stats.totalCategories.toLocaleString(),
      lastProduct: stats.lastProduct
        ? `"${stats.lastProduct.name}" (${stats.lastProduct.reference})`
        : null,
    };
  }, [stats]);

  if (!formattedStats) return null;

  return (
    <div className="flex items-center gap-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4" />
        <span>
          <span className="font-medium text-foreground">
            {formattedStats.totalProducts}
          </span>{" "}
          Products
        </span>
      </div>
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4" />
        <span>
          <span className="font-medium text-foreground">
            {formattedStats.totalCategories}
          </span>{" "}
          Categories
        </span>
      </div>
      {formattedStats.lastProduct && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Last: {formattedStats.lastProduct}</span>
        </div>
      )}
    </div>
  );
}
