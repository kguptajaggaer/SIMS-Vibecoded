"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import type { User, ContractCycle, Contract, Subcontractor } from "@/lib/types";

interface CycleWithContract extends ContractCycle {
  contracts: Contract;
}

export default function CycleDetail() {
  const { contractId, cycleId } = useParams<{ contractId: string; cycleId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [cycle, setCycle] = useState<CycleWithContract | null>(null);
  const [vendors, setVendors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    loadData();
  }, [cycleId]);

  async function loadData() {
    setLoading(true);
    const { data: cycleData } = await supabase
      .from("contract_cycles")
      .select("*, contracts(*)")
      .eq("id", cycleId)
      .single();
    setCycle(cycleData);

    const { data: vendorData } = await supabase
      .from("subcontractors")
      .select("*")
      .eq("contract_cycle_id", cycleId)
      .order("vendor_name");
    setVendors(vendorData || []);
    setLoading(false);
  }

  function getNextStatus(current: string, approve: boolean): string | null {
    if (!approve) return "open_for_reporting";
    const flow: Record<string, string> = {
      ready_for_co_review: "ready_for_portfolio_review",
      ready_for_portfolio_review: "ready_for_diversity_review",
      ready_for_diversity_review: "close_for_report",
    };
    return flow[current] || null;
  }

  function canAct(): boolean {
    if (!user || !cycle) return false;
    const roleName = (user.role as { name?: string })?.name;
    const s = cycle.status;
    if (s === "ready_for_co_review" && (roleName === "co" || roleName === "admin")) return true;
    if (s === "ready_for_portfolio_review" && (roleName === "portfolio_manager" || roleName === "admin")) return true;
    if (s === "ready_for_diversity_review" && (roleName === "diversity_manager" || roleName === "admin")) return true;
    return false;
  }

  async function submitAction() {
    if (!cycle || !user) return;
    setSaving(true);
    const approve = action === "approve";
    const nextStatus = getNextStatus(cycle.status, approve);
    if (!nextStatus) { setSaving(false); return; }

    const roleName = (user.role as { name?: string })?.name;
    const updates: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };

    if (cycle.status === "ready_for_co_review") {
      updates.co_reviewed_by = user.id;
      updates.co_reviewed_at = new Date().toISOString();
      updates.co_comments = comments;
      if (approve) updates.supplier_status = "supplier_reported";
    } else if (cycle.status === "ready_for_portfolio_review") {
      updates.portfolio_reviewed_by = user.id;
      updates.portfolio_reviewed_at = new Date().toISOString();
      updates.portfolio_comments = comments;
    } else if (cycle.status === "ready_for_diversity_review") {
      updates.diversity_reviewed_by = user.id;
      updates.diversity_reviewed_at = new Date().toISOString();
      updates.diversity_comments = comments;
    }

    if (!approve) {
      updates.supplier_status = "enter_spend_data";
    }

    const { error } = await supabase.from("contract_cycles").update(updates).eq("id", cycleId);
    if (error) {
      setMsg({ type: "error", text: "Failed to update status." });
    } else {
      setMsg({ type: "success", text: approve ? "Approved successfully." : "Returned to supplier for revision." });
      setAction(null);
      setComments("");
      await loadData();
    }
    setSaving(false);
    void roleName;
  }

  const totalDirect = vendors.reduce((s, v) => s + (v.direct_expense || 0), 0);
  const totalIndirect = vendors.reduce((s, v) => s + (v.indirect_expense || 0), 0);
  const totalSpend = totalDirect + totalIndirect;

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!cycle) return <div className="p-8 text-center text-gray-400">Cycle not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/compliance/subk/contracts" style={{ color: "var(--usps-blue)" }}>Contracts</Link>
        {" / "}
        <Link href={`/compliance/subk/contracts/${contractId}`} style={{ color: "var(--usps-blue)" }}>
          {cycle.contracts.contract_number}
        </Link>
        {" / "}{cycle.name}
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{cycle.name} — {cycle.contracts.supplier_name}</h1>
          <p className="page-subtitle">
            Contract: {cycle.contracts.contract_number} · CO: {cycle.contracts.contract_officer}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={cycle.status} />
          {canAct() && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => setAction("approve")}>✓ Approve</button>
              <button className="btn btn-danger btn-sm" onClick={() => setAction("reject")}>✗ Return</button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* Action Modal */}
      {action && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div className="card" style={{ width: 480, padding: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontWeight: 700 }}>
              {action === "approve" ? "Confirm Approval" : "Return for Revision"}
            </h3>
            <p style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 13 }}>
              {action === "approve"
                ? "Approve this contract cycle and advance to the next review stage."
                : "Return this contract to the supplier. They will need to re-enter spend data."}
            </p>
            <label className="form-label">Comments (optional)</label>
            <textarea
              className="form-textarea"
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Add any comments for the record…"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => { setAction(null); setComments(""); }}>Cancel</button>
              <button
                className={`btn ${action === "approve" ? "btn-success" : "btn-danger"}`}
                onClick={submitAction}
                disabled={saving}
              >
                {saving ? "Processing…" : action === "approve" ? "Confirm Approval" : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2 className="card-title">Contract Information</h2></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 24px" }}>
            {[
              ["Contract No", cycle.contracts.contract_number],
              ["Supplier", cycle.contracts.supplier_name],
              ["APEX", cycle.contracts.supplier_apex || "—"],
              ["Contract Officer", cycle.contracts.contract_officer],
              ["CO Email", cycle.contracts.contract_officer_email || "—"],
              ["Contract Amount", formatCurrency(cycle.contracts.contract_amount)],
              ["Start Date", formatDate(cycle.contracts.start_date || "")],
              ["Expiration Date", formatDate(cycle.contracts.expiration_date || "")],
              ["Portfolios", cycle.contracts.portfolios || "—"],
              ["Commodity", cycle.contracts.commodity || "—"],
              ["Cycle Name", cycle.name],
              ["Period", `${formatDate(cycle.start_date || "")} – ${formatDate(cycle.end_date || "")}`],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ marginTop: 2, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
          {cycle.goals && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Goals</div>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>{cycle.goals}</p>
            </div>
          )}
        </div>
      </div>

      {/* Review History */}
      {(cycle.co_reviewed_at || cycle.portfolio_reviewed_at || cycle.diversity_reviewed_at) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="card-title">Review History</h2></div>
          <div className="card-body">
            {cycle.co_reviewed_at && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>CO Review</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(cycle.co_reviewed_at)}</span>
                </div>
                {cycle.co_comments && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{cycle.co_comments}</p>}
              </div>
            )}
            {cycle.portfolio_reviewed_at && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>Portfolio Review</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(cycle.portfolio_reviewed_at)}</span>
                </div>
                {cycle.portfolio_comments && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{cycle.portfolio_comments}</p>}
              </div>
            )}
            {cycle.diversity_reviewed_at && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>Diversity Review</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(cycle.diversity_reviewed_at)}</span>
                </div>
                {cycle.diversity_comments && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{cycle.diversity_comments}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spend Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          ["Total Vendors", vendors.length.toString()],
          ["Direct Spend", formatCurrency(totalDirect)],
          ["Indirect Spend", formatCurrency(totalIndirect)],
          ["Total Spend", formatCurrency(totalSpend)],
          ["Supplier Status", cycle.supplier_status.replace(/_/g, " ")],
        ].map(([label, val]) => (
          <div key={label} className="stat-widget">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Vendors Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Subcontractors / Vendor Data ({vendors.length})</h2>
        </div>
        {vendors.length === 0 ? (
          <div className="card-body" style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
            No vendor data submitted yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>APEX</th>
                  <th>Classifications</th>
                  <th>SubK Units</th>
                  <th>Direct Spend</th>
                  <th>Indirect Spend</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 500 }}>{v.vendor_name}</td>
                    <td>{v.vendor_apex || "—"}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(v.classifications as string[]).map(c => (
                          <span key={c} className="badge badge-blue" style={{ fontSize: 11 }}>
                            {c.replace(/_/g, " ")}
                          </span>
                        ))}
                        {(!v.classifications || (v.classifications as string[]).length === 0) && "—"}
                      </div>
                    </td>
                    <td>{v.subk_units || "—"}</td>
                    <td>{formatCurrency(v.direct_expense)}</td>
                    <td>{formatCurrency(v.indirect_expense)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(v.total_expense)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc" }}>
                  <td colSpan={4} style={{ fontWeight: 700, padding: "10px 14px" }}>Totals</td>
                  <td style={{ fontWeight: 700, padding: "10px 14px" }}>{formatCurrency(totalDirect)}</td>
                  <td style={{ fontWeight: 700, padding: "10px 14px" }}>{formatCurrency(totalIndirect)}</td>
                  <td style={{ fontWeight: 700, padding: "10px 14px" }}>{formatCurrency(totalSpend)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
