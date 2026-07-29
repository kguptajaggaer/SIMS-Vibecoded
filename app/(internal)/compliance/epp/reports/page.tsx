"use client";

import { useState } from "react";
import { supabase, formatCurrency, formatDate, formatPct } from "@/lib/supabase";

type ReportId = "data_dump" | "summary_by_category" | "progress" | "finalized";

interface CategorySummaryRow {
  category: string;
  label: string;
  product_count: number;
  total_spend: number;
}

interface ProgressRow {
  id: string;
  contract_number: string;
  supplier_name: string;
  cycle_name: string;
  fiscal_year: string | null;
  total_contract_spend: number | null;
  total_epp_spend: number | null;
  epp_percentage: number | null;
  epp_status: string;
  epp_categories: string[];
}

interface FinalizedRow {
  id: string;
  contract_number: string;
  supplier_name: string;
  cycle_name: string;
  fiscal_year: string | null;
  total_contract_spend: number | null;
  total_epp_spend: number | null;
  epp_percentage: number | null;
  epp_admin_reviewed_at: string | null;
  epp_admin_reviewed_by: string | null;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function escapeCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  }
  return lines.join("\n");
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Report definitions ───────────────────────────────────────────────────────
const REPORTS: {
  id: ReportId;
  title: string;
  description: string;
  accentColor: string;
  iconPath: string;
}[] = [
  {
    id: "data_dump",
    title: "EPP Contract Data Dump",
    description:
      "Export the complete EPP dataset — contract cycles, spend totals, and all product category tables (recycled, ecolabel, biobased, energy-efficient, water-efficient) — as a single CSV file.",
    accentColor: "#004B87",
    iconPath:
      "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  },
  {
    id: "summary_by_category",
    title: "EPP Summary by Category",
    description:
      "Total spend and product count broken down by EPP category: recycled content, ecolabel, biobased, energy-efficient, and water-efficient.",
    accentColor: "#16a34a",
    iconPath:
      "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    id: "progress",
    title: "EPP Progress Report",
    description:
      "EPP spend percentage, total contract spend, and EPP goal progress for each active contract cycle, with status and active categories.",
    accentColor: "#d97706",
    iconPath:
      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
  {
    id: "finalized",
    title: "Finalized Reports",
    description:
      "List of all EPP contract cycles that have been finalized, with EPP admin review details and final spend summaries.",
    accentColor: "#7c3aed",
    iconPath:
      "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function EppReportsPage() {
  const [running, setRunning] = useState<ReportId | null>(null);
  const [activeReport, setActiveReport] = useState<ReportId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [categorySummary, setCategorySummary] = useState<CategorySummaryRow[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [finalizedRows, setFinalizedRows] = useState<FinalizedRow[]>([]);

  // ── Data Dump ──────────────────────────────────────────────────────────────
  async function runDataDump() {
    setRunning("data_dump");
    setError(null);
    try {
      const [
        { data: eppCycles },
        { data: recycled },
        { data: ecolabel },
        { data: biobased },
        { data: energy },
        { data: water },
      ] = await Promise.all([
        supabase
          .from("epp_contract_cycles")
          .select(
            `id, epp_status, total_contract_spend, total_epp_spend, epp_percentage,
             epp_categories, co_reviewed_by, co_reviewed_at, co_comments,
             epp_admin_reviewed_by, epp_admin_reviewed_at, epp_admin_comments,
             created_at, updated_at,
             contract_cycles!inner(
               name, fiscal_year, start_date, end_date,
               contracts!inner(contract_number, supplier_name, supplier_apex, contract_officer, portfolios, commodity)
             )`
          )
          .order("created_at"),
        supabase.from("epp_recycled_content").select("*").order("created_at"),
        supabase.from("epp_ecolabel").select("*").order("created_at"),
        supabase.from("epp_biobased").select("*").order("created_at"),
        supabase.from("epp_energy_efficient").select("*").order("created_at"),
        supabase.from("epp_water_efficient").select("*").order("created_at"),
      ]);

      // Section 1: EPP Contract Cycles
      const cycleHeaders = [
        "id",
        "contract_number",
        "supplier_name",
        "supplier_apex",
        "contract_officer",
        "portfolios",
        "commodity",
        "cycle_name",
        "fiscal_year",
        "cycle_start_date",
        "cycle_end_date",
        "epp_status",
        "total_contract_spend",
        "total_epp_spend",
        "epp_percentage",
        "epp_categories",
        "co_reviewed_by",
        "co_reviewed_at",
        "co_comments",
        "epp_admin_reviewed_by",
        "epp_admin_reviewed_at",
        "epp_admin_comments",
        "created_at",
        "updated_at",
      ];

      const cycleRows = (eppCycles ?? []).map((r: Record<string, unknown>) => {
        const cc = r.contract_cycles as Record<string, unknown>;
        const ct = cc?.contracts as Record<string, unknown>;
        return {
          id: r.id,
          contract_number: ct?.contract_number,
          supplier_name: ct?.supplier_name,
          supplier_apex: ct?.supplier_apex,
          contract_officer: ct?.contract_officer,
          portfolios: ct?.portfolios,
          commodity: ct?.commodity,
          cycle_name: cc?.name,
          fiscal_year: cc?.fiscal_year,
          cycle_start_date: cc?.start_date,
          cycle_end_date: cc?.end_date,
          epp_status: r.epp_status,
          total_contract_spend: r.total_contract_spend,
          total_epp_spend: r.total_epp_spend,
          epp_percentage: r.epp_percentage,
          epp_categories: Array.isArray(r.epp_categories)
            ? (r.epp_categories as string[]).join("; ")
            : r.epp_categories,
          co_reviewed_by: r.co_reviewed_by,
          co_reviewed_at: r.co_reviewed_at,
          co_comments: r.co_comments,
          epp_admin_reviewed_by: r.epp_admin_reviewed_by,
          epp_admin_reviewed_at: r.epp_admin_reviewed_at,
          epp_admin_comments: r.epp_admin_comments,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });

      let csv = "EPP CONTRACT CYCLES\n";
      csv += rowsToCsv(cycleHeaders, cycleRows);

      // Section 2: Recycled Content
      const recycledHeaders = [
        "id", "epp_contract_cycle_id", "product_name", "manufacturer",
        "product_description", "unit_of_measure", "quantity_purchased",
        "unit_price", "total_spend", "recovered_material_content_pct",
        "post_consumer_content_pct", "epa_designation", "cpg_item", "notes",
        "created_at", "updated_at",
      ];
      csv += "\n\nRECYCLED CONTENT\n";
      csv += rowsToCsv(recycledHeaders, (recycled ?? []) as Record<string, unknown>[]);

      // Section 3: Ecolabel
      const ecolabelHeaders = [
        "id", "epp_contract_cycle_id", "product_name", "manufacturer",
        "product_description", "ecolabel_name", "certification_number",
        "unit_of_measure", "quantity_purchased", "unit_price", "total_spend",
        "notes", "created_at", "updated_at",
      ];
      csv += "\n\nECOLABEL\n";
      csv += rowsToCsv(ecolabelHeaders, (ecolabel ?? []) as Record<string, unknown>[]);

      // Section 4: Biobased
      const biobasedHeaders = [
        "id", "epp_contract_cycle_id", "product_name", "manufacturer",
        "product_description", "usda_designation", "biobased_content_pct",
        "unit_of_measure", "quantity_purchased", "unit_price", "total_spend",
        "notes", "created_at", "updated_at",
      ];
      csv += "\n\nBIOBASED\n";
      csv += rowsToCsv(biobasedHeaders, (biobased ?? []) as Record<string, unknown>[]);

      // Section 5: Energy Efficient
      const energyHeaders = [
        "id", "epp_contract_cycle_id", "product_name", "manufacturer",
        "product_description", "energy_star_certified", "femp_designated",
        "efficiency_rating", "unit_of_measure", "quantity_purchased",
        "unit_price", "total_spend", "notes", "created_at", "updated_at",
      ];
      csv += "\n\nENERGY EFFICIENT\n";
      csv += rowsToCsv(energyHeaders, (energy ?? []) as Record<string, unknown>[]);

      // Section 6: Water Efficient
      const waterHeaders = [
        "id", "epp_contract_cycle_id", "product_name", "manufacturer",
        "product_description", "watersense_certified", "efficiency_rating",
        "unit_of_measure", "quantity_purchased", "unit_price", "total_spend",
        "notes", "created_at", "updated_at",
      ];
      csv += "\n\nWATER EFFICIENT\n";
      csv += rowsToCsv(waterHeaders, (water ?? []) as Record<string, unknown>[]);

      triggerDownload(csv, "epp_data_dump.csv");
    } catch (err) {
      setError("Failed to generate data dump. Please try again.");
      console.error(err);
    } finally {
      setRunning(null);
    }
  }

  // ── Summary by Category ────────────────────────────────────────────────────
  async function runSummaryByCategory() {
    setRunning("summary_by_category");
    setError(null);
    try {
      const [
        { data: recycled },
        { data: ecolabel },
        { data: biobased },
        { data: energy },
        { data: water },
      ] = await Promise.all([
        supabase.from("epp_recycled_content").select("id, total_spend"),
        supabase.from("epp_ecolabel").select("id, total_spend"),
        supabase.from("epp_biobased").select("id, total_spend"),
        supabase.from("epp_energy_efficient").select("id, total_spend"),
        supabase.from("epp_water_efficient").select("id, total_spend"),
      ]);

      const sumSpend = (rows: { total_spend: number | null }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + (r.total_spend ?? 0), 0);

      const summary: CategorySummaryRow[] = [
        {
          category: "recycled_content",
          label: "Recycled Content",
          product_count: (recycled ?? []).length,
          total_spend: sumSpend(recycled as { total_spend: number | null }[]),
        },
        {
          category: "ecolabel",
          label: "Ecolabel",
          product_count: (ecolabel ?? []).length,
          total_spend: sumSpend(ecolabel as { total_spend: number | null }[]),
        },
        {
          category: "biobased",
          label: "Biobased",
          product_count: (biobased ?? []).length,
          total_spend: sumSpend(biobased as { total_spend: number | null }[]),
        },
        {
          category: "energy_efficient",
          label: "Energy Efficient",
          product_count: (energy ?? []).length,
          total_spend: sumSpend(energy as { total_spend: number | null }[]),
        },
        {
          category: "water_efficient",
          label: "Water Efficient",
          product_count: (water ?? []).length,
          total_spend: sumSpend(water as { total_spend: number | null }[]),
        },
      ];

      setCategorySummary(summary);
      setActiveReport("summary_by_category");
    } catch (err) {
      setError("Failed to load category summary. Please try again.");
      console.error(err);
    } finally {
      setRunning(null);
    }
  }

  // ── Progress Report ────────────────────────────────────────────────────────
  async function runProgress() {
    setRunning("progress");
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("epp_contract_cycles")
        .select(
          `id, epp_status, total_contract_spend, total_epp_spend,
           epp_percentage, epp_categories,
           contract_cycles!inner(
             name, fiscal_year,
             contracts!inner(contract_number, supplier_name)
           )`
        )
        .not("epp_status", "eq", "new_contract")
        .order("created_at");

      if (qErr) throw qErr;

      const rows: ProgressRow[] = (data ?? []).map((r: Record<string, unknown>) => {
        const cc = r.contract_cycles as Record<string, unknown>;
        const ct = cc?.contracts as Record<string, unknown>;
        return {
          id: r.id as string,
          contract_number: ct?.contract_number as string,
          supplier_name: ct?.supplier_name as string,
          cycle_name: cc?.name as string,
          fiscal_year: cc?.fiscal_year as string | null,
          total_contract_spend: r.total_contract_spend as number | null,
          total_epp_spend: r.total_epp_spend as number | null,
          epp_percentage: r.epp_percentage as number | null,
          epp_status: r.epp_status as string,
          epp_categories: Array.isArray(r.epp_categories)
            ? (r.epp_categories as string[])
            : [],
        };
      });

      setProgressRows(rows);
      setActiveReport("progress");
    } catch (err) {
      setError("Failed to load progress report. Please try again.");
      console.error(err);
    } finally {
      setRunning(null);
    }
  }

  // ── Finalized Reports ──────────────────────────────────────────────────────
  async function runFinalized() {
    setRunning("finalized");
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("epp_contract_cycles")
        .select(
          `id, total_contract_spend, total_epp_spend, epp_percentage,
           epp_admin_reviewed_by, epp_admin_reviewed_at,
           contract_cycles!inner(
             name, fiscal_year,
             contracts!inner(contract_number, supplier_name)
           )`
        )
        .eq("epp_status", "finalized")
        .order("epp_admin_reviewed_at", { ascending: false });

      if (qErr) throw qErr;

      const rows: FinalizedRow[] = (data ?? []).map((r: Record<string, unknown>) => {
        const cc = r.contract_cycles as Record<string, unknown>;
        const ct = cc?.contracts as Record<string, unknown>;
        return {
          id: r.id as string,
          contract_number: ct?.contract_number as string,
          supplier_name: ct?.supplier_name as string,
          cycle_name: cc?.name as string,
          fiscal_year: cc?.fiscal_year as string | null,
          total_contract_spend: r.total_contract_spend as number | null,
          total_epp_spend: r.total_epp_spend as number | null,
          epp_percentage: r.epp_percentage as number | null,
          epp_admin_reviewed_at: r.epp_admin_reviewed_at as string | null,
          epp_admin_reviewed_by: r.epp_admin_reviewed_by as string | null,
        };
      });

      setFinalizedRows(rows);
      setActiveReport("finalized");
    } catch (err) {
      setError("Failed to load finalized reports. Please try again.");
      console.error(err);
    } finally {
      setRunning(null);
    }
  }

  function handleRun(id: ReportId) {
    setActiveReport(null);
    setError(null);
    if (id === "data_dump") runDataDump();
    else if (id === "summary_by_category") runSummaryByCategory();
    else if (id === "progress") runProgress();
    else if (id === "finalized") runFinalized();
  }

  function handleExportCsv() {
    if (activeReport === "summary_by_category") {
      const headers = ["category", "label", "product_count", "total_spend"];
      const csv = rowsToCsv(
        headers,
        categorySummary as unknown as Record<string, unknown>[]
      );
      triggerDownload(csv, "epp_summary_by_category.csv");
    } else if (activeReport === "progress") {
      const headers = [
        "contract_number", "supplier_name", "cycle_name", "fiscal_year",
        "total_contract_spend", "total_epp_spend", "epp_percentage",
        "epp_status", "epp_categories",
      ];
      const rows = progressRows.map((r) => ({
        ...r,
        epp_categories: r.epp_categories.join("; "),
      }));
      const csv = rowsToCsv(headers, rows as unknown as Record<string, unknown>[]);
      triggerDownload(csv, "epp_progress_report.csv");
    } else if (activeReport === "finalized") {
      const headers = [
        "contract_number", "supplier_name", "cycle_name", "fiscal_year",
        "total_contract_spend", "total_epp_spend", "epp_percentage",
        "epp_admin_reviewed_at",
      ];
      const csv = rowsToCsv(headers, finalizedRows as unknown as Record<string, unknown>[]);
      triggerDownload(csv, "epp_finalized_reports.csv");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">EPP Reports</h1>
          <p className="page-subtitle">
            Generate and export Environmentally Preferable Purchasing compliance reports.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Report Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {REPORTS.map((report) => {
          const isRunning = running === report.id;
          return (
            <div
              key={report.id}
              className="card"
              style={{ display: "flex", flexDirection: "column" }}
            >
              {/* Accent bar */}
              <div
                style={{
                  height: 4,
                  background: report.accentColor,
                  borderRadius: "8px 8px 0 0",
                }}
              />
              <div
                className="card-body"
                style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* Icon + title */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: `${report.accentColor}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={report.accentColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={report.iconPath} />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--text)",
                        lineHeight: 1.3,
                      }}
                    >
                      {report.title}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.55,
                    flex: 1,
                  }}
                >
                  {report.description}
                </p>

                {/* Run button */}
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleRun(report.id)}
                  disabled={running !== null}
                  style={{
                    alignSelf: "flex-start",
                    borderColor: report.accentColor,
                    color: report.accentColor,
                  }}
                >
                  {isRunning ? (
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          border: `2px solid ${report.accentColor}`,
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      Running…
                    </>
                  ) : (
                    "Run Report"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Results Panel ── */}
      {activeReport === "summary_by_category" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">EPP Summary by Category</h2>
            <button className="btn btn-outline btn-sm" onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>
          {categorySummary.length === 0 ? (
            <div
              className="card-body"
              style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}
            >
              No product data found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EPP Category</th>
                    <th style={{ textAlign: "right" }}>Product Entries</th>
                    <th style={{ textAlign: "right" }}>Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummary.map((row) => (
                    <tr key={row.category}>
                      <td style={{ fontWeight: 600 }}>{row.label}</td>
                      <td style={{ textAlign: "right" }}>{row.product_count.toLocaleString()}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatCurrency(row.total_spend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ fontWeight: 700, padding: "10px 14px" }}>Total</td>
                    <td style={{ textAlign: "right", fontWeight: 700, padding: "10px 14px" }}>
                      {categorySummary
                        .reduce((s, r) => s + r.product_count, 0)
                        .toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, padding: "10px 14px" }}>
                      {formatCurrency(
                        categorySummary.reduce((s, r) => s + r.total_spend, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {activeReport === "progress" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">EPP Progress Report ({progressRows.length})</h2>
            <button className="btn btn-outline btn-sm" onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>
          {progressRows.length === 0 ? (
            <div
              className="card-body"
              style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}
            >
              No active EPP contract cycles found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract #</th>
                    <th>Supplier</th>
                    <th>Cycle</th>
                    <th>FY</th>
                    <th style={{ textAlign: "right" }}>Contract Spend</th>
                    <th style={{ textAlign: "right" }}>EPP Spend</th>
                    <th style={{ textAlign: "right" }}>EPP %</th>
                    <th>Status</th>
                    <th>Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {progressRows.map((row) => {
                    const pct = row.epp_percentage ?? 0;
                    const pctColor =
                      pct >= 50
                        ? "var(--success)"
                        : pct >= 25
                        ? "var(--warning)"
                        : "var(--danger)";
                    return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 600 }}>{row.contract_number}</td>
                        <td>{row.supplier_name}</td>
                        <td>{row.cycle_name}</td>
                        <td>{row.fiscal_year ?? "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(row.total_contract_spend)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(row.total_epp_spend)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, color: pctColor }}>
                            {formatPct(row.epp_percentage)}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-blue" style={{ fontSize: 11 }}>
                            {row.epp_status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {row.epp_categories.length > 0
                              ? row.epp_categories.map((c) => (
                                  <span
                                    key={c}
                                    className="badge badge-green"
                                    style={{ fontSize: 10 }}
                                  >
                                    {c.replace(/_/g, " ")}
                                  </span>
                                ))
                              : "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeReport === "finalized" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Finalized EPP Reports ({finalizedRows.length})</h2>
            <button className="btn btn-outline btn-sm" onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>
          {finalizedRows.length === 0 ? (
            <div
              className="card-body"
              style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}
            >
              No finalized EPP reports found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract #</th>
                    <th>Supplier</th>
                    <th>Cycle</th>
                    <th>FY</th>
                    <th style={{ textAlign: "right" }}>Contract Spend</th>
                    <th style={{ textAlign: "right" }}>EPP Spend</th>
                    <th style={{ textAlign: "right" }}>EPP %</th>
                    <th>Finalized</th>
                  </tr>
                </thead>
                <tbody>
                  {finalizedRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.contract_number}</td>
                      <td>{row.supplier_name}</td>
                      <td>{row.cycle_name}</td>
                      <td>{row.fiscal_year ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCurrency(row.total_contract_spend)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {formatCurrency(row.total_epp_spend)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                        {formatPct(row.epp_percentage)}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {row.epp_admin_reviewed_at
                          ? formatDate(row.epp_admin_reviewed_at)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
