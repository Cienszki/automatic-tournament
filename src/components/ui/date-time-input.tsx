"use client"

// Date / time fields that always read dd.mm.rrrr and 24-hour gg:mm. The native <input type="date|
// time|datetime-local"> follows the browser's locale, so an English browser shows mm/dd/yyyy and
// AM/PM. These keep the native inputs' values ('yyyy-mm-dd', 'HH:mm', 'yyyy-mm-ddTHH:mm', local
// time), so the code around them stays the same; only `onChange` hands over the value itself.
// The text can be typed (21.10.2026, 21/10/26, 2110 2026 · 18, 1830, 18.30) or the date picked.

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { pl } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const pad = (n: number) => String(n).padStart(2, "0")

/** 'yyyy-mm-dd' → 'dd.mm.yyyy' ('' when unset or malformed) */
export function formatDateValue(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ""
}

/** Typed date → 'yyyy-mm-dd', or null. `final` (on blur) also accepts a 2-digit year. */
export function parseDateText(text: string, final = false): string | null {
  const t = text.trim()
  let d: number, mo: number, y: number
  const parts = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2}|\d{4})$/.exec(t)
  const digits = /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  if (parts) [d, mo, y] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
  else if (digits) [d, mo, y] = [Number(digits[1]), Number(digits[2]), Number(digits[3])]
  else return null
  if (y < 100) {
    if (!final) return null
    y += 2000
  }
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return `${y}-${pad(mo)}-${pad(d)}`
}

/** Typed time → 'HH:mm', or null. Accepts 18, 8:05, 18:30, 18.30, 1830. */
export function parseTimeText(text: string): string | null {
  const t = text.trim()
  const m = /^(\d{1,2})(?:[:.\s]?(\d{2}))?$/.exec(t) ?? /^(\d{1,2})[:.](\d)$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

const toDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}
const fromDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const asIs = (v: string) => v

/** The bordered box all three fields share (the shadcn Input look). */
const shell =
  "flex h-10 w-full items-center rounded-md border border-input bg-background text-base ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:text-sm"
const field = "h-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"

/**
 * Text state for a typed value: follows `value` when it changes from outside, keeps the text
 * while it is being typed, and snaps back to the value on blur.
 */
function useTyped(value: string, format: (v: string) => string, parse: (t: string, final: boolean) => string | null, onChange: (v: string) => void) {
  const [text, setText] = React.useState(() => format(value))
  const emitted = React.useRef(value)
  React.useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setText(format(value))
    }
  }, [value, format])
  const emit = (v: string) => {
    emitted.current = v
    if (v !== value) onChange(v)
  }
  return {
    text,
    onTextChange: (t: string) => {
      setText(t)
      if (!t.trim()) emit("")
      else {
        const v = parse(t, false)
        if (v) emit(v)
      }
    },
    onBlur: () => {
      const v = text.trim() ? parse(text, true) : ""
      if (v !== null) emit(v)
      setText(format(v ?? emitted.current))
    },
    set: (v: string) => {
      emit(v)
      setText(format(v))
    },
  }
}

interface BaseProps {
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  id?: string
  "aria-label"?: string
}

function DatePart({ value, onChange, disabled, id, min, max, ariaLabel, className }: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  min?: string
  max?: string
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const typed = useTyped(value, formatDateValue, parseDateText, onChange)
  const selected = toDate(value)
  const minD = min ? toDate(min) : undefined
  const maxD = max ? toDate(max) : undefined
  return (
    <div className={cn("flex h-full items-center", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd.mm.rrrr"
        aria-label={ariaLabel}
        disabled={disabled}
        value={typed.text}
        onChange={e => typed.onTextChange(e.target.value)}
        onBlur={typed.onBlur}
        className={cn(field, "w-[6rem] pl-3")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Wybierz datę z kalendarza"
            className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={pl}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected ?? minD}
            disabled={[...(minD ? [{ before: minD }] : []), ...(maxD ? [{ after: maxD }] : [])]}
            onSelect={d => {
              if (d) typed.set(fromDate(d))
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Date field: value 'yyyy-mm-dd' ('' when empty). */
export function DateInput({ value, onChange, className, disabled, id, min, max, ...rest }: BaseProps & { min?: string; max?: string }) {
  return (
    <div className={cn(shell, disabled && "opacity-50", className)}>
      <DatePart value={value} onChange={onChange} disabled={disabled} id={id} min={min} max={max}
        ariaLabel={rest["aria-label"]} className="w-full justify-between" />
    </div>
  )
}

function TimePart({ value, onChange, disabled, id, ariaLabel, className }: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  ariaLabel?: string
  className?: string
}) {
  const typed = useTyped(value, asIs, parseTimeText, onChange)
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="gg:mm"
      aria-label={ariaLabel}
      disabled={disabled}
      value={typed.text}
      onChange={e => typed.onTextChange(e.target.value)}
      onBlur={typed.onBlur}
      className={cn(field, "w-[4.25rem] px-3", className)}
    />
  )
}

/** 24-hour time field: value 'HH:mm' ('' when empty). */
export function TimeInput({ value, onChange, className, disabled, id, ...rest }: BaseProps) {
  return (
    <div className={cn(shell, disabled && "opacity-50", className)}>
      <TimePart value={value} onChange={onChange} disabled={disabled} id={id} ariaLabel={rest["aria-label"]} className="w-full" />
    </div>
  )
}

/**
 * Date + 24-hour time: value 'yyyy-mm-ddTHH:mm' in local time, like datetime-local — '' until
 * both halves are filled in.
 */
export function DateTimeInput({ value, onChange, className, disabled, id, min, max, ...rest }: BaseProps & { min?: string; max?: string }) {
  const split = (v: string): [string, string] => {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v)
    return m ? [m[1], m[2]] : ["", ""]
  }
  const [parts, setParts] = React.useState<[string, string]>(() => split(value))
  const emitted = React.useRef(value)
  React.useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setParts(split(value))
    }
  }, [value])
  const update = (date: string, time: string) => {
    setParts([date, time])
    const next = date && time ? `${date}T${time}` : ""
    emitted.current = next
    if (next !== value) onChange(next)
  }
  const label = rest["aria-label"]
  return (
    <div className={cn(shell, disabled && "opacity-50", className)}>
      <DatePart value={parts[0]} onChange={d => update(d, parts[1])} disabled={disabled} id={id}
        min={min?.slice(0, 10)} max={max?.slice(0, 10)} ariaLabel={label ? `${label} — data` : undefined} />
      <span className="h-5 w-px shrink-0 bg-border" />
      <TimePart value={parts[1]} onChange={t => update(parts[0], t)} disabled={disabled}
        ariaLabel={label ? `${label} — godzina` : undefined} className="flex-1" />
    </div>
  )
}
