import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarViewType = "day" | "week" | "month";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarViewType;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarViewType) => void;
  onNewBooking: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
}

export function CalendarHeader({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onNewBooking,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
}: CalendarHeaderProps) {
  const navigate = (direction: "prev" | "next") => {
    const fn = direction === "prev"
      ? view === "day" ? subDays : view === "week" ? subWeeks : subMonths
      : view === "day" ? addDays : view === "week" ? addWeeks : addMonths;
    onDateChange(fn(currentDate, 1));
  };

  const label =
    view === "day"
      ? format(currentDate, "EEEE, MMMM d, yyyy")
      : view === "week"
      ? `Week of ${format(currentDate, "MMM d, yyyy")}`
      : format(currentDate, "MMMM yyyy");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="font-heading text-base font-medium text-foreground ml-2">{label}</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onNewBooking} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Booking
          </Button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["day", "week", "month"] as CalendarViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-body font-medium capitalize transition-colors",
                  view === v ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="treatment">Treatments</SelectItem>
            <SelectItem value="program">Programs</SelectItem>
            <SelectItem value="experience">Experiences</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
          {[
            { label: "Paid", color: "bg-emerald-500" },
            { label: "Pending", color: "bg-amber-500" },
            { label: "Confirmed", color: "bg-sky-500" },
            { label: "Completed", color: "bg-green-700" },
            { label: "Cancelled", color: "bg-rose-400" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
