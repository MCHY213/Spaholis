import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Link2, CheckCircle2, Clock, AlertCircle, XCircle, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";

type LinkRow = {
  id: string;
  url: string;
  amount: number;
  status: "available" | "assigned" | "used" | "void";
  assigned_booking_id: string | null;
  assigned_at: string | null;
  used_at: string | null;
  created_at: string;
  times_used: number | null;
};

type CountRow = {
  amount: number;
  available: number;
  assigned: number;
  used: number;
  void: number;
  total: number;
};

type ClaimRow = {
  id: string;
  amount: number;
  created_at: string;
  booking_id: string | null;
  bookings: {
    id: string;
    status: string | null;
    coupon_code: string | null;
    guest_name: string | null;
    guest_email: string | null;
  } | null;
};

const EMPTY_COUNT = { available: 0, assigned: 0, used: 0, void: 0, total: 0 };
// BAC CompraClick links are reusable — the same shared URL handles many
// bookings — so we treat each tier as effectively unlimited (9,999 capacity).
const REUSABLE_CAPACITY = 9999;

export const AdminBacLinks = () => {
  const [counts, setCounts] = useState<Record<number, Omit<CountRow, "amount">>>({
    10: { ...EMPTY_COUNT },
    20: { ...EMPTY_COUNT },
  });
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [recon, setRecon] = useState<Array<{ link_id: string; amount: number; times_used: number; claim_count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [importAmount, setImportAmount] = useState<"10" | "20">("10");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [filterAmount, setFilterAmount] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [claimTierFilter, setClaimTierFilter] = useState<string>("all");
  const [claimStatusFilter, setClaimStatusFilter] = useState<string>("all");
  const [claimSortKey, setClaimSortKey] = useState<"created_at" | "amount" | "status">("created_at");
  const [claimSortDir, setClaimSortDir] = useState<"asc" | "desc">("desc");
  const [claimPage, setClaimPage] = useState(1);
  const CLAIMS_PAGE_SIZE = 25;

  const toggleClaimSort = (key: "created_at" | "amount" | "status") => {
    if (claimSortKey === key) {
      setClaimSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setClaimSortKey(key);
      setClaimSortDir(key === "created_at" ? "desc" : "asc");
    }
    setClaimPage(1);
  };

  const load = async () => {
    setLoading(true);
    const [
      { data: countData },
      { data: linkData, error },
      { data: claimData, error: claimErr },
      { data: reconData, error: reconErr },
    ] = await Promise.all([
      supabase.from("bac_payment_link_counts" as any).select("*"),
      supabase
        .from("bac_payment_links" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("bac_link_claims" as any)
        .select(
          "id, amount, created_at, booking_id, bookings:booking_id(id, status, coupon_code, guest_name, guest_email)"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("bac_link_claim_counts" as any)
        .select("link_id, amount, times_used, claim_count"),
    ]);
    if (error) toast.error(error.message);
    if (claimErr) toast.error(claimErr.message);
    if (reconErr) toast.error(reconErr.message);
    const next: Record<number, Omit<CountRow, "amount">> = {
      10: { ...EMPTY_COUNT },
      20: { ...EMPTY_COUNT },
    };
    ((countData as unknown) as CountRow[] | null)?.forEach((c) => {
      next[Number(c.amount)] = {
        available: Number(c.available) || 0,
        assigned: Number(c.assigned) || 0,
        used: Number(c.used) || 0,
        void: Number(c.void) || 0,
        total: Number(c.total) || 0,
      };
    });
    setCounts(next);
    setRows(((linkData as unknown) as LinkRow[] | null) ?? []);
    setClaims(((claimData as unknown) as ClaimRow[] | null) ?? []);
    setRecon(
      (((reconData as unknown) as Array<{
        link_id: string;
        amount: number | string;
        times_used: number | string;
        claim_count: number | string;
      }> | null) ?? []).map((r) => ({
        link_id: r.link_id,
        amount: Number(r.amount) || 0,
        times_used: Number(r.times_used) || 0,
        claim_count: Number(r.claim_count) || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredSortedClaims = useMemo(() => {
    const filtered = claims.filter((c) => {
      if (claimTierFilter !== "all" && Number(c.amount) !== Number(claimTierFilter)) return false;
      if (claimStatusFilter !== "all" && (c.bookings?.status ?? "") !== claimStatusFilter) return false;
      return true;
    });
    const dir = claimSortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (claimSortKey === "created_at") {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      } else if (claimSortKey === "amount") {
        av = Number(a.amount);
        bv = Number(b.amount);
      } else {
        av = a.bookings?.status ?? "";
        bv = b.bookings?.status ?? "";
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [claims, claimTierFilter, claimStatusFilter, claimSortKey, claimSortDir]);

  const claimTotalPages = Math.max(1, Math.ceil(filteredSortedClaims.length / CLAIMS_PAGE_SIZE));
  const claimPageSafe = Math.min(claimPage, claimTotalPages);
  const claimPageRows = filteredSortedClaims.slice(
    (claimPageSafe - 1) * CLAIMS_PAGE_SIZE,
    claimPageSafe * CLAIMS_PAGE_SIZE
  );

  useEffect(() => {
    setClaimPage(1);
  }, [claimTierFilter, claimStatusFilter]);

  const exportClaimsCsv = () => {
    const headers = ["Timestamp", "Tier", "Guest name", "Guest email", "Redemption code", "Booking status", "Booking ID"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    filteredSortedClaims.forEach((c) => {
      lines.push([
        new Date(c.created_at).toISOString(),
        `$${Number(c.amount).toFixed(0)}`,
        c.bookings?.guest_name ?? "",
        c.bookings?.guest_email ?? "",
        c.bookings?.coupon_code ?? "",
        c.bookings?.status ?? "",
        c.booking_id ?? "",
      ].map(escape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bac-claims-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: "created_at" | "amount" | "status" }) => {
    if (claimSortKey !== col) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />;
    return claimSortDir === "asc"
      ? <ArrowUp className="h-3 w-3 inline ml-1" />
      : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };



  const usedByAmount = useMemo(() => {
    const map: Record<number, number> = { 10: 0, 20: 0 };
    rows.forEach((r) => {
      const amt = Number(r.amount);
      map[amt] = (map[amt] ?? 0) + (Number(r.times_used) || 0);
    });
    return map;
  }, [rows]);

  const grandTotal = useMemo(
    () =>
      Object.values(counts).reduce(
        (acc, c) => ({
          available: acc.available + c.available,
          assigned: acc.assigned + c.assigned,
          used: acc.used + c.used,
          void: acc.void + c.void,
          total: acc.total + c.total,
        }),
        { ...EMPTY_COUNT }
      ),
    [counts]
  );

  const handleImport = async () => {
    const urls = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && /^https?:\/\//i.test(l));
    if (urls.length === 0) {
      toast.error("Paste one URL per line (must start with http/https).");
      return;
    }
    setImporting(true);
    const amount = Number(importAmount);
    const payload = urls.map((url) => ({ url, amount, status: "available" }));
    const { error, count } = await supabase
      .from("bac_payment_links" as any)
      .upsert(payload, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
    setImporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Imported ${count ?? urls.length} link(s) at $${amount}`);
    setImportText("");
    load();
  };

  const setStatus = async (id: string, status: LinkRow["status"]) => {
    const { error } = await supabase
      .from("bac_payment_links" as any)
      .update({
        status,
        used_at: status === "used" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`);
    load();
  };

  const filteredRows = rows.filter((r) => {
    if (filterAmount !== "all" && Number(r.amount) !== Number(filterAmount)) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const statusBadge = (s: LinkRow["status"]) => {
    const map = {
      available: { icon: CheckCircle2, cls: "bg-green-100 text-green-800" },
      assigned: { icon: Clock, cls: "bg-amber-100 text-amber-800" },
      used: { icon: Link2, cls: "bg-blue-100 text-blue-800" },
      void: { icon: XCircle, cls: "bg-muted text-muted-foreground" },
    }[s];
    const Icon = map.icon;
    return (
      <Badge variant="secondary" className={map.cls}>
        <Icon className="h-3 w-3 mr-1" />
        {s}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "$10 Facials", amount: 10, data: counts[10], accent: "text-emerald-700" },
          { label: "$20 All Other", amount: 20, data: counts[20], accent: "text-blue-700" },
          {
            label: "Total Pool",
            amount: 0,
            data: {
              ...grandTotal,
              total: grandTotal.total,
            },
            accent: "text-foreground",
          },
        ].map((tier) => {
          const isTier = tier.label !== "Total Pool";
          const perTierCapacity = REUSABLE_CAPACITY;
          const totalCapacity = isTier
            ? tier.data.total > 0
              ? perTierCapacity
              : 0
            : (counts[10].total > 0 ? perTierCapacity : 0) +
              (counts[20].total > 0 ? perTierCapacity : 0);
          const used = isTier
            ? usedByAmount[tier.amount] ?? 0
            : (usedByAmount[10] ?? 0) + (usedByAmount[20] ?? 0);
          const remaining = Math.max(totalCapacity - used, 0);
          return (
            <Card key={tier.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tier.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-semibold ${tier.accent}`}>
                  {remaining.toLocaleString()}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}/ {totalCapacity.toLocaleString()} remaining
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                  <span>Claimed: {used.toLocaleString()}</span>
                  <span>Reusable link{isTier ? "" : "s"}: {tier.data.total}</span>
                  <span>Void: {tier.data.void}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reconciliation — compare logged claims vs. link.times_used */}
      {(() => {
        const reconRows = recon.map((r) => ({
          ...r,
          diff: r.times_used - r.claim_count,
        }));
        const mismatches = reconRows.filter((r) => r.diff !== 0);
        const totalTimesUsed = reconRows.reduce((s, r) => s + r.times_used, 0);
        const totalClaims = reconRows.reduce((s, r) => s + r.claim_count, 0);
        return (
          <Card className={mismatches.length > 0 ? "border-amber-300" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Reconciliation
                  {mismatches.length === 0 ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      In sync
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {mismatches.length} discrepanc{mismatches.length === 1 ? "y" : "ies"}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Compares each link's usage counter against the number of rows in the claim log.
                  Totals — counter: {totalTimesUsed.toLocaleString()} · claims logged: {totalClaims.toLocaleString()}.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                Re-check
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">Counter (times_used)</TableHead>
                    <TableHead className="text-right">Logged claims</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                    </TableCell></TableRow>
                  )}
                  {!loading && reconRows.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No BAC links to reconcile.
                    </TableCell></TableRow>
                  )}
                  {reconRows
                    .slice()
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.amount - b.amount)
                    .map((r) => {
                      const inSync = r.diff === 0;
                      return (
                        <TableRow key={r.link_id} className={!inSync ? "bg-amber-50" : undefined}>
                          <TableCell>${Number(r.amount).toFixed(0)}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {r.link_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.times_used.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.claim_count.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${
                              inSync
                                ? "text-muted-foreground"
                                : r.diff > 0
                                ? "text-amber-800"
                                : "text-red-700"
                            }`}
                          >
                            {r.diff > 0 ? `+${r.diff}` : r.diff}
                          </TableCell>
                          <TableCell>
                            {inSync ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">OK</Badge>
                            ) : r.diff > 0 ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                                Counter ahead — {r.diff} claim{r.diff === 1 ? "" : "s"} not logged
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                Extra claim log rows ({Math.abs(r.diff)})
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              {mismatches.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  A positive diff usually means a claim was made before the log table existed, or a
                  manual counter adjustment. A negative diff means the log has more rows than the
                  counter — investigate for double-logging or a manual counter reset.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Claims log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Claim history</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredSortedClaims.length.toLocaleString()} claim{filteredSortedClaims.length === 1 ? "" : "s"} (latest 200 loaded)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={claimTierFilter} onValueChange={setClaimTierFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="10">$10</SelectItem>
                <SelectItem value="20">$20</SelectItem>
              </SelectContent>
            </Select>
            <Select value={claimStatusFilter} onValueChange={setClaimStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending_payment">Pending payment</SelectItem>
                <SelectItem value="payment_failed">Payment failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={exportClaimsCsv}
              disabled={filteredSortedClaims.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleClaimSort("created_at")}
                    className="inline-flex items-center hover:text-foreground"
                  >
                    When <SortIcon col="created_at" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleClaimSort("amount")}
                    className="inline-flex items-center hover:text-foreground"
                  >
                    Tier <SortIcon col="amount" />
                  </button>
                </TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Redemption code</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleClaimSort("status")}
                    className="inline-flex items-center hover:text-foreground"
                  >
                    Booking status <SortIcon col="status" />
                  </button>
                </TableHead>
                <TableHead>Booking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                </TableCell></TableRow>
              )}
              {!loading && claimPageRows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No claims match the current filters.
                </TableCell></TableRow>
              )}
              {claimPageRows.map((c) => {
                const status = c.bookings?.status ?? "—";
                const statusCls =
                  status === "paid" || status === "completed"
                    ? "bg-green-100 text-green-800"
                    : status === "pending_payment"
                    ? "bg-amber-100 text-amber-800"
                    : status === "payment_failed" || status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : "bg-muted text-muted-foreground";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>${Number(c.amount).toFixed(0)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{c.bookings?.guest_name ?? "—"}</div>
                      {c.bookings?.guest_email && (
                        <div className="text-muted-foreground">{c.bookings.guest_email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {c.bookings?.coupon_code || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusCls}>{status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {c.booking_id ? c.booking_id.slice(0, 8) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredSortedClaims.length > CLAIMS_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Showing {(claimPageSafe - 1) * CLAIMS_PAGE_SIZE + 1}–
                {Math.min(claimPageSafe * CLAIMS_PAGE_SIZE, filteredSortedClaims.length)} of{" "}
                {filteredSortedClaims.length.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={claimPageSafe <= 1}
                  onClick={() => setClaimPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {claimPageSafe} of {claimTotalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={claimPageSafe >= claimTotalPages}
                  onClick={() => setClaimPage((p) => Math.min(claimTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import BAC CompraClick links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
            <div>
              <Label>Amount</Label>
              <Select value={importAmount} onValueChange={(v) => setImportAmount(v as "10" | "20")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">$10 (Facials)</SelectItem>
                  <SelectItem value="20">$20 (All other)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Links (one per line)</Label>
              <Textarea
                rows={6}
                placeholder="https://credomatic.compraclick.com/..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleImport} disabled={importing}>
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import links
          </Button>
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Inventory (latest 500)</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterAmount} onValueChange={setFilterAmount}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All amounts</SelectItem>
                <SelectItem value="10">$10</SelectItem>
                <SelectItem value="20">$20</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Assigned booking</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                </TableCell></TableRow>
              )}
              {!loading && filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No links match the current filters.
                </TableCell></TableRow>
              )}
              {filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>${Number(r.amount).toFixed(0)}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="max-w-[320px] truncate">
                    <a href={r.url} target="_blank" rel="noreferrer" className="underline">
                      {r.url}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">{r.assigned_booking_id ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.assigned_at ? new Date(r.assigned_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status !== "available" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "available")}>
                        Release
                      </Button>
                    )}
                    {r.status === "assigned" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "used")}>
                        Mark used
                      </Button>
                    )}
                    {r.status !== "void" && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "void")}>
                        Void
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
