import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarBooking } from "./calendarUtils";
import { getStatusColor } from "./calendarUtils";

interface MonthViewProps {
  date: Date;
  bookings: CalendarBooking[];
  onBookingClick: (booking: CalendarBooking) => void;
  onSlotClick: (date: string, time: string) => void;
  onDayClick: (date: Date) => void;
}

export function MonthView({ date, bookings, onBookingClick, onSlotClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let current = calStart;
  while (current <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(current);
      current = addDays(current, 1);
    }
    weeks.push(week);
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center py-2 text-xs font-body font-medium text-muted-foreground uppercase">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-0">
          {week.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayBookings = bookings.filter((b) => b.booking_date === dateStr);
            const inMonth = isSameMonth(day, date);

            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[90px] border-r border-border/30 last:border-0 p-1 cursor-pointer hover:bg-muted/20 transition-colors",
                  !inMonth && "bg-muted/10"
                )}
                onClick={() => onDayClick(day)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn(
                    "text-xs font-body",
                    !inMonth && "text-muted-foreground/50",
                    isToday(day) && "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="text-[9px] text-muted-foreground">{dayBookings.length}</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayBookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5"
                      onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusColor(b.status))} />
                      <span className="text-[10px] text-foreground truncate">{b.guest_name || "Guest"}</span>
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <p className="text-[9px] text-muted-foreground pl-3">+{dayBookings.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
