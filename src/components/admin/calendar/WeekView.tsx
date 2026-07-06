import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarBooking } from "./calendarUtils";
import { getStatusColor, getStatusBorder } from "./calendarUtils";

interface WeekViewProps {
  date: Date;
  bookings: CalendarBooking[];
  onBookingClick: (booking: CalendarBooking) => void;
  onSlotClick: (date: string, time: string) => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_MIN = 1;

export function WeekView({ date, bookings, onBookingClick, onSlotClick }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const today = new Date();

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border bg-muted/50">
        <div className="p-1" />
        {days.map((d) => (
          <div key={d.toISOString()} className={cn("text-center py-2 border-l border-border/50", isSameDay(d, today) && "bg-primary/5")}>
            <p className="text-[10px] text-muted-foreground uppercase">{format(d, "EEE")}</p>
            <p className={cn("text-sm font-heading font-medium", isSameDay(d, today) && "text-primary")}>{format(d, "d")}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[50px_repeat(7,1fr)]">
        {/* Time labels */}
        <div className="relative" style={{ height: (HOUR_END - HOUR_START) * 60 * PX_PER_MIN }}>
          {hours.map((hour) => (
            <div key={hour} className="absolute left-0 right-0" style={{ top: (hour - HOUR_START) * 60 * PX_PER_MIN }}>
              <span className="text-[10px] text-muted-foreground px-1">{format(new Date(2000, 0, 1, hour), "ha")}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const dayBookings = bookings.filter((b) => b.booking_date === dateStr);

          return (
            <div key={dateStr} className="relative border-l border-border/50" style={{ height: (HOUR_END - HOUR_START) * 60 * PX_PER_MIN }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-border/30 cursor-pointer hover:bg-muted/20 transition-colors"
                  style={{ top: (hour - HOUR_START) * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                  onClick={() => onSlotClick(dateStr, `${String(hour).padStart(2, "0")}:00`)}
                />
              ))}

              {dayBookings.map((b) => {
                const [h, m] = b.booking_time.split(":").map(Number);
                const topPx = ((h - HOUR_START) * 60 + m) * PX_PER_MIN;
                const heightPx = Math.max((b.duration_minutes || 60) * PX_PER_MIN, 20);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "absolute left-0.5 right-0.5 rounded border-l-2 px-1 py-0.5 cursor-pointer shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-card",
                      getStatusBorder(b.status)
                    )}
                    style={{ top: topPx, height: heightPx, zIndex: 10 }}
                    onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                  >
                    <p className="text-[10px] font-body font-medium text-foreground truncate leading-tight">
                      {b.guest_name || "Guest"}
                    </p>
                    {heightPx > 26 && (
                      <p className="text-[9px] text-muted-foreground truncate">
                        {b.service_title || ""}
                      </p>
                    )}
                    <span className={cn("absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full", getStatusColor(b.status))} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
