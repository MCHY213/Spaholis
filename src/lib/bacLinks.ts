// BAC CompraClick deposit link routing for treatment bookings.
// $10 for facials (Organic Facials / Cosmolifting), $20 for all other
// standard paid treatments (Massage Therapy, Body Treatments, Holistic
// Therapy). Kept in a standalone module so the mapping can be covered by
// end-to-end tests without instantiating the full Booking page.

export const BAC_LINK_10 =
  "https://checkout.baccredomatic.com/YTNjNzIuYjY4Mzk0MjY3NzFjMTgwNjQxNzgzMDIwNjE2";
export const BAC_LINK_20 =
  "https://checkout.baccredomatic.com/Ni42NjExMGM0NTQxYTcwYjYxNzA2MTkxNzgzMDIwNjQw";

export type BacService = {
  title?: string | null;
  category?: string | null;
} | null | undefined;

export function isFacialService(service: BacService): boolean {
  const title = (service?.title || "").toLowerCase();
  const category = (service?.category || "").toLowerCase();
  return (
    category.includes("facial") ||
    title.includes("facial") ||
    title.includes("cosmolifting")
  );
}

export function getBacCompraClickLink(service: BacService): string {
  return isFacialService(service) ? BAC_LINK_10 : BAC_LINK_20;
}

export function getBacDepositAmount(service: BacService): number {
  return isFacialService(service) ? 10 : 20;
}
