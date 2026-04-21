import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";

interface ProductSuggestion {
  id: number;
  name: string;
  category: string;
  reference: string;
}

interface ProductNameInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: ProductSuggestion) => void;
  onDuplicateRow?: (
    info: { productId: number; rowNumber?: number } | null
  ) => void;
  excludeId?: number;
  error?: string;
}

export function ProductNameInput({
  value,
  onChange,
  onSelectSuggestion,
  onDuplicateRow,
  excludeId,
  error,
}: ProductNameInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedValue = useDebounce(value, 300);

  const { data: suggestions, isLoading } = trpc.products.suggestions.useQuery(
    { searchTerm: debouncedValue, limit: 20 },
    { enabled: debouncedValue.length >= 2 }
  );

  const fuse = useMemo(
    () =>
      new Fuse(suggestions ?? [], {
        keys: ["name"],
        threshold: 0.45,
        ignoreLocation: true,
      }),
    [suggestions]
  );

  const rankedSuggestions = useMemo(() => {
    if (!suggestions?.length) return [];
    if (debouncedValue.length < 2) return suggestions;
    const ranked = fuse.search(debouncedValue).map(r => r.item);
    return ranked.length > 0 ? ranked : suggestions;
  }, [suggestions, debouncedValue, fuse]);

  const { data: duplicateCheck } = trpc.products.checkDuplicate.useQuery(
    { name: value, excludeId: excludeId },
    { enabled: value.length >= 2 }
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!rankedSuggestions?.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex(prev =>
            prev < rankedSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (
            highlightedIndex >= 0 &&
            rankedSuggestions[highlightedIndex]
          ) {
            const item = rankedSuggestions[highlightedIndex];
            onChange(item.name);
            onSelectSuggestion?.({
              id: item.id,
              name: item.name,
              category: item.category,
              reference: item.reference,
            });
            setOpen(false);
          }
          break;
        case "Escape":
          setOpen(false);
          break;
      }
    },
    [rankedSuggestions, highlightedIndex, onChange, onSelectSuggestion]
  );

  const handleSelect = useCallback(
    (item: ProductSuggestion) => {
      onChange(item.name);
      onSelectSuggestion?.(item);
      setOpen(false);
    },
    [onChange, onSelectSuggestion]
  );

  const showDuplicateWarning = !!duplicateCheck?.exists;

  useEffect(() => {
    if (!onDuplicateRow) return;
    const id = requestAnimationFrame(() => {
      if (duplicateCheck?.exists && duplicateCheck.productId != null) {
        onDuplicateRow({
          productId: duplicateCheck.productId,
          rowNumber: duplicateCheck.rowNumber,
        });
      } else {
        onDuplicateRow(null);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [duplicateCheck, onDuplicateRow]);

  return (
    <div className="relative">
      <Popover
        open={open}
        onOpenChange={v => {
          setOpen(v);
          setHighlightedIndex(-1);
        }}
      >
        <PopoverTrigger asChild>
          <Input
            ref={inputRef}
            value={value}
            onChange={e => {
              onChange(e.target.value);
              if (e.target.value.length >= 2) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => value.length >= 2 && setOpen(true)}
            placeholder="Enter product name..."
            className={cn(
              error || showDuplicateWarning
                ? "border-destructive focus-visible:ring-destructive"
                : "focus-visible:ring-amber-500"
            )}
          />
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] max-h-[300px] overflow-auto"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command>
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : rankedSuggestions.length === 0 ? (
              <CommandEmpty>No products found</CommandEmpty>
            ) : (
              <CommandGroup>
                <AnimatePresence>
                  {rankedSuggestions.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <CommandItem
                        value={item.name}
                        onSelect={() => handleSelect(item)}
                        className={cn(
                          "cursor-pointer",
                          index === highlightedIndex && "bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              index === highlightedIndex
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.category} · {item.reference}
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CommandGroup>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {showDuplicateWarning && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-6 left-0 flex items-center gap-1 text-xs text-destructive"
        >
          <AlertTriangle className="h-3 w-3" />
          <span>
            Product already exists at row #
            {duplicateCheck.rowNumber ?? "?"} ({duplicateCheck.reference})
          </span>
        </motion.div>
      )}
    </div>
  );
}
