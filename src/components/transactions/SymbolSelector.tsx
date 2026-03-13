import * as React from "react"
import { Check, ChevronsUpDown, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useSettingsStore } from "@/store/useSettingsStore"

interface SymbolSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function SymbolSelector({ value, onChange }: SymbolSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const predefinedPairs = useSettingsStore((state) => state.predefinedPairs)
  const [searchValue, setSearchValue] = React.useState("")

  const commonAssets = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-11 rounded-xl border-border/50 px-3 font-bold tracking-tight text-base"
          >
            {value ? value : "Select or type symbol..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-border/40 shadow-2xl" align="start">
          <Command className="rounded-xl">
            <CommandInput 
              placeholder="Search or enter custom..." 
              value={searchValue}
              onValueChange={(val) => {
                setSearchValue(val.toUpperCase())
                // Optionally allow typing to directly update value if no matches favored
              }}
            />
            <CommandList className="max-h-[220px]">
              <CommandEmpty className="p-4 py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">No matching assets found.</p>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="w-full h-10 rounded-lg font-bold gap-2"
                  onClick={() => {
                    onChange(searchValue)
                    setOpen(false)
                    setSearchValue("")
                  }}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  Use "{searchValue}"
                </Button>
              </CommandEmpty>
              <CommandGroup heading="Suggestions">
                {predefinedPairs.map((pair) => (
                  <CommandItem
                    key={pair}
                    value={pair}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? "" : currentValue)
                      setOpen(false)
                    }}
                    className="flex justify-between items-center py-2.5 px-3 rounded-lg"
                  >
                    <span className="font-bold">{pair}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 text-primary",
                        value === pair ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick Picks for Mobile */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {commonAssets.map(asset => (
          <button
            key={asset}
            type="button"
            onClick={() => onChange(asset)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${
              value === asset 
              ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20" 
              : "bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            {asset.split('/')[0]}
          </button>
        ))}
        <div className="px-3 py-1.5 rounded-full text-[10px] font-bold border border-dashed border-border/50 bg-background/50 text-muted-foreground/30 flex items-center gap-1">
          <Search className="h-2.5 w-2.5 opacity-40" />
          Filterable
        </div>
      </div>
    </div>
  )
}
