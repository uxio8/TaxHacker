"use client"

import { format, startOfMonth, startOfQuarter, subMonths, subWeeks } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function DateRangePicker({
  defaultDate,
  defaultRange = "all-time",
  onChange,
}: {
  defaultDate?: DateRange
  defaultRange?: string
  onChange?: (date: DateRange | undefined) => void
}) {
  const { t } = useI18n()
  const predefinedRanges = [
    {
      code: "last-4-weeks",
      label: t("dateRange.last4Weeks"),
      range: { from: subWeeks(new Date(), 4), to: new Date() },
    },
    {
      code: "last-12-months",
      label: t("dateRange.last12Months"),
      range: { from: subMonths(new Date(), 12), to: new Date() },
    },
    {
      code: "month-to-date",
      label: t("dateRange.monthToDate"),
      range: { from: startOfMonth(new Date()), to: new Date() },
    },
    {
      code: "quarter-to-date",
      label: t("dateRange.quarterToDate"),
      range: { from: startOfQuarter(new Date()), to: new Date() },
    },
    {
      code: `${new Date().getFullYear()}`,
      label: `${new Date().getFullYear()}`,
      range: {
        from: new Date(new Date().getFullYear(), 0, 1),
        to: new Date(),
      },
    },
    {
      code: `${new Date().getFullYear() - 1}`,
      label: `${new Date().getFullYear() - 1}`,
      range: {
        from: new Date(new Date().getFullYear() - 1, 0, 1),
        to: new Date(new Date().getFullYear(), 0, 1),
      },
    },
    {
      code: "all-time",
      label: t("dateRange.allTime"),
      range: { from: undefined, to: undefined },
    },
  ]

  const [rangeName, setRangeName] = useState<string>(defaultDate?.from ? "custom" : defaultRange)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDate)

  useEffect(() => {
    if (!defaultDate?.from) {
      setRangeName(defaultRange)
      setDateRange(undefined)
    }
  }, [defaultDate, defaultRange])

  const getDisplayText = () => {
    if (rangeName === "custom") {
      if (dateRange?.from) {
        return dateRange.to
          ? `${format(dateRange.from, "dd/MM/y")} - ${format(dateRange.to, "dd/MM/y")}`
          : format(dateRange.from, "dd/MM/y")
      }
      return t("dateRange.selectDates")
    }
    return predefinedRanges.find((range) => range.code === rangeName)?.label || t("dateRange.selectDates")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant={"outline"}
          className={cn(
            "w-auto min-w-[130px] justify-start text-left font-normal",
            rangeName === "all-time" && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-row gap-3 w-auto p-0" align="end">
        <div className="flex flex-col gap-3 p-3 border-r">
          {predefinedRanges.map(({ code, label }) => (
            <Button
              key={code}
              variant="ghost"
              className="justify-start pr-5"
              onClick={() => {
                setRangeName(code)
                const newDateRange = predefinedRanges.find((range) => range.code === code)?.range
                setDateRange(newDateRange)
                onChange?.(newDateRange)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={(newDateRange) => {
            setRangeName("custom")
            setDateRange(newDateRange)
            onChange?.(newDateRange)
          }}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
