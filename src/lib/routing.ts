/**
 * Returns the correct booking route based on service type.
 * Private services → /private-sessions
 * Group classes → /classes
 */
export function getBookingRoute(service: { type?: string | null; title?: string }) {
  if (
    service.type === "private" ||
    service.title === "Structural Balance" ||
    service.title === "Structural Balance Class"
  ) {
    return "/private-sessions";
  }
  return "/classes";
}
