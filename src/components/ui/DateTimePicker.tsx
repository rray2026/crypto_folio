import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  value: string // ISO string or similar compatible with new Date()
  onChange: (value: string) => void
}

export function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const date = React.useMemo(() => new Date(value), [value])
  
  const setDate = (newDate: Date | undefined) => {
    if (!newDate) return
    const current = new Date(value)
    newDate.setHours(current.getHours())
    newDate.setMinutes(current.getMinutes())
    onChange(newDate.toISOString().slice(0, 16))
  }

  const setTime = (hours: number, minutes: number) => {
    const newDate = new Date(value)
    newDate.setHours(hours)
    newDate.setMinutes(minutes)
    onChange(newDate.toISOString().slice(0, 16))
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  return (
    <div className="flex gap-2 w-full">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "flex-1 h-11 justify-start text-left font-mono text-xs rounded-xl border-border/50",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-xl border-border/40 shadow-2xl" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            className="rounded-xl"
          />
        </PopoverContent>
      </Popover>

      <div className="flex bg-muted/30 rounded-xl border border-border/50 p-1 h-11 min-w-[120px]">
        <div className="flex-1 flex items-center justify-center">
            <Select 
                value={date.getHours().toString()} 
                onValueChange={(v) => setTime(parseInt(v), date.getMinutes())}
            >
                <SelectTrigger className="border-0 bg-transparent focus:ring-0 h-8 px-1 text-xs font-black">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] rounded-xl border-border/40 min-w-[70px]">
                    {hours.map((h) => (
                        <SelectItem key={h} value={h.toString()} className="font-mono text-xs">
                            {h.toString().padStart(2, '0')}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center text-muted-foreground font-black px-0.5">:</div>
        <div className="flex-1 flex items-center justify-center">
            <Select 
                value={date.getMinutes().toString()} 
                onValueChange={(v) => setTime(date.getHours(), parseInt(v))}
            >
                <SelectTrigger className="border-0 bg-transparent focus:ring-0 h-8 px-1 text-xs font-black">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] rounded-xl border-border/40 min-w-[70px]">
                    {minutes.map((m) => (
                        <SelectItem key={m} value={m.toString()} className="font-mono text-xs">
                            {m.toString().padStart(2, '0')}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>
    </div>
  )
}
