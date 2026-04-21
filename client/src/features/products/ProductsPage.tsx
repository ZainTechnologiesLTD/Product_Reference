import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { Product } from "../../../../drizzle/schema";
import { trpc } from "@/lib/trpc";
import { DataTable } from "@/components/DataTable";
import { getProductColumns } from "./columns";
import {
  ProductFormDialog,
  type ProductFormValues,
} from "./ProductFormDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Download, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { keepPreviousData } from "@tanstack/react-query";
import { StatsBar } from "@/components/StatsBar";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const LIST_SORT_IDS = [
  "name",
  "category",
  "reference",
  "status",
  "price",
  "createdAt",
  "updatedAt",
] as const;

type ProductListSortBy = (typeof LIST_SORT_IDS)[number];

function parseListSortBy(id: string | undefined): ProductListSortBy {
  if (id && (LIST_SORT_IDS as readonly string[]).includes(id)) {
    return id as ProductListSortBy;
  }
  return "createdAt";
}

export default function ProductsPage() {
  // Pagination & sorting state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [referenceFilter, setReferenceFilter] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const debouncedCategoryFilter = useDebounce(categoryFilter, 300);
  const debouncedRefFilter = useDebounce(referenceFilter, 300);
  const debouncedSkuFilter = useDebounce(skuFilter, 300);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [duplicateHighlightId, setDuplicateHighlightId] = useState<
    number | null
  >(null);
  const [autofillHighlightId, setAutofillHighlightId] = useState<number | null>(
    null
  );
  const [flashNewId, setFlashNewId] = useState<number | null>(null);

  // Row selection
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const utils = trpc.useUtils();

  // Build query params
  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      sortBy: parseListSortBy(sorting[0]?.id),
      sortOrder: (sorting[0]?.desc ? "desc" : "asc") as "asc" | "desc",
      search: debouncedSearch || undefined,
      category: debouncedCategoryFilter || undefined,
      status: statusFilter
        ? (statusFilter as "active" | "inactive" | "discontinued")
        : undefined,
      referenceContains: debouncedRefFilter || undefined,
      skuContains: debouncedSkuFilter || undefined,
    }),
    [
      page,
      pageSize,
      sorting,
      debouncedSearch,
      debouncedCategoryFilter,
      statusFilter,
      debouncedRefFilter,
      debouncedSkuFilter,
    ]
  );

  const { data, isLoading } = trpc.products.list.useQuery(queryParams, {
    placeholderData: keepPreviousData,
  });

  const createMutation = trpc.products.create.useMutation({
    onSuccess: data => {
      utils.products.list.invalidate();
      utils.products.stats.invalidate();
      toast.success(`Product created — reference ${data.reference}`);
      setFormOpen(false);
      setAutofillHighlightId(null);
      setDuplicateHighlightId(null);
      setFlashNewId(data.id);
      window.setTimeout(() => setFlashNewId(null), 2000);
    },
    onError: err => toast.error(err.message),
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.products.stats.invalidate();
      toast.success("Product updated successfully");
      setFormOpen(false);
      setEditProduct(null);
    },
    onError: err => toast.error(err.message),
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.products.stats.invalidate();
      toast.success("Product removed from catalog");
      setDeleteTarget(null);
    },
    onError: err => toast.error(err.message),
  });

  const bulkDeleteMutation = trpc.products.bulkDelete.useMutation({
    onSuccess: data => {
      utils.products.list.invalidate();
      utils.products.stats.invalidate();
      toast.success(`${data.deleted} products removed from catalog`);
      setRowSelection({});
    },
    onError: err => toast.error(err.message),
  });

  const columns = useMemo(
    () =>
      getProductColumns(
        {
          onEdit: product => {
            setEditProduct(product);
            setFormOpen(true);
          },
          onDuplicate: _product => {
            setEditProduct(null);
            setFormOpen(true);
          },
          onDelete: product => setDeleteTarget(product),
        },
        { searchQuery: debouncedSearch }
      ),
    [debouncedSearch]
  );

  const handleFormSubmit = useCallback(
    async (values: ProductFormValues) => {
      const tags = values.tags
        ? values.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : undefined;

      const { reference: _ref, ...fields } = values;

      if (editProduct) {
        await updateMutation.mutateAsync({
          id: editProduct.id,
          ...fields,
          tags,
        });
      } else {
        await createMutation.mutateAsync({ ...fields, tags });
      }
    },
    [editProduct, createMutation, updateMutation]
  );

  const selectedIds = Object.keys(rowSelection).map(Number);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const formatTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  };

  const handleExport = useCallback(
    async (format: "csv" | "xlsx" = "csv") => {
      const stamp = formatTimestamp();
      try {
        const statusExport = statusFilter
          ? (statusFilter as "active" | "inactive" | "discontinued")
          : undefined;

        const items = await utils.products.exportList.fetch({
          sortBy: queryParams.sortBy,
          sortOrder: queryParams.sortOrder,
          search: debouncedSearch || undefined,
          category: debouncedCategoryFilter || undefined,
          status: statusExport,
          referenceContains: debouncedRefFilter || undefined,
          skuContains: debouncedSkuFilter || undefined,
        });

        if (!items.length) {
          toast.error("No products match the current filters");
          return;
        }

        const rows = items.map(p => ({
          Name: p.name,
          Category: p.category,
          Reference: p.reference,
          SKU: p.sku ?? "",
          Price: p.price ?? "",
          Status: p.status,
          Description: p.description ?? "",
        }));

        if (format === "csv") {
          const headers = Object.keys(rows[0]!);
          const csvContent = [
            headers.join(","),
            ...rows.map(row =>
              headers
                .map(
                  h =>
                    `"${String(row[h as keyof typeof row] ?? "").replace(/"/g, '""')}"`
                )
                .join(",")
            ),
          ].join("\n");
          const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `products_export_${stamp}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`Exported ${items.length} rows as CSV`);
        } else {
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Products");
          XLSX.writeFile(wb, `products_export_${stamp}.xlsx`);
          toast.success(`Exported ${items.length} rows as Excel`);
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Export failed. Try again."
        );
      }
    },
    [
      utils,
      queryParams.sortBy,
      queryParams.sortOrder,
      debouncedSearch,
      debouncedCategoryFilter,
      statusFilter,
      debouncedRefFilter,
      debouncedSkuFilter,
    ]
  );

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditProduct(null);
        setFormOpen(true);
      }
      if (e.key === "Escape") {
        setSearch("");
        setCategoryFilter("");
        setReferenceFilter("");
        setSkuFilter("");
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const onDuplicateRow = useCallback((id: number | null) => {
    setDuplicateHighlightId(id);
  }, []);

  const onAutofillRow = useCallback((id: number | null) => {
    setAutofillHighlightId(id);
  }, []);

  const rowClassName = useCallback(
    (p: Product) =>
      cn(
        duplicateHighlightId === p.id &&
          "bg-destructive/10 border-l-4 border-l-destructive",
        autofillHighlightId === p.id &&
          "bg-amber-400/10 border-l-4 border-l-amber-400",
        flashNewId === p.id && "bg-green-500/15 transition-colors duration-500"
      ),
    [duplicateHighlightId, autofillHighlightId, flashNewId]
  );

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <StatsBar />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="Search name, category, reference… (Ctrl+K)"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Select
            value={statusFilter}
            onValueChange={v => {
              setStatusFilter(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => bulkDeleteMutation.mutate({ ids: selectedIds })}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedIds.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport("csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport("xlsx")}
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditProduct(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by category…"
          value={categoryFilter}
          onChange={e => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
        <Input
          placeholder="Filter by reference…"
          value={referenceFilter}
          onChange={e => {
            setReferenceFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
        <Input
          placeholder="Filter by SKU…"
          value={skuFilter}
          onChange={e => {
            setSkuFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
        <p className="text-xs text-muted-foreground">
          Column filters apply together with search and status.
        </p>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? pageSize}
        totalPages={data?.totalPages ?? 0}
        sorting={sorting}
        onSortingChange={s => {
          setSorting(s);
          setPage(1);
        }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        isLoading={isLoading}
        getRowClassName={rowClassName}
      />

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={open => {
          setFormOpen(open);
          if (!open) {
            setEditProduct(null);
            setDuplicateHighlightId(null);
            setAutofillHighlightId(null);
          }
        }}
        product={editProduct}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onDuplicateRow={onDuplicateRow}
        onAutofillRow={onAutofillRow}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{deleteTarget?.name}&quot; from
              the catalog? The row will be hidden and excluded from search; reference
              codes stay reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
