"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import type { User, Contract, ContractCycle, ContractCycleStatus } from "@/lib/types";

interface Attachment {
  id: string;
  slot_number: number;
  file_name: string;
  file_url: string;
  description?: string;
  file_size?: number;
  uploaded_at?: string;
}

// ─── Workflow maps ────────────────────────────────────────────────────────────

const APPROVE_FLOW: Partial<Record<ContractCycleStatus, ContractCycleStatus>> = {
  ready_for_co_review: "ready_for_portfolio_review",
  ready_for_portfolio_review: "ready_for_diversity_review",
  ready_for_diversity_review: "close_for_report",
};

const REJECT_FLOW: Partial<Record<ContractCycleStatus, ContractCycleStatus>> = {
  ready_for_co_review: "open_for_reporting",
  ready_for_portfolio_review: "ready_for_co_review",
  ready_for_diversity_review: "ready_for_portfolio_review",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  subk: "SubK",
  epp: "EPP",
  subk_epp: "SubK + EPP",
};

function canActOnCycle(cycle: ContractCycle, user: User | null): boolean {
  if (!user) return false;
  const role = (user.role as { name?: string })?.name;
  const s = cycle.status;
  if (role === "admin") return s in APPROVE_FLOW;
  if (s === "ready_for_co_review" && role === "co") return true;
  if (s === "ready_for_portfolio_review" && role === "portfolio_manager") return true;
  if (s === "ready_for_diversity_review" && role === "diversity_manager") return true;
  return false;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SubkContractDetail() {
  const { contractId } = useParams<{ contractId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [cycles, setCycles] = useState<ContractCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Cycle inline form
  const [showAddCycle, setShowAddCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: "", fiscal_year: "", start_date: "", end_date: "", goals: "" });
  const [savingCycle, setSavingCycle] = useState(false);

  // Approve / Return modal
  const [reviewTarget, setReviewTarget] = useState<{ cycle: ContractCycle; action: "approve" | "reject" } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  // Expanded comment rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    setUser(getUser());
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  async function loadData() {
    setLoading(true);
    const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).single();
    setContract(c);
    const { data: cy } = await supabase
      .from("contract_cycles")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: true });
    setCycles(cy || []);
    const { data: docs } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("contract_id", contractId)
      .order("slot_number", { ascending: true });
    setAttachments((docs as Attachment[]) || []);
    setLoading(false);
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
      status: "new_contract" as ContractCycleStatus,
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

  async function openForReporting(cycleId: string) {
    const { error } = await supabase.from("contract_cycles").update({
      status: "open_for_reporting" as ContractCycleStatus,
      supplier_status: "enter_spend_data",
      updated_at: new Date().toISOString(),
    }).eq("id", cycleId);
    if (!error) {
      setMsg({ type: "success", text: "Cycle opened for reporting." });
      await loadData();
    } else {
      setMsg({ type: "error", text: "Failed to open cycle for reporting." });
    }
  }

  async function submitReview() {
    if (!reviewTarget || !user) return;
    const { cycle, action } = reviewTarget;
    const approve = action === "approve";
    const nextStatus = approve ? APPROVE_FLOW[cycle.status] : REJECT_FLOW[cycle.status];
    if (!nextStatus) return;
    if (!approve && !reviewComment.trim()) return;

    setSavingReview(true);
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: nextStatus, updated_at: now };

    if (cycle.status === "ready_for_co_review") {
      updates.co_reviewed_by = user.id;
      updates.co_reviewed_at = now;
      updates.co_comments = reviewComment || null;
      if (approve) updates.supplier_status = "supplier_reported";
    } else if (cycle.status === "ready_for_portfolio_review") {
      updates.portfolio_reviewed_by = user.id;
      updates.portfolio_reviewed_at = now;
      updates.portfolio_comments = reviewComment || null;
    } else if (cycle.status === "ready_for_diversity_review") {
      updates.diversity_reviewed_by = user.id;
      updates.diversity_reviewed_at = now;
      updates.diversity_comments = reviewComment || null;
    }

    if (!approve) {
      updates.supplier_status = "enter_spend_data";
    }

    const { error } = await supabase.from("contract_cycles").update(updates).eq("id", cycle.id);
    if (error) {
      setMsg({ type: "error", text: "Failed to update cycle status." });
    } else {
      setMsg({ type: "success", text: approve ? "Cycle approved." : "Cycle returned for revision." });
      // Fire status-change notification email (best-effort — don't block UI)
      if (contract) {
        fetch("/api/email/contract-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId,
            contractNumber: contract.contract_number,
            supplierName: contract.supplier_name,
            supplierEmail: (contract as any).supplier_contact_email ?? (contract as any).supplier_email ?? "",
            contractOfficer: contract.contract_officer,
            contractOfficerEmail: contract.contract_officer_email ?? "",
            newStatus: nextStatus,
            oldStatus: cycle.status,
            rejectionReason: approve ? "" : reviewComment,
            contractModule: "subk",
          }),
        }).catch(() => {});
      }
      setReviewTarget(null);
      setReviewComment("");
      await loadData();
    }
    setSavingReview(false);
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  if (!contract) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Contract not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/compliance/subk/contracts" style={{ color: "var(--usps-blue)" }}>SubK Contracts</Link>
        {" / "}{contract.contract_number}
      </div>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="page-title">{contract.supplier_name}</h1>
            <span className="badge badge-blue" style={{ fontSize: 13 }}>
              {CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type}
            </span>
          </div>
          <p className="page-subtitle">
            Contract No: {contract.contract_number} &middot; CO: {contract.contract_officer}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/compliance/subk/contracts/${contractId}/edit`} className="btn btn-ghost btn-sm">
            Edit Contract
          </Link>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddCycle(true)}>
            + Add Cycle
          </button>
        </div>
      </div>

      {/* Alert */}
      {msg && (
        <div
          className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: 16 }}
        >
          <span>{msg.text}</span>
          <button
            onClick={() => setMsg(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "inherit", opacity: 0.7 }}
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Contract Details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2 className="card-title">Contract Details</h2>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 24px" }}>
            {[
              ["Contract No", contract.contract_number],
              ["Supplier", contract.supplier_name],
              ["APEX Number", contract.supplier_apex || "—"],
              ["Portfolios", contract.portfolios || "—"],
              ["Commodity", contract.commodity || "—"],
              ["Vendor Contact", contract.vendor_contact || "—"],
              ["Contract Amount", formatCurrency(contract.contract_amount)],
              ["Contract Officer", contract.contract_officer],
              ["CO Email", contract.contract_officer_email || "—"],
              ["Start Date", formatDate(contract.start_date || "")],
              ["Expiration Date", formatDate(contract.expiration_date || "")],
              ["Contract Type", CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </div>
                <div style={{ marginTop: 2, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
          {contract.comments && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Comments
              </div>
              <p style={{ margin: 0 }}>{contract.comments}</p>
            </div>
          )}
          {contract.exception && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Exception
              </div>
              <p style={{ margin: 0 }}>{contract.exception}</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Cycle inline panel */}
      {showAddCycle && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--usps-blue)" }}>
          <div className="card-header" style={{ background: "var(--usps-blue-light)" }}>
            <h2 className="card-title">New Reporting Cycle</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCycle(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={addCycle} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="form-label">Cycle Name *</label>
                <input
                  className="form-input"
                  value={cycleForm.name}
                  onChange={e => setCycleForm({ ...cycleForm, name: e.target.value })}
                  placeholder="e.g. FY2025 Q1"
                  required
                />
              </div>
              <div>
                <label className="form-label">Fiscal Year</label>
                <input
                  className="form-input"
                  value={cycleForm.fiscal_year}
                  onChange={e => setCycleForm({ ...cycleForm, fiscal_year: e.target.value })}
                  placeholder="e.g. FY2025"
                />
              </div>
              <div>
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={cycleForm.start_date}
                  onChange={e => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={cycleForm.end_date}
                  onChange={e => setCycleForm({ ...cycleForm, end_date: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Goals</label>
                <textarea
                  className="form-textarea"
                  value={cycleForm.goals}
                  onChange={e => setCycleForm({ ...cycleForm, goals: e.target.value })}
                  rows={3}
                  placeholder="Reporting goals for this cycle…"
                />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={savingCycle}>
                  {savingCycle ? "Creating…" : "Create Cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reporting Cycles Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Reporting Cycles ({cycles.length})</h2>
        </div>

        {cycles.length === 0 ? (
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
                  <th>Status</th>
                  <th>CO Review</th>
                  <th>Portfolio Review</th>
                  <th>Diversity Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map(cy => {
                  const hasComments = !!(cy.co_comments || cy.portfolio_comments || cy.diversity_comments);
                  const isExpanded = expanded.has(cy.id);
                  const canAct = canActOnCycle(cy, user);

                  return (
                    <React.Fragment key={cy.id}>
                      <tr>
                        {/* Cycle Name */}
                        <td>
                          <div style={{ fontWeight: 600 }}>{cy.name}</div>
                          {cy.fiscal_year && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>FY {cy.fiscal_year}</div>
                          )}
                        </td>

                        {/* Period */}
                        <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {cy.start_date || cy.end_date
                            ? <>{cy.start_date ? formatDate(cy.start_date) : "—"}{" – "}{cy.end_date ? formatDate(cy.end_date) : "—"}</>
                            : "—"
                          }
                        </td>

                        {/* Status */}
                        <td><StatusBadge status={cy.status} /></td>

                        {/* CO Review */}
                        <td>
                          {cy.co_reviewed_at ? (
                            <div>
                              <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {cy.co_reviewed_by && <>{cy.co_reviewed_by}<br /></>}
                                {formatDate(cy.co_reviewed_at)}
                              </div>
                            </div>
                          ) : "—"}
                        </td>

                        {/* Portfolio Review */}
                        <td>
                          {cy.portfolio_reviewed_at ? (
                            <div>
                              <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {cy.portfolio_reviewed_by && <>{cy.portfolio_reviewed_by}<br /></>}
                                {formatDate(cy.portfolio_reviewed_at)}
                              </div>
                            </div>
                          ) : "—"}
                        </td>

                        {/* Diversity Review */}
                        <td>
                          {cy.diversity_reviewed_at ? (
                            <div>
                              <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {cy.diversity_reviewed_by && <>{cy.diversity_reviewed_by}<br /></>}
                                {formatDate(cy.diversity_reviewed_at)}
                              </div>
                            </div>
                          ) : "—"}
                        </td>

                        {/* Actions */}
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Link
                              href={`/compliance/subk/contracts/${contractId}/cycles/${cy.id}`}
                              className="btn btn-outline btn-sm"
                            >
                              View
                            </Link>
                            <Link
                              href={`/compliance/subk/contracts/${contractId}/cycles/${cy.id}/edit`}
                              className="btn btn-ghost btn-sm"
                            >
                              Edit
                            </Link>
                            {cy.status === "new_contract" && (
                              <button className="btn btn-primary btn-sm" onClick={() => openForReporting(cy.id)}>
                                Open
                              </button>
                            )}
                            {canAct && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => { setReviewTarget({ cycle: cy, action: "approve" }); setReviewComment(""); }}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => { setReviewTarget({ cycle: cy, action: "reject" }); setReviewComment(""); }}
                                >
                                  Return
                                </button>
                              </>
                            )}
                            {hasComments && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 11 }}
                                onClick={() => toggleExpanded(cy.id)}
                              >
                                {isExpanded ? "Hide Notes" : "Notes"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline comments row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                              gap: 12,
                              padding: "12px 16px 14px",
                              background: "#f8fafc",
                              borderTop: "1px solid #eef1f6",
                            }}>
                              {cy.co_comments && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                                    CO Comment
                                  </div>
                                  <div style={{ fontSize: 13 }}>{cy.co_comments}</div>
                                  {cy.co_reviewed_by && (
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                      — {cy.co_reviewed_by}
                                    </div>
                                  )}
                                </div>
                              )}
                              {cy.portfolio_comments && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                                    Portfolio Comment
                                  </div>
                                  <div style={{ fontSize: 13 }}>{cy.portfolio_comments}</div>
                                  {cy.portfolio_reviewed_by && (
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                      — {cy.portfolio_reviewed_by}
                                    </div>
                                  )}
                                </div>
                              )}
                              {cy.diversity_comments && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                                    Diversity Comment
                                  </div>
                                  <div style={{ fontSize: 13 }}>{cy.diversity_comments}</div>
                                  {cy.diversity_reviewed_by && (
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                      — {cy.diversity_reviewed_by}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {doc.description || doc.file_name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {doc.file_name}
                      {doc.file_size && <> · {(doc.file_size / 1024).toFixed(1)} KB</>}
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

      {/* Approve / Return modal */}
      {reviewTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
        }}>
          <div className="card" style={{ width: 480 }}>
            <div className="card-header">
              <h3 className="card-title">
                {reviewTarget.action === "approve" ? "Approve" : "Return for Revision"} — {reviewTarget.cycle.name}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setReviewTarget(null)}>&#10005;</button>
            </div>
            <div className="card-body">
              {(() => {
                const approve = reviewTarget.action === "approve";
                const nextStatus = approve
                  ? APPROVE_FLOW[reviewTarget.cycle.status]
                  : REJECT_FLOW[reviewTarget.cycle.status];
                return (
                  <>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
                      {approve
                        ? "Approve this cycle and advance it to the next review stage."
                        : "Return this cycle. The supplier will need to revise their submission."}
                    </p>
                    {nextStatus && (
                      <div className="alert alert-info" style={{ marginBottom: 14 }}>
                        Status will move to: <strong>{nextStatus.replace(/_/g, " ")}</strong>
                      </div>
                    )}
                    <label className="form-label">
                      Comment {!approve && <span style={{ color: "var(--usps-red)" }}>*</span>}
                    </label>
                    <textarea
                      className="form-textarea"
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      rows={3}
                      placeholder={approve ? "Optional comment…" : "Reason for returning…"}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost" onClick={() => setReviewTarget(null)} disabled={savingReview}>
                        Cancel
                      </button>
                      <button
                        className={`btn ${approve ? "btn-success" : "btn-danger"}`}
                        onClick={submitReview}
                        disabled={savingReview || (!approve && !reviewComment.trim())}
                      >
                        {savingReview ? "Processing…" : approve ? "Confirm Approval" : "Confirm Return"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
