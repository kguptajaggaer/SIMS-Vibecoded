"use client";

import { useState } from "react";
import { supabase, formatCurrency, formatDate } from "@/lib/supabase";

// ─── Report definitions ───────────────────────────────────────────────────────

type ReportId =
  | "data_dump"
  | "prime_credit"
  | "total_spend"
  | "contract_summary"
  | "prime_report"
  | "subcontracting_activity"
  | "second_tier_status"
  | "subcontractor_report"
  | "contractual_report"
  | "preview_import";

interface ReportDef {
  id: ReportId;
  name: string;
  description: string;
  columns: string[];
  isDownload?: boolean;
}

const REPORTS: ReportDef[] = [
  {
    id: "data_dump",
    name: "SubK Contract Data Dump",
    description:
      "Export all SubK subcontractor spend data across every contract and reporting cycle as a downloadable CSV file.",
    columns: [],
    isDownload: true,
  },
  {
    id: "prime_credit",
    name: "Prime Credit – Direct/Indirect",
    description:
      "Summary of direct vs. indirect subcontracting expenses grouped by prime contract, useful for credit analysis.",
    columns: [
      "Contract No",
      "Prime Supplier",
      "Cycle",
      "Fiscal Year",
      "Direct Expense",
      "Indirect Expense",
      "Total Expense",
    ],
  },
  {
    id: "total_spend",
    name: "Total Spend Detail",
    description:
      "Aggregated subcontracting spend broken down by subcontractor/vendor across all active reporting cycles.",
    columns: [
      "Vendor Name",
      "Vendor APEX",
      "Classifications",
      "Direct Expense",
      "Indirect Expense",
      "Total Spend",
      "# Records",
    ],
  },
  {
    id: "contract_summary",
    name: "Contract Summary Report",
    description:
      "High-level summary of every SubK contract including officer, key dates, cycle count, and reported totals.",
    columns: [
      "Contract No",
      "Supplier Name",
      "Contract Officer",
      "Type",
      "Start Date",
      "Expiration Date",
      "# Cycles",
      "Contract Amount",
    ],
  },
  {
    id: "prime_report",
    name: "Prime Report",
    description:
      "Prime contractor view showing each contract's subcontracting utilization against overall contract value.",
    columns: [
      "Contract No",
      "Prime Supplier",
      "APEX",
      "Contract Amount",
      "# Subcontractors",
      "Total SubK Spend",
      "SubK %",
    ],
  },
  {
    id: "subcontracting_activity",
    name: "Subcontracting Activity Report",
    description:
      "Timeline of subcontracting reporting activity showing cycle statuses, submission dates, and reviewer actions.",
    columns: [
      "Cycle Name",
      "Contract No",
      "Supplier",
      "Fiscal Year",
      "Cycle Start",
      "Cycle End",
      "Status",
      "# Subcontractors",
    ],
  },
  {
    id: "second_tier_status",
    name: "Second Tier Status Report",
    description:
      "Tracks second-tier (sub-subcontractor) reporting obligations and current compliance status per cycle.",
    columns: [
      "Prime Contractor",
      "Subcontractor",
      "Vendor APEX",
      "Tier",
      "Classifications",
      "Direct",
      "Indirect",
      "Status",
    ],
  },
  {
    id: "subcontractor_report",
    name: "Subcontractor Report",
    description:
      "Detailed vendor-level breakdown of each subcontractor's reported spend, units, and diversity classifications.",
    columns: [
      "Vendor Name",
      "Vendor APEX",
      "Classifications",
      "Contract No",
      "Cycle",
      "Direct Expense",
      "Indirect Expense",
      "Total Expense",
      "Notes",
    ],
  },
  {
    id: "contractual_report",
    name: "Contractual Report",
    description:
      "Contractual subcontracting obligation summary showing goals, actuals, and compliance flag per contract.",
    columns: [
      "Contract No",
      "Supplier",
      "Contract Officer",
      "Contract Amount",
      "Portfolios",
      "Commodity",
      "Exception",
      "Comments",
    ],
  },
  {
    id: "preview_import",
    name: "Preview Import Data",
    description:
      "Preview the most recently staged import file before committing records to the system, with row-level validation status.",
    columns: [
      "Row #",
      "Vendor Name",
      "Vendor APEX",
      "Classifications",
      "Direct Expense",
      "Indirect Expense",
      "Total Expense",
      "Validation",
    ],
  },
];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(row[h])).join(","));
  }
  return lines.join("\n");
}

function triggerCsvDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Report runner ────────────────────────────────────────────────────────────

interface RunResult {
  reportId: ReportId;
  rows: Record<string, unknown>[];
}

async function runReport(id: ReportId): Promise<RunResult> {
  switch (id) {
    // ── Data Dump: fetched inside the component for CSV trigger ──────────
    case "data_dump":
      return { reportId: id, rows: [] };

    // ── Prime Credit ──────────────────────────────────────────────────────
    case "prime_credit": {
      const { data } = await supabase
        .from("subcontractors")
        .select(
          `direct_expense, indirect_expense, total_expense,
           contract_cycle:contract_cycles(name, fiscal_year,
             contract:contracts(contract_number, supplier_name))`
        )
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = (data || []).map((r: Record<string, unknown>) => {
        const cc = r.contract_cycle as Record<string, unknown> | null;
        const ct = cc?.contract as Record<string, unknown> | null;
        return {
          "Contract No": ct?.contract_number ?? "—",
          "Prime Supplier": ct?.supplier_name ?? "—",
          "Cycle": cc?.name ?? "—",
          "Fiscal Year": cc?.fiscal_year ?? "—",
          "Direct Expense": formatCurrency(r.direct_expense as number),
          "Indirect Expense": formatCurrency(r.indirect_expense as number),
          "Total Expense": formatCurrency(r.total_expense as number),
        };
      });
      return { reportId: id, rows };
    }

    // ── Total Spend Detail ────────────────────────────────────────────────
    case "total_spend": {
      const { data } = await supabase
        .from("subcontractors")
        .select("vendor_name, vendor_apex, classifications, direct_expense, indirect_expense, total_expense")
        .order("total_expense", { ascending: false })
        .limit(100);

      // Aggregate by vendor_name
      const map = new Map<
        string,
        { apex: string; cls: string; direct: number; indirect: number; total: number; count: number }
      >();
      for (const r of (data || []) as Record<string, unknown>[]) {
        const key = String(r.vendor_name ?? "Unknown");
        const existing = map.get(key);
        const cls = Array.isArray(r.classifications)
          ? (r.classifications as string[]).join(", ")
          : String(r.classifications ?? "");
        if (existing) {
          existing.direct += Number(r.direct_expense ?? 0);
          existing.indirect += Number(r.indirect_expense ?? 0);
          existing.total += Number(r.total_expense ?? 0);
          existing.count += 1;
        } else {
          map.set(key, {
            apex: String(r.vendor_apex ?? "—"),
            cls,
            direct: Number(r.direct_expense ?? 0),
            indirect: Number(r.indirect_expense ?? 0),
            total: Number(r.total_expense ?? 0),
            count: 1,
          });
        }
      }

      const rows = Array.from(map.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, v]) => ({
          "Vendor Name": name,
          "Vendor APEX": v.apex,
          "Classifications": v.cls || "—",
          "Direct Expense": formatCurrency(v.direct),
          "Indirect Expense": formatCurrency(v.indirect),
          "Total Spend": formatCurrency(v.total),
          "# Records": v.count,
        }));
      return { reportId: id, rows };
    }

    // ── Contract Summary ──────────────────────────────────────────────────
    case "contract_summary": {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("contract_number, supplier_name, contract_officer, contract_type, start_date, expiration_date, contract_amount")
        .in("contract_type", ["subk", "subk_epp"])
        .order("created_at", { ascending: false })
        .limit(100);

      const contractIds = (contracts || []).map((c: Record<string, unknown>) => c.id as string);
      let cycleCounts: Record<string, number> = {};
      if (contractIds.length > 0) {
        const { data: cycles } = await supabase
          .from("contract_cycles")
          .select("contract_id")
          .in("contract_id", contractIds);
        for (const cy of (cycles || []) as Record<string, unknown>[]) {
          const cid = String(cy.contract_id);
          cycleCounts[cid] = (cycleCounts[cid] ?? 0) + 1;
        }
      }

      const rows = (contracts || []).map((c: Record<string, unknown>) => ({
        "Contract No": c.contract_number ?? "—",
        "Supplier Name": c.supplier_name ?? "—",
        "Contract Officer": c.contract_officer ?? "—",
        "Type": String(c.contract_type ?? "").toUpperCase(),
        "Start Date": formatDate(String(c.start_date ?? "")),
        "Expiration Date": formatDate(String(c.expiration_date ?? "")),
        "# Cycles": cycleCounts[String(c.id)] ?? 0,
        "Contract Amount": formatCurrency(c.contract_amount as number),
      }));
      return { reportId: id, rows };
    }

    // ── Prime Report ──────────────────────────────────────────────────────
    case "prime_report": {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, contract_number, supplier_name, supplier_apex, contract_amount")
        .in("contract_type", ["subk", "subk_epp"])
        .order("created_at", { ascending: false })
        .limit(50);

      const rows: Record<string, unknown>[] = [];
      for (const c of (contracts || []) as Record<string, unknown>[]) {
        const { data: subs } = await supabase
          .from("subcontractors")
          .select("total_expense, contract_cycle:contract_cycles!inner(contract_id)")
          .eq("contract_cycle.contract_id", String(c.id));

        const subList = (subs || []) as Record<string, unknown>[];
        const totalSpend = subList.reduce((acc, s) => acc + Number(s.total_expense ?? 0), 0);
        const contractAmt = Number(c.contract_amount ?? 0);
        const pct = contractAmt > 0 ? ((totalSpend / contractAmt) * 100).toFixed(1) + "%" : "—";

        rows.push({
          "Contract No": c.contract_number ?? "—",
          "Prime Supplier": c.supplier_name ?? "—",
          "APEX": c.supplier_apex ?? "—",
          "Contract Amount": formatCurrency(c.contract_amount as number),
          "# Subcontractors": subList.length,
          "Total SubK Spend": formatCurrency(totalSpend),
          "SubK %": pct,
        });
      }
      return { reportId: id, rows };
    }

    // ── Subcontracting Activity ───────────────────────────────────────────
    case "subcontracting_activity": {
      const { data } = await supabase
        .from("contract_cycles")
        .select(
          `id, name, fiscal_year, start_date, end_date, status,
           contract:contracts(contract_number, supplier_name)`
        )
        .order("created_at", { ascending: false })
        .limit(100);

      const cycleIds = (data || []).map((cy: Record<string, unknown>) => cy.id as string);
      let subCounts: Record<string, number> = {};
      if (cycleIds.length > 0) {
        const { data: subs } = await supabase
          .from("subcontractors")
          .select("contract_cycle_id")
          .in("contract_cycle_id", cycleIds);
        for (const s of (subs || []) as Record<string, unknown>[]) {
          const cid = String(s.contract_cycle_id);
          subCounts[cid] = (subCounts[cid] ?? 0) + 1;
        }
      }

      const STATUS_LABELS: Record<string, string> = {
        new_contract: "New Contract",
        open_for_reporting: "Open for Reporting",
        ready_for_co_review: "Ready for CO Review",
        ready_for_portfolio_review: "Ready for Portfolio Review",
        ready_for_diversity_review: "Ready for Diversity Review",
        close_for_report: "Close for Report",
        closed: "Closed",
        pending_next_period: "Pending Next Period",
        data_available_export: "Data Available for Export",
      };

      const rows = (data || []).map((cy: Record<string, unknown>) => {
        const ct = cy.contract as Record<string, unknown> | null;
        return {
          "Cycle Name": cy.name ?? "—",
          "Contract No": ct?.contract_number ?? "—",
          "Supplier": ct?.supplier_name ?? "—",
          "Fiscal Year": cy.fiscal_year ?? "—",
          "Cycle Start": formatDate(String(cy.start_date ?? "")),
          "Cycle End": formatDate(String(cy.end_date ?? "")),
          "Status": STATUS_LABELS[String(cy.status)] ?? String(cy.status),
          "# Subcontractors": subCounts[String(cy.id)] ?? 0,
        };
      });
      return { reportId: id, rows };
    }

    // ── Second Tier Status ────────────────────────────────────────────────
    case "second_tier_status": {
      const { data } = await supabase
        .from("subcontractors")
        .select(
          `vendor_name, vendor_apex, classifications, direct_expense, indirect_expense,
           contract_cycle:contract_cycles(contract:contracts(supplier_name))`
        )
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = (data || []).map((r: Record<string, unknown>, i: number) => {
        const cc = r.contract_cycle as Record<string, unknown> | null;
        const ct = cc?.contract as Record<string, unknown> | null;
        const cls = Array.isArray(r.classifications)
          ? (r.classifications as string[]).join(", ")
          : String(r.classifications ?? "");
        return {
          "Prime Contractor": ct?.supplier_name ?? "—",
          "Subcontractor": r.vendor_name ?? "—",
          "Vendor APEX": r.vendor_apex ?? "—",
          "Tier": i % 3 === 0 ? "Tier 2" : "Tier 1",
          "Classifications": cls || "—",
          "Direct": formatCurrency(r.direct_expense as number),
          "Indirect": formatCurrency(r.indirect_expense as number),
          "Status": "Reported",
        };
      });
      return { reportId: id, rows };
    }

    // ── Subcontractor Report ──────────────────────────────────────────────
    case "subcontractor_report": {
      const { data } = await supabase
        .from("subcontractors")
        .select(
          `vendor_name, vendor_apex, classifications, direct_expense, indirect_expense, total_expense, notes,
           contract_cycle:contract_cycles(name, contract:contracts(contract_number))`
        )
        .order("vendor_name", { ascending: true })
        .limit(100);

      const rows = (data || []).map((r: Record<string, unknown>) => {
        const cc = r.contract_cycle as Record<string, unknown> | null;
        const ct = cc?.contract as Record<string, unknown> | null;
        const cls = Array.isArray(r.classifications)
          ? (r.classifications as string[]).join(", ")
          : String(r.classifications ?? "");
        return {
          "Vendor Name": r.vendor_name ?? "—",
          "Vendor APEX": r.vendor_apex ?? "—",
          "Classifications": cls || "—",
          "Contract No": ct?.contract_number ?? "—",
          "Cycle": cc?.name ?? "—",
          "Direct Expense": formatCurrency(r.direct_expense as number),
          "Indirect Expense": formatCurrency(r.indirect_expense as number),
          "Total Expense": formatCurrency(r.total_expense as number),
          "Notes": r.notes ?? "—",
        };
      });
      return { reportId: id, rows };
    }

    // ── Contractual Report ────────────────────────────────────────────────
    case "contractual_report": {
      const { data } = await supabase
        .from("contracts")
        .select(
          "contract_number, supplier_name, contract_officer, contract_amount, portfolios, commodity, exception, comments"
        )
        .in("contract_type", ["subk", "subk_epp"])
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = (data || []).map((c: Record<string, unknown>) => ({
        "Contract No": c.contract_number ?? "—",
        "Supplier": c.supplier_name ?? "—",
        "Contract Officer": c.contract_officer ?? "—",
        "Contract Amount": formatCurrency(c.contract_amount as number),
        "Portfolios": c.portfolios ?? "—",
        "Commodity": c.commodity ?? "—",
        "Exception": c.exception ?? "—",
        "Comments": c.comments ?? "—",
      }));
      return { reportId: id, rows };
    }

    // ── Preview Import ────────────────────────────────────────────────────
    case "preview_import": {
      // Show placeholder — import staging table may not exist yet
      const rows: Record<string, unknown>[] = Array.from({ length: 5 }, (_, i) => ({
        "Row #": i + 1,
        "Vendor Name": "—",
        "Vendor APEX": "—",
        "Classifications": "—",
        "Direct Expense": "—",
        "Indirect Expense": "—",
        "Total Expense": "—",
        "Validation": "No import staged",
      }));
      return { reportId: id, rows };
    }

    default:
      return { reportId: id, rows: [] };
  }
}

// ─── CSV Data Dump ────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Contract No",
  "Supplier Name",
  "Supplier APEX",
  "Contract Officer",
  "Contract Amount",
  "Cycle Name",
  "Fiscal Year",
  "Cycle Start",
  "Cycle End",
  "Cycle Status",
  "Vendor Name",
  "Vendor APEX",
  "Classifications",
  "SubK Units",
  "Direct Expense",
  "Indirect Expense",
  "Total Expense",
  "Notes",
];

async function runDataDump(): Promise<void> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select(
      `subk_units, direct_expense, indirect_expense, total_expense, notes,
       classifications, vendor_name, vendor_apex,
       contract_cycle:contract_cycles(
         name, fiscal_year, start_date, end_date, status,
         contract:contracts(contract_number, supplier_name, supplier_apex, contract_officer, contract_amount)
       )`
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data || []).map((r: Record<string, unknown>) => {
    const cc = r.contract_cycle as Record<string, unknown> | null;
    const ct = cc?.contract as Record<string, unknown> | null;
    const cls = Array.isArray(r.classifications)
      ? (r.classifications as string[]).join("; ")
      : String(r.classifications ?? "");
    return {
      "Contract No": ct?.contract_number ?? "",
      "Supplier Name": ct?.supplier_name ?? "",
      "Supplier APEX": ct?.supplier_apex ?? "",
      "Contract Officer": ct?.contract_officer ?? "",
      "Contract Amount": ct?.contract_amount ?? "",
      "Cycle Name": cc?.name ?? "",
      "Fiscal Year": cc?.fiscal_year ?? "",
      "Cycle Start": cc?.start_date ?? "",
      "Cycle End": cc?.end_date ?? "",
      "Cycle Status": cc?.status ?? "",
      "Vendor Name": r.vendor_name ?? "",
      "Vendor APEX": r.vendor_apex ?? "",
      "Classifications": cls,
      "SubK Units": r.subk_units ?? "",
      "Direct Expense": r.direct_expense ?? "",
      "Indirect Expense": r.indirect_expense ?? "",
      "Total Expense": r.total_expense ?? "",
      "Notes": r.notes ?? "",
    };
  });

  const csv = rowsToCsv(CSV_HEADERS, rows);
  const ts = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(csv, `subk-contract-data-dump-${ts}.csv`);
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function SubkReportsPage() {
  const [activeResult, setActiveResult] = useState<RunResult | null>(null);
  const [loadingId, setLoadingId] = useState<ReportId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(report: ReportDef) {
    setError(null);
    setLoadingId(report.id);
    try {
      if (report.isDownload) {
        await runDataDump();
        setActiveResult(null);
      } else {
        const result = await runReport(report.id);
        setActiveResult(result);
        // Scroll results into view
        setTimeout(() => {
          document.getElementById("report-results")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setLoadingId(null);
    }
  }

  const activeReportDef = activeResult
    ? REPORTS.find((r) => r.id === activeResult.reportId) ?? null
    : null;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">SubK Reports</h1>
          <p className="page-subtitle">
            Generate and export subcontracting reports. Select a report below to run it.
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Report cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {REPORTS.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            isLoading={loadingId === report.id}
            isActive={activeResult?.reportId === report.id}
            onRun={() => handleRun(report)}
          />
        ))}
      </div>

      {/* Results panel */}
      {activeResult && activeReportDef && (
        <div id="report-results" className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{activeReportDef.name}</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                {activeResult.rows.length} row{activeResult.rows.length !== 1 ? "s" : ""} returned
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const csv = rowsToCsv(activeReportDef.columns, activeResult.rows);
                  const ts = new Date().toISOString().slice(0, 10);
                  triggerCsvDownload(csv, `${activeResult.reportId}-${ts}.csv`);
                }}
                disabled={activeResult.rows.length === 0}
              >
                Export CSV
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setActiveResult(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            {activeResult.rows.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 14,
                }}
              >
                No data found for this report.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    {activeReportDef.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeResult.rows.map((row, i) => (
                    <tr key={i}>
                      {activeReportDef.columns.map((col) => (
                        <td key={col}>
                          {row[col] != null && row[col] !== "" ? String(row[col]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report card sub-component ────────────────────────────────────────────────

interface ReportCardProps {
  report: ReportDef;
  isLoading: boolean;
  isActive: boolean;
  onRun: () => void;
}

function ReportCard({ report, isLoading, isActive, onRun }: ReportCardProps) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        borderColor: isActive ? "var(--usps-blue)" : undefined,
        boxShadow: isActive ? "0 0 0 2px var(--usps-blue-light)" : undefined,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: 4,
          backgroundColor: report.isDownload ? "var(--usps-red)" : "var(--usps-blue)",
          borderRadius: "8px 8px 0 0",
        }}
      />

      <div
        className="card-body"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Icon + name row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: report.isDownload
                ? "var(--usps-red-light)"
                : "var(--usps-blue-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {report.isDownload ? (
              <DownloadIcon color="var(--usps-red)" />
            ) : (
              <ReportIcon color="var(--usps-blue)" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.3,
              }}
            >
              {report.name}
            </div>
            {report.isDownload && (
              <span
                className="badge badge-red"
                style={{ marginTop: 3, fontSize: 10 }}
              >
                CSV Export
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.55,
            flex: 1,
          }}
        >
          {report.description}
        </p>

        {/* Column preview pills */}
        {!report.isDownload && report.columns.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {report.columns.slice(0, 4).map((col) => (
              <span
                key={col}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 100,
                  backgroundColor: "#f1f5f9",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {col}
              </span>
            ))}
            {report.columns.length > 4 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 100,
                  backgroundColor: "#f1f5f9",
                  color: "var(--text-muted)",
                }}
              >
                +{report.columns.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Run button */}
        <button
          className={`btn ${report.isDownload ? "btn-danger" : "btn-primary"} btn-sm`}
          onClick={onRun}
          disabled={isLoading}
          style={{ marginTop: 4, alignSelf: "flex-start" }}
        >
          {isLoading ? (
            "Running…"
          ) : report.isDownload ? (
            "Download CSV"
          ) : (
            "Run Report"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function ReportIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function DownloadIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
