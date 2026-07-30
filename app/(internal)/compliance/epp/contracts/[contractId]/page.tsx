"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency, formatPct } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import type { User, Contract, ContractCycle, EppContractCycle } from "@/lib/types";

const EPP_CATEGORY_LABELS: Record<string, string> = {
  recycled_content: "Recycled Content",
  ecolabel: "Independent Ecolabel",
  biobased: "Bio-Based",
  energy_efficient: "Energy Efficient",
  water_efficient: "Water Efficient",
};

interface EppCycleRow {
  cycle: ContractCycle;
  eppCycle: EppContractCycle | null;
}

interface Attachment {
  id: string;
  slot_number: number;
  file_name: string;
  file_url: string;
  description?: string;
  file_size?: number;
}

export default function EppContractDetail() {
  const { contractId } = useParams<{ contractId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [cycleRows, setCycleRows] = useState<EppCycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddCycle, setShowAddCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: "", fiscal_year: "", start_date: "", end_date: "", goals: "" });
  const [savingCycle, setSavingCycle] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    loadData();
  }, [contractId]);

  async function loadData() {
    setLoading(true);
    const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).single();
    setContract(c);

    const { data: cycles } = await supabase
      .from("contract_cycles")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });

    const rows: EppCycleRow[] = [];
    for (const cycle of (cycles || [])) {
      const { data: eppCycle } = await supabase
        .from("epp_contract_cycles")
        .select("*")
        .eq("contract_cycle_id", cycle.id)
        .single();
      rows.push({ cycle, eppCycle });
    }
    setCycleRows(rows);
    const { data: docs } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("contract_id", contractId)
      .order("slot_number", { ascending: true });
    setAttachments((docs as Attachment[]) || []);
    setLoading(false);
  }

  async function approveEpp(eppCycleId: string, currentStatus: string, approve: boolean) {
    if (!user) return;
    const roleName = (user.role as { name?: string })?.name;
    const nextStatus = approve
      ? currentStatus === "ready_for_co_review" ? "ready_for_epp_admin_review"
        : currentStatus === "ready_for_epp_admin_review" ? "finalized"
        : null
      : "open_for_reporting";

    if (!nextStatus) return;

    const updates: Record<string, unknown> = { epp_status: nextStatus, updated_at: new Date().toISOString() };
    if (currentStatus === "ready_for_co_review" && approve) {
      updates.co_reviewed_by = user.id;
      updates.co_reviewed_at = new Date().toISOString();
    } else if (currentStatus === "ready_for_epp_admin_review" && approve) {
      updates.epp_admin_reviewed_by = user.id;
      updates.epp_admin_reviewed_at = new Date().toISOString();
    }

    const { error } = await supabase.from("epp_contract_cycles").update(updates).eq("id", eppCycleId);
    if (error) {
      setMsg({ type: "error", text: "Failed to update EPP status." });
    } else {
      setMsg({ type: "success", text: approve ? "Approved." : "Returned to supplier." });
      // Fire status-change notification (best-effort)
      if (contract) {
        fetch("/api/email/contract-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId,
            contractNumber: contract.contract_number,
            supplierName: contract.supplier_name,
            supplierEmail: (contract as any).supplier_contact_email ?? "",
            contractOfficer: contract.contract_officer,
            contractOfficerEmail: contract.contract_officer_email ?? "",
            newStatus: nextStatus,
            oldStatus: currentStatus,
            contractModule: "epp",
          }),
        }).catch(() => {});
      }
      await loadData();
    }
    void roleName;
  }

  async function addCycle(e: React.FormEvent) {
    e.preventDefault();
    if (!cycleForm.name) return;
    setSavingCycle(true);
    const { error } = await supabase.from("contract_cycles").insert({
      contract_id: contractId,
      name: cycleForm.name,
      fiscal_year: cycleForm.fiscal_year || null,
      start_date: cycleForm.start_date || null,
      end_date: cycleForm.end_date || null,
      goals: cycleForm.goals || null,
      status: "new_contract",
      supplier_status: "pending",
    });
    if (error) {
      setMsg({ type: "error", text: "Failed to create cycle." });
    } else {
      setMsg({ type: "success", text: "Reporting cycle created." });
      setShowAddCycle(false);
      setCycleForm({ name: "", fiscal_year: "", start_date: "", end_date: "", goals: "" });
      await loadData();
    }
    setSavingCycle(false);
  }

  function canApprove(eppStatus: string): boolean {
    if (!user) return false;
    const roleName = (user.role as { name?: string })?.name;
    if (roleName === "admin") return true;
    if (eppStatus === "ready_for_co_review" && roleName === "co") return true;
    if (eppStatus === "ready_for_epp_admin_review" && roleName === "epp_admin") return true;
    return false;
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!contract) return <div className="p-8 text-center text-gray-400">Contract not found.</div>;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/compliance/epp/contracts" style={{ color: "var(--usps-blue)" }}>EPP Contracts</Link>
        {" / "}{contract.contract_number}
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{contract.supplier_name}</h1>
          <p className="page-subtitle">Contract No: {contract.contract_number} · CO: {contract.contract_officer}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/compliance/epp/contracts/${contractId}/edit`} className="btn btn-ghost btn-sm">
            Edit Contract
          </Link>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddCycle(true)}>
            + Add Cycle
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "inherit", opacity: 0.7 }} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Add Cycle inline panel */}
      {showAddCycle && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--usps-blue)" }}>
          <div className="card-header" style={{ background: "var(--usps-blue-light)" }}>
            <h2 className="card-title">New EPP Reporting Cycle</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCycle(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={addCycle} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="form-label">Cycle Name *</label>
                <input className="form-input" value={cycleForm.name} onChange={e => setCycleForm({ ...cycleForm, name: e.target.value })} placeholder="e.g. FY2025 Q1" required />
              </div>
              <div>
                <label className="form-label">Fiscal Year</label>
                <input className="form-input" value={cycleForm.fiscal_year} onChange={e => setCycleForm({ ...cycleForm, fiscal_year: e.target.value })} placeholder="e.g. FY2025" />
              </div>
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={cycleForm.start_date} onChange={e => setCycleForm({ ...cycleForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={cycleForm.end_date} onChange={e => setCycleForm({ ...cycleForm, end_date: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Goals</label>
                <textarea className="form-textarea" value={cycleForm.goals} onChange={e => setCycleForm({ ...cycleForm, goals: e.target.value })} rows={3} placeholder="EPP reporting goals for this cycle…" />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={savingCycle}>{savingCycle ? "Creating…" : "Create Cycle"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2 className="card-title">Contract Details</h2></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px 24px" }}>
            {[
              ["Contract No", contract.contract_number],
              ["Supplier", contract.supplier_name],
              ["APEX", contract.supplier_apex || "—"],
              ["Contract Officer", contract.contract_officer],
              ["Contract Amount", formatCurrency(contract.contract_amount)],
              ["Type", contract.contract_type.toUpperCase()],
              ["Start Date", formatDate(contract.start_date || "")],
              ["Expiration Date", formatDate(contract.expiration_date || "")],
              ["Portfolios", contract.portfolios || "—"],
              ["Commodity", contract.commodity || "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ marginTop: 2, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EPP Reporting Cycles */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">EPP Reporting Cycles</h2>
        </div>
        {cycleRows.length === 0 ? (
          <div className="card-body" style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
            No reporting cycles yet.{" "}
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowAddCycle(true)}>
              Add the first cycle
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cycle Name</th>
                  <th>Period</th>
                  <th>EPP Status</th>
                  <th>Categories</th>
                  <th>Total EPP Spend</th>
                  <th>EPP %</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cycleRows.map(({ cycle, eppCycle }) => (
                  <tr key={cycle.id}>
                    <td style={{ fontWeight: 500 }}>{cycle.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {formatDate(cycle.start_date || "")} – {formatDate(cycle.end_date || "")}
                    </td>
                    <td>
                      <StatusBadge status={eppCycle?.epp_status || cycle.status} />
                    </td>
                    <td>
                      {eppCycle ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {(eppCycle.epp_categories as string[]).map(c => (
                            <span key={c} className="badge badge-green" style={{ fontSize: 10 }}>
                              {EPP_CATEGORY_LABELS[c] || c}
                            </span>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td>{eppCycle ? formatCurrency(eppCycle.total_epp_spend) : "—"}</td>
                    <td>{eppCycle ? formatPct(eppCycle.epp_percentage) : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link
                          href={`/compliance/epp/contracts/${contractId}/cycles/${cycle.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          View
                        </Link>
                        <Link
                          href={`/compliance/epp/contracts/${contractId}/cycles/${cycle.id}/edit`}
                          className="btn btn-ghost btn-sm"
                        >
                          Edit
                        </Link>
                        {eppCycle && canApprove(eppCycle.epp_status) && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => approveEpp(eppCycle.id, eppCycle.epp_status, true)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => approveEpp(eppCycle.id, eppCycle.epp_status, false)}
                            >
                              Return
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h2 className="card-title">Documents & Attachments ({attachments.length})</h2>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {attachments.map((doc) => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "#fafbfc" }}>
                  <div style={{ fontSize: 20, lineHeight: 1 }}>📎</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.description || doc.file_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {doc.file_name}{doc.file_size && <> · {(doc.file_size / 1024).toFixed(1)} KB</>}
                    </div>
                  </div>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}>
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
