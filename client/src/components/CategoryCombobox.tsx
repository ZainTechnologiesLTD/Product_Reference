import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, Plus, ChevronDown } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CategoryCombobox({
  value,
  onChange,
  error,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: categories,
    isLoading,
    refetch,
  } = trpc.categories.list.useQuery();

  const createMutation = trpc.categories.getOrCreate.useMutation({
    onSuccess: data => {
      onChange(data.name);
      setOpen(false);
      setIsCreating(false);
      refetch();
    },
  });

  const filteredCategories = categories?.filter(cat =>
    cat.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = categories?.find(
    cat => cat.name.toLowerCase() === inputValue.toLowerCase()
  );

  const handleSelect = useCallback(
    (category: Category) => {
      onChange(category.name);
      setOpen(false);
    },
    [onChange]
  );

  const handleCreate = useCallback(() => {
    if (inputValue.trim() && !exactMatch) {
      setIsCreating(true);
      createMutation.mutate({ name: inputValue.trim() });
    }
  }, [inputValue, exactMatch, createMutation]);

  return (
    <div className="relative">
      <Popover
        open={open}
        onOpenChange={v => {
          setOpen(v);
          if (v) setInputValue(value);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              error && "border-destructive"
            )}
          >
            {value || "Select category..."}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command>
            <CommandInput
              placeholder="Search or create category..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={e => {
                if (e.key === "Enter" && inputValue.trim()) {
                  if (exactMatch) {
                    handleSelect(exactMatch);
                  } else {
                    handleCreate();
                  }
                }
              }}
            />
            <CommandList>
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : filteredCategories?.length === 0 && !inputValue ? (
                <CommandEmpty>No categories yet</CommandEmpty>
              ) : (
                <CommandGroup heading="Categories">
                  {filteredCategories?.map(category => (
                    <CommandItem
                      key={category.id}
                      value={category.name}
                      onSelect={() => handleSelect(category)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === category.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {category.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            {!exactMatch && inputValue.trim() && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={handleCreate}
                  disabled={isCreating}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create &quot;{inputValue.trim()}&quot;
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
