// Accounts allowed to SEE the "Admin Panel" shortcut on the client dashboard.
//
// IMPORTANT: This list only controls whether the button is VISIBLE. It is not a
// security boundary. The admin panel itself is protected server-side:
//   • /admin (AdminDashboard) verifies the user's role in the `user_roles` table
//   • Supabase RLS gates all admin data by the `super_admin` / `manager` role
// So to make an account a *working* admin, it must have that role in the
// database — adding an email here alone is not enough (the panel would still
// show "Access Denied").
//
// To add or remove an admin later, just edit this list (emails are matched
// case-insensitively).
export const ADMIN_EMAILS: readonly string[] = [
  "spaholisma@gmail.com",
  "mariochenchen23@gmail.com",
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
