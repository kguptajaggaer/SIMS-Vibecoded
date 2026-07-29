"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, getUser, formatCurrency } from "@/lib/supabase";
import type { User } from "@/lib/types";

const CLASSIFICATIONS = [
  "Small Business",
  "Minority-Owned",
  "Women-Owned",
  "Veteran-Owned",
  "Service-Disabled Veteran",
  "HUBZone",
  "Large Business",
];

interface VendorRow {
  id?: string;
  vendor_name: string;
  vendor_apex: string;
  classifications: string[];
  subk_units: string;
  direct_expense: string;
  indirect_expense: string;
  notes: string;
  isEditing?: boolean;
  isNew?: boolean;
}

function emptyVendor(): VendorRow {
  return {
    vendor_name: "",
    vendor_apex: "",
    classifications: [],
    subk_units: "",
    direct_expense: "",
    indirect_expense: "",
    notes: "",
    isNew: true,
    isEditing: true,
  };
}

// ── Checkboxes Dropdown ──────────────────────────────────────────────────────
function ClassificationsDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(c: string) {
    if (selected.includes(c)) onChange(selected.filter((x) => x !== c));
    else onChange([...selected, c]);
  }

  const label =
    selected.length === 0
      ? "Select…"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 160 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "5px 8px",
          border: "1px solid var(--border)",
          borderRadius: 4,
          background: "var(--surface)",
          cursor: "pointer",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ marginLeft: 6, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            top: "100%",
            left: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            padding: "6px 0",
            minWidth: 200,
          }}
        >
          {CLASSIFICATIONS.map((c) => (
            <label
              key={c}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(c)}
                onChange={() => toggle(c)}
                style={{ margin: 0 }}
              />
              {c}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SupplierSpendDataEntry() {
  const { contractId, cycleId } = useParams<{ contractId: string; cycleId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cycle, setCycle] = useState<{
    name: string;
    goals?: string;
    supplier_status: string;
    status: string;
  } | null>(null);
  const [contract, setContract] = useState<{
    contract_number: string;
    contract_officer: string;
  } | null>(null);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tab, setTab] = useState<"form" | "import">("form");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);

  void router;
  void user;

  const isReadOnly = cycle?.supplier_status === "supplier_reported";

  useEffect(() => {
    setUser(getUser());
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function loadData() {
    setLoading(true);
    const [{ data: cy }, { data: c }, { data: vData }] = await Promise.all([
      supabase
        .from("contract_cycles")
        .select("name,goals,supplier_status,status")
        .eq("id", cycleId)
        .single(),
      supabase
        .from("contracts")
        .select("contract_number,contract_officer")
        .eq("id", contractId)
        .single(),
      supabase
        .from("subcontractors")
        .select("*")
        .eq("contract_cycle_id", cycleId)
        .order("vendor_name"),
    ]);
    setCycle(cy);
    setContract(c);
    setVendors(
      (vData || []).map(
        (v: {
          id: string;
          vendor_name: string;
          vendor_apex?: string;
          classifications: string[];
          subk_units?: number;
          direct_expense: number;
          indirect_expense: number;
          notes?: string;
        }) => ({
          id: v.id,
          vendor_name: v.vendor_name,
          vendor_apex: v.vendor_apex || "",
          classifications: v.classifications || [],
          subk_units: v.subk_units?.toString() || "",
          direct_expense: v.direct_expense?.toString() || "",
          indirect_expense: v.indirect_expense?.toString() || "",
          notes: v.notes || "",
          isEditing: false,
        })
      )
    );
    setLoading(false);
  }

  function updateVendor(idx: number, patch: Partial<VendorRow>) {
    setVendors((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function saveVendor(idx: number) {
    const v = vendors[idx];
    if (!v.vendor_name.trim()) {
      setMsg({ type: "error", text: "Vendor name is required." });
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload = {
      contract_cycle_id: cycleId,
      vendor_name: v.vendor_name.trim(),
      vendor_apex: v.vendor_apex.trim() || null,
      classifications: v.classifications,
      subk_units: v.subk_units ? parseInt(v.subk_units) : null,
      direct_expense: parseFloat(v.direct_expense) || 0,
      indirect_expense: parseFloat(v.indirect_expense) || 0,
      notes: v.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (v.id) {
      await supabase.from("subcontractors").update(payload).eq("id", v.id);
      updateVendor(idx, { isEditing: false, isNew: false });
    } else {
      const { data: inserted } = await supabase
        .from("subcontractors")
        .insert(payload)
        .select()
        .single();
      if (inserted) {
        updateVendor(idx, { id: inserted.id, isNew: false, isEditing: false });
      }
    }
    setSaving(false);
  }

  async function deleteVendor(idx: number) {
    const v = vendors[idx];
    if (v.id) {
      await supabase.from("subcontractors").delete().eq("id", v.id);
    }
    setVendors((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitForReview() {
    const saved = vendors.filter((v) => !v.isNew && v.id);
    if (saved.length === 0) {
      setMsg({ type: "error", text: "Please save at least one vendor before submitting." });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("contract_cycles")
      .update({
        supplier_status: "supplier_reported",
        status: "ready_for_co_review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cycleId);
    if (error) {
      setMsg({ type: "error", text: "Failed to submit. Please try again." });
    } else {
      setMsg({ type: "success", text: "Submitted successfully! Waiting for CO review." });
      await loadData();
    }
    setSubmitting(false);
  }

  // ── Import helpers ─────────────────────────────────────────────────────────
  function downloadTemplate() {
    const headers = [
      "VendorName",
      "VendorAPEX",
      "Classifications",
      "SubKUnits",
      "DirectExpense",
      "IndirectExpense",
      "Notes",
    ];
    const sample = [
      "ACME Corp",
      "APX123",
      "Small Business;Minority-Owned",
      "5",
      "10000.00",
      "5000.00",
      "Sample vendor note",
    ];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subcontractor_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text
        .trim()
        .split("\n")
        .map((r) => r.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      setImportPreview(rows.slice(0, 6));
    };
    reader.readAsText(file);
  }

  async function importVendors() {
    if (!importFile) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const rows = text.trim().split("\n").slice(1);
      let count = 0;
      for (const row of rows) {
        const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (!cols[0]) continue;
        await supabase.from("subcontractors").insert({
          contract_cycle_id: cycleId,
          vendor_name: cols[0],
          vendor_apex: cols[1] || null,
          classifications: cols[2] ? cols[2].split(";").map((c) => c.trim()) : [],
          subk_units: cols[3] ? parseInt(cols[3]) : null,
          direct_expense: parseFloat(cols[4]) || 0,
          indirect_expense: parseFloat(cols[5]) || 0,
          notes: cols[6] || null,
        });
        count++;
      }
      setMsg({ type: "success", text: `Imported ${count} vendor${count !== 1 ? "s" : ""} successfully.` });
      setImportFile(null);
      setImportPreview([]);
      await loadData();
      setSaving(false);
    };
    reader.readAsText(importFile);
  }

  // ── Derived totals ─────────────────────────────────────────────────────────
  const savedVendors = vendors.filter((v) => !v.isNew && v.id);
  const totalDirect = savedVendors.reduce((s, v) => s + (parseFloat(v.direct_expense) || 0), 0);
  const totalIndirect = savedVendors.reduce(
    (s, v) => s + (parseFloat(v.indirect_expense) || 0),
    0
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading…
      </div>
    );

  const colCount = isReadOnly ? 8 : 9; // Vendor, APEX, Classifications, SubKUnits, Direct, Indirect, Total, Notes [, Actions]

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/supplier/subk/spend-data" style={{ color: "var(--usps-blue)" }}>
          Spend Data
        </Link>
        {" / "}
        {contract?.contract_number} – {cycle?.name}
      </div>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {contract?.contract_number} — {cycle?.name}
          </h1>
          <p className="page-subtitle">CO: {contract?.contract_officer}</p>
        </div>
        {isReadOnly ? (
          <span className="badge badge-green" style={{ fontSize: 14, padding: "6px 14px" }}>
            ✓ Submitted for Review
          </span>
        ) : (
          <button
            className="btn btn-success"
            onClick={submitForReview}
            disabled={submitting || savedVendors.length === 0}
          >
            {submitting ? "Submitting…" : "Submit for CO Review →"}
          </button>
        )}
      </div>

      {/* Goals */}
      {cycle?.goals && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>Goals:</strong> {cycle.goals}
        </div>
      )}

      {/* Message banner */}
      {msg && (
        <div
          className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: 16 }}
        >
          {msg.text}
        </div>
      )}

      {/* Summary stats */}
      {savedVendors.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {(
            [
              ["Vendors", savedVendors.length.toString()],
              ["Total Direct", formatCurrency(totalDirect)],
              ["Total Indirect", formatCurrency(totalIndirect)],
              ["Total Spend", formatCurrency(totalDirect + totalIndirect)],
            ] as [string, string][]
          ).map(([label, val]) => (
            <div key={label} className="stat-widget">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {val}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs — hidden when read-only */}
      {!isReadOnly && (
        <div className="tabs">
          <button
            className={`tab${tab === "form" ? " active" : ""}`}
            onClick={() => setTab("form")}
          >
            Enter by Form
          </button>
          <button
            className={`tab${tab === "import" ? " active" : ""}`}
            onClick={() => setTab("import")}
          >
            Import Template
          </button>
        </div>
      )}

      {/* ── Form Tab ──────────────────────────────────────────────────────────── */}
      {(tab === "form" || isReadOnly) && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Vendor / Subcontractor Data</h2>
            {!isReadOnly && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setVendors((prev) => [...prev, emptyVendor()])}
              >
                + Add Vendor
              </button>
            )}
          </div>

          {vendors.length === 0 ? (
            <div
              className="card-body"
              style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}
            >
              No vendors added yet. Click &quot;Add Vendor&quot; to start.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor Name *</th>
                    <th>APEX</th>
                    <th>Classifications</th>
                    <th>SubK Units</th>
                    <th>Direct Expense ($)</th>
                    <th>Indirect Expense ($)</th>
                    <th>Total</th>
                    <th>Notes</th>
                    {!isReadOnly && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v, idx) =>
                    v.isEditing ? (
                      // ── Edit row ──────────────────────────────────────────
                      <tr key={idx}>
                        <td>
                          <input
                            className="form-input"
                            placeholder="Vendor name"
                            value={v.vendor_name}
                            onChange={(e) => updateVendor(idx, { vendor_name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            placeholder="APEX #"
                            value={v.vendor_apex}
                            onChange={(e) => updateVendor(idx, { vendor_apex: e.target.value })}
                          />
                        </td>
                        <td>
                          <ClassificationsDropdown
                            selected={v.classifications}
                            onChange={(vals) => updateVendor(idx, { classifications: vals })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="0"
                            min={0}
                            value={v.subk_units}
                            onChange={(e) => updateVendor(idx, { subk_units: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="0.00"
                            min={0}
                            step="0.01"
                            value={v.direct_expense}
                            onChange={(e) =>
                              updateVendor(idx, { direct_expense: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="0.00"
                            min={0}
                            step="0.01"
                            value={v.indirect_expense}
                            onChange={(e) =>
                              updateVendor(idx, { indirect_expense: e.target.value })
                            }
                          />
                        </td>
                        <td style={{ background: "#f8fafc", fontWeight: 600 }}>
                          {formatCurrency(
                            (parseFloat(v.direct_expense) || 0) +
                              (parseFloat(v.indirect_expense) || 0)
                          )}
                        </td>
                        <td>
                          <input
                            className="form-input"
                            placeholder="Optional note"
                            value={v.notes}
                            onChange={(e) => updateVendor(idx, { notes: e.target.value })}
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => saveVendor(idx)}
                              disabled={saving}
                            >
                              {saving ? "…" : "Save"}
                            </button>
                            {v.isNew && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  setVendors((prev) => prev.filter((_, i) => i !== idx))
                                }
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // ── Read row ──────────────────────────────────────────
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{v.vendor_name}</td>
                        <td>{v.vendor_apex || "—"}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {v.classifications.length > 0
                              ? v.classifications.map((c) => (
                                  <span
                                    key={c}
                                    className="badge badge-blue"
                                    style={{ fontSize: 10 }}
                                  >
                                    {c}
                                  </span>
                                ))
                              : "—"}
                          </div>
                        </td>
                        <td>{v.subk_units || "—"}</td>
                        <td>{formatCurrency(parseFloat(v.direct_expense) || 0)}</td>
                        <td>{formatCurrency(parseFloat(v.indirect_expense) || 0)}</td>
                        <td style={{ fontWeight: 600, background: "#f8fafc" }}>
                          {formatCurrency(
                            (parseFloat(v.direct_expense) || 0) +
                              (parseFloat(v.indirect_expense) || 0)
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {v.notes || "—"}
                        </td>
                        {!isReadOnly && (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => updateVendor(idx, { isEditing: true })}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteVendor(idx)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
                {savedVendors.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#f8fafc" }}>
                      <td
                        colSpan={4}
                        style={{ fontWeight: 700, padding: "10px 14px" }}
                      >
                        Totals
                      </td>
                      <td style={{ fontWeight: 700, padding: "10px 14px" }}>
                        {formatCurrency(totalDirect)}
                      </td>
                      <td style={{ fontWeight: 700, padding: "10px 14px" }}>
                        {formatCurrency(totalIndirect)}
                      </td>
                      <td style={{ fontWeight: 700, padding: "10px 14px" }}>
                        {formatCurrency(totalDirect + totalIndirect)}
                      </td>
                      <td colSpan={isReadOnly ? 1 : 2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Import Tab ────────────────────────────────────────────────────────── */}
      {tab === "import" && !isReadOnly && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Import via Template</h2>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Step 1 */}
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Step 1 — Download the template
              </p>
              <button
                className="btn btn-outline btn-sm"
                onClick={downloadTemplate}
              >
                Download CSV Template
              </button>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Columns: VendorName, VendorAPEX, Classifications (semicolon-separated),
                SubKUnits, DirectExpense, IndirectExpense, Notes
              </p>
            </div>

            {/* Step 2 */}
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Step 2 — Upload your filled template
              </p>
              <input type="file" accept=".csv" onChange={handleFileChange} />
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Preview (first {importPreview.length} rows)
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} style={{ background: i === 0 ? "#f8fafc" : undefined }}>
                          {row.map((cell, j) => (
                            <td key={j} style={{ fontSize: 12 }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={importVendors}
                  disabled={saving}
                >
                  {saving ? "Importing…" : "Confirm Import"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/supplier/subk/spend-data" className="btn btn-ghost">
          ← Back to Contracts
        </Link>
        {!isReadOnly && savedVendors.length > 0 && (
          <button
            className="btn btn-success"
            onClick={submitForReview}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit for CO Review →"}
          </button>
        )}
      </div>

      {/* Suppress unused colCount warning */}
      <span style={{ display: "none" }}>{colCount}</span>
    </div>
  );
}
