import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Product } from "../../../../drizzle/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductNameInput } from "@/components/ProductNameInput";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { previewReferenceCode } from "@shared/referencePreview";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.string().min(1, "Category is required").max(100),
  reference: z.string().max(5).optional().or(z.literal("")),
  sku: z.string().max(50).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  price: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "discontinued"]),
  tags: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  isSubmitting?: boolean;
  onDuplicateRow?: (productId: number | null) => void;
  onAutofillRow?: (productId: number | null) => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSubmit,
  isSubmitting,
  onDuplicateRow,
  onAutofillRow,
}: ProductFormDialogProps) {
  const isEdit = !!product;
  const [autofillBadge, setAutofillBadge] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? {
          name: product.name,
          category: product.category,
          reference: product.reference,
          sku: product.sku ?? "",
          description: product.description ?? "",
          price: product.price ?? "",
          status: product.status,
          tags: product.tags?.join(", ") ?? "",
        }
      : {
          name: "",
          category: "",
          reference: "",
          sku: "",
          description: "",
          price: "",
          status: "active" as const,
          tags: "",
        },
  });

  const categoryWatch = useWatch({ control: form.control, name: "category" });

  useEffect(() => {
    if (!open || isEdit) return;
    if (categoryWatch?.trim()) {
      form.setValue("reference", previewReferenceCode(categoryWatch));
    }
  }, [categoryWatch, isEdit, open, form]);

  // Reset form when opening for create vs edit (controlled dialog + different product).
  useEffect(() => {
    if (!open) return;
    if (product) {
      form.reset({
        name: product.name,
        category: product.category,
        reference: product.reference,
        sku: product.sku ?? "",
        description: product.description ?? "",
        price: product.price ?? "",
        status: product.status,
        tags: product.tags?.join(", ") ?? "",
      });
    } else {
      form.reset({
        name: "",
        category: "",
        reference: "",
        sku: "",
        description: "",
        price: "",
        status: "active",
        tags: "",
      });
    }
  }, [open, product, form]);

  const handleSuggestion = (suggestion: {
    id: number;
    name: string;
    category: string;
    reference: string;
  }) => {
    setAutofillBadge(true);
    onAutofillRow?.(suggestion.id);
    form.setValue("category", suggestion.category);
    form.setValue("reference", suggestion.reference);
  };

  const handleSubmit = form.handleSubmit(async values => {
    await onSubmit(values);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) setAutofillBadge(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[525px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product" : "Add Product"}
            {autofillBadge && !isEdit && (
              <span className="ml-2 text-xs text-amber-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Autofilled from existing product
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <ProductNameInput
                        value={field.value}
                        onChange={v => {
                          field.onChange(v);
                          if (!v) setAutofillBadge(false);
                        }}
                        onSelectSuggestion={handleSuggestion}
                        onDuplicateRow={info =>
                          onDuplicateRow?.(info?.productId ?? null)
                        }
                        excludeId={product?.id}
                        error={form.formState.errors.name?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <CategoryCombobox
                        value={field.value}
                        onChange={field.onChange}
                        error={form.formState.errors.category?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          isEdit ? undefined : "Preview — assigned on save"
                        }
                        {...field}
                        disabled={isEdit}
                        readOnly={!isEdit}
                        className={isEdit ? "bg-muted" : "bg-muted/50"}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {isEdit
                        ? "Reference is permanent."
                        : "Shown for convenience; the server assigns a unique code on create."}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="SKU (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="discontinued">
                          Discontinued
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="tag1, tag2, tag3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Product description (optional)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAutofillBadge(false);
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
