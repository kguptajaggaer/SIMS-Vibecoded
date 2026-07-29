"use client";
import { useEffect, useState } from "react";
import { supabase, getUser, formatCurrency } from "@/lib/supabase";
import type { User } from "@/lib/types";

const CLASSIFICATIONS = [
  "Small Business",
  "Minority-Owned",
  "Women-Owned",
  "Veteran-Owned",
  "HUBZone",
  "Service-Disabled Veteran",
];

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Small Business": "badge-blue",
  "Minority-Owned": "badge-purple",
  "Women-Owned": "badge-pink",
  "Veteran-Owned": "badge-orange",
  "HUBZone": "badge-green",
  "Service-Disabled Veteran": "badge-yellow",
};

interface SubcontractorRow {
  id: string;
  vendor_name: string;
  vendor_apex: string;
  classifications: string[];
  contract_number: string;
  cycle_name: string;
  contract_cycle_id: string;
  subk_units: number | null;
  total_expense: number;
}

interface VendorForm {
  vendor_name: string;
  vendor_apex: string;
  classifications: string[];
}

const emptyForm = (): VendorForm => ({
  vendor_name: "",
  vendor_apex: "",
  classifications: [],
});

/* ── Reusable modal shell ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: 10, width: "100%", maxWidth: 560,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--usps-blue-light, #e8f0fe)",
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--usps-blue)" }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, lineHeight: 1, color: "var(--text-muted)",
              padding: "0 4px",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Classification checkboxes ── */
function ClassificationCheckboxes({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(c: string, checked: boolean) {
    onChange(checked ? [...value, c] : value.filter(x => x !== c));
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 4 }}>
      {CLASSIFICATIONS.map(c => (
        <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={value.includes(c)}
            onChange={e => toggle(c, e.target.checked)}
          />
          {c}
        </label>
      ))}
    </div>
  );
}

/* ── Main page ── */
export default function DiverseSuppliers() {
  const [user, setUser] = useState<User | null>(null);
  const [vendors, setVendors] = useState<SubcontractorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<VendorForm>(emptyForm());
  const [addSaving, setAddSaving] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<SubcontractorRow | null>(null);
  const [editForm, setEditForm] = useState<VendorForm>(emptyForm());
  const [editSaving, setEditSaving] = useState(false);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.supplier_id) loadData(u.supplier_id);
    else setLoading(false);
  }, []);

  async function loadData(supplierId: string) {
    setLoading(true);

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, contract_number")
      .eq("supplier_id", supplierId);

    const contractIds = (contracts || []).map((c: { id: string }) => c.id);
    if (!contractIds.length) { setLoading(false); return; }

    const { data: cycles } = await supabase
      .from("contract_cycles")
      .select("id, name, contract_id")
      .in("contract_id", contractIds);

    const cycleIds = (cycles || []).map((c: { id: string }) => c.id);
    if (!cycleIds.length) { setLoading(false); return; }

    const { data: vData } = await supabase
      .from("subcontractors")
      .select("id, vendor_name, vendor_apex, classifications, contract_cycle_id, subk_units, total_expense")
      .in("contract_cycle_id", cycleIds)
      .order("vendor_name");

    const contractMap = Object.fromEntries(
      (contracts || []).map((c: { id: string; contract_number: string }) => [c.id, c])
    );
    const cycleMap = Object.fromEntries(
      (cycles || []).map((c: { id: string; name: string; contract_id: string }) => [c.id, c])
    );

    const rows: SubcontractorRow[] = (vData || []).map((v: {
      id: string;
      vendor_name: string;
      vendor_apex?: string;
      classifications: string[];
      contract_cycle_id: string;
      subk_units?: number | null;
      total_expense?: number;
    }) => {
      const cycle = cycleMap[v.contract_cycle_id];
      const contract = cycle ? contractMap[cycle.contract_id] : null;
      return {
        id: v.id,
        vendor_name: v.vendor_name,
        vendor_apex: v.vendor_apex || "",
        classifications: v.classifications || [],
        contract_number: contract?.contract_number || "—",
        cycle_name: cycle?.name || "—",
        contract_cycle_id: v.contract_cycle_id,
        subk_units: v.subk_units ?? null,
        total_expense: v.total_expense || 0,
      };
    });

    setVendors(rows);
    setLoading(false);
  }

  async function getLatestCycleId(supplierId: string): Promise<string | null> {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id")
      .eq("supplier_id", supplierId);
    const ids = (contracts || []).map((c: { id: string }) => c.id);
    if (!ids.length) return null;

    const { data: cycle } = await supabase
      .from("contract_cycles")
      .select("id")
      .in("contract_id", ids)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return cycle?.id ?? null;
  }

  /* ── Add ── */
  function openAdd() {
    setAddForm(emptyForm());
    setMsg(null);
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!addForm.vendor_name.trim()) {
      setMsg({ type: "error", text: "Vendor name is required." });
      return;
    }
    if (!user?.supplier_id) return;
    setAddSaving(true);
    setMsg(null);

    const cycleId = await getLatestCycleId(user.supplier_id);
    if (!cycleId) {
      setMsg({ type: "error", text: "No reporting cycle found. Contact your Contract Officer." });
      setAddSaving(false);
      return;
    }

    const { error } = await supabase.from("subcontractors").insert({
      contract_cycle_id: cycleId,
      vendor_name: addForm.vendor_name.trim(),
      vendor_apex: addForm.vendor_apex.trim() || null,
      classifications: addForm.classifications,
      direct_expense: 0,
      indirect_expense: 0,
    });

    if (error) {
      setMsg({ type: "error", text: "Failed to add vendor. Please try again." });
    } else {
      setMsg({ type: "success", text: `"${addForm.vendor_name.trim()}" added successfully.` });
      setShowAdd(false);
      await loadData(user.supplier_id);
    }
    setAddSaving(false);
  }

  /* ── Edit ── */
  function openEdit(row: SubcontractorRow) {
    setEditTarget(row);
    setEditForm({
      vendor_name: row.vendor_name,
      vendor_apex: row.vendor_apex,
      classifications: [...row.classifications],
    });
    setMsg(null);
  }

  async function submitEdit() {
    if (!editTarget) return;
    if (!editForm.vendor_name.trim()) {
      setMsg({ type: "error", text: "Vendor name is required." });
      return;
    }
    setEditSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("subcontractors")
      .update({
        vendor_name: editForm.vendor_name.trim(),
        vendor_apex: editForm.vendor_apex.trim() || null,
        classifications: editForm.classifications,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editTarget.id);

    if (error) {
      setMsg({ type: "error", text: "Failed to save changes." });
    } else {
      setMsg({ type: "success", text: "Vendor updated." });
      setEditTarget(null);
      if (user?.supplier_id) await loadData(user.supplier_id);
    }
    setEditSaving(false);
  }

  /* ── Delete ── */
  async function deleteVendor(row: SubcontractorRow) {
    if (!confirm(`Delete "${row.vendor_name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("subcontractors").delete().eq("id", row.id);
    if (error) {
      setMsg({ type: "error", text: "Failed to delete vendor." });
    } else {
      setMsg({ type: "success", text: `"${row.vendor_name}" deleted.` });
      if (user?.supplier_id) await loadData(user.supplier_id);
    }
  }

  const totalVendors = vendors.length;
  const totalSpend = vendors.reduce((s, v) => s + v.total_expense, 0);
  const diverseCount = vendors.filter(v => v.classifications.length > 0).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">SubK Diverse Suppliers</h1>
          <p className="page-subtitle">Manage your subcontractor and diverse vendor list</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add Subcontractor
        </button>
      </div>

      {/* Alert */}
      {msg && (
        <div
          className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: 16 }}
        >
          {msg.text}
        </div>
      )}

      {/* Summary stats */}
      {!loading && totalVendors > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            ["Total Vendors", totalVendors.toString()],
            ["Diverse Vendors", diverseCount.toString()],
            ["Total Subcontract Spend", formatCurrency(totalSpend)],
          ].map(([label, val]) => (
            <div key={label} className="stat-widget">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading vendors…</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>APEX</th>
                  <th>Classifications</th>
                  <th>Contract</th>
                  <th>SubK Units</th>
                  <th>Total Expense</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                      No vendors yet. Click &quot;Add Subcontractor&quot; to get started.
                    </td>
                  </tr>
                ) : (
                  vendors.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.vendor_name}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.vendor_apex || "—"}</td>
                      <td>
                        {v.classifications.length === 0 ? (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {v.classifications.map(c => (
                              <span
                                key={c}
                                className={`badge ${CLASSIFICATION_COLORS[c] || "badge-gray"}`}
                                style={{ fontSize: 10, whiteSpace: "nowrap" }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{v.contract_number}</td>
                      <td style={{ textAlign: "right" }}>
                        {v.subk_units != null ? v.subk_units.toLocaleString() : "—"}
                      </td>
                      <td style={{ fontWeight: 600, textAlign: "right" }}>
                        {v.total_expense ? formatCurrency(v.total_expense) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(v)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteVendor(v)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {vendors.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={4} style={{ fontWeight: 700, padding: "10px 14px" }}>
                      Totals ({totalVendors} vendor{totalVendors !== 1 ? "s" : ""})
                    </td>
                    <td />
                    <td style={{ fontWeight: 700, padding: "10px 14px", textAlign: "right" }}>
                      {formatCurrency(totalSpend)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {showAdd && (
        <Modal title="Add New Subcontractor" onClose={() => setShowAdd(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">Vendor Name <span style={{ color: "red" }}>*</span></label>
              <input
                className="form-input"
                placeholder="Company name"
                value={addForm.vendor_name}
                onChange={e => setAddForm({ ...addForm, vendor_name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">APEX Number</label>
              <input
                className="form-input"
                placeholder="APEX identifier"
                value={addForm.vendor_apex}
                onChange={e => setAddForm({ ...addForm, vendor_apex: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Classifications</label>
              <ClassificationCheckboxes
                value={addForm.classifications}
                onChange={cls => setAddForm({ ...addForm, classifications: cls })}
              />
            </div>
            {msg?.type === "error" && (
              <div className="alert alert-error" style={{ margin: 0 }}>{msg.text}</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)} disabled={addSaving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitAdd} disabled={addSaving}>
                {addSaving ? "Saving…" : "Add Vendor"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.vendor_name}`} onClose={() => setEditTarget(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">Vendor Name <span style={{ color: "red" }}>*</span></label>
              <input
                className="form-input"
                value={editForm.vendor_name}
                onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">APEX Number</label>
              <input
                className="form-input"
                value={editForm.vendor_apex}
                onChange={e => setEditForm({ ...editForm, vendor_apex: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Classifications</label>
              <ClassificationCheckboxes
                value={editForm.classifications}
                onChange={cls => setEditForm({ ...editForm, classifications: cls })}
              />
            </div>
            {msg?.type === "error" && (
              <div className="alert alert-error" style={{ margin: 0 }}>{msg.text}</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setEditTarget(null)} disabled={editSaving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
