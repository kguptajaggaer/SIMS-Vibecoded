"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, formatDateShort } from "@/lib/supabase";
import type { Supplier, DevelopmentPlan, ReviewFrequency, SegmentationQuadrant } from "@/lib/types";

interface PlanWithScorecards extends DevelopmentPlan {
  scorecards?: { id: string; status: string }[];
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#f1f5f9", color: "#64748b", label: "Draft" },
  active:    { bg: "#e8f0f8", color: "#004B87", label: "Active" },
  completed: { bg: "#dcfce7", color: "#16a34a", label: "Completed" },
  archived:  { bg: "#f3f4f6", color: "#9ca3af", label: "Archived" },
};

const QUADRANT_CONFIG: Record<SegmentationQuadrant, { bg: string; color: string; label: string }> = {
  strategic: { bg: "#e8f0f8", color: "#004B87",  label: "Strategic" },
  critical:  { bg: "#fee2e2", color: "#dc2626",  label: "Critical" },
  support:   { bg: "#f1f5f9", color: "#475569",  label: "Support" },
  leading:   { bg: "#dcfce7", color: "#16a34a",  label: "Leading" },
};

const FREQ_LABELS: Record<ReviewFrequency, string> = {
  quarterly:     "Quarterly",
  semi_annually: "Semi-Annually",
  annually:      "Annually",
};

export default function SupplierDevelopmentPlansPage() {
  const { supplierId } = useParams<{ supplierId: string }>();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [plans, setPlans] = useState<PlanWithScorecards[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", review_frequency: "quarterly" as ReviewFrequency });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  async function loadData() {
    setLoading(true);
    const [{ data: supplierData }, { data: plansData }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", supplierId).single(),
      supabase
        .from("development_plans")
        .select("*, scorecards(id, status)")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
    ]);
    setSupplier(supplierData);
    setPlans((plansData as PlanWithScorecards[]) ?? []);
    setLoading(false);
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) {
      setMsg({ type: "error", text: "Plan name is required." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("development_plans").insert({
      supplier_id: supplierId,
      name: addForm.name.trim(),
      review_frequency: addForm.review_frequency,
      status: "draft",
    });
    if (error) {
      setMsg({ type: "error", text: "Failed to create development plan." });
    } else {
      setMsg({ type: "success", text: "Development plan created." });
      setShowAddForm(false);
      setAddForm({ name: "", review_frequency: "quarterly" });
      await loadData();
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  if (!supplier) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Supplier not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/supplier-performance/suppliers" style={{ color: "var(--usps-blue)" }}>Supplier Performance</Link>
        {" / "}
        <span>{supplier.name}</span>
        {" / Development Plans"}
      </div>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{supplier.name}</h1>
          <p className="page-subtitle">
            Development Plans
            {supplier.apex_number && ` · APEX: ${supplier.apex_number}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          + New Development Plan
        </button>
      </div>

      {/* Alert */}
      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "inherit", opacity: 0.7 }} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Add Plan inline form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--usps-blue)" }}>
          <div className="card-header" style={{ background: "var(--usps-blue-light)" }}>
            <h2 className="card-title">New Development Plan</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleAddPlan} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Plan Name *</label>
                <input
                  className="form-input"
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. FY2025 Performance Plan"
                  required
                />
              </div>
              <div>
                <label className="form-label">Review Frequency</label>
                <select
                  className="form-input"
                  value={addForm.review_frequency}
                  onChange={e => setAddForm({ ...addForm, review_frequency: e.target.value as ReviewFrequency })}
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annually">Semi-Annually</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Plan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: "center", color: "var(--text-muted)", padding: "56px 20px" }}>
            No development plans yet.{" "}
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowAddForm(true)}>
              Create the first plan
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {plans.map(plan => {
            const statusCfg = STATUS_CONFIG[plan.status] ?? STATUS_CONFIG.draft;
            const quadrantCfg = plan.segmentation_quadrant ? QUADRANT_CONFIG[plan.segmentation_quadrant] : null;
            const scorecardCount = plan.scorecards?.length ?? 0;
            const activeCount = plan.scorecards?.filter(s => s.status === "active").length ?? 0;

            return (
              <Link
                key={plan.id}
                href={`/supplier-performance/suppliers/${supplierId}/development-plans/${plan.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ cursor: "pointer", transition: "box-shadow 0.15s", height: "100%" }}>
                  <div className="card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                        {plan.name}
                      </h3>
                      <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: statusCfg.bg, color: statusCfg.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {statusCfg.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {quadrantCfg && (
                        <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: quadrantCfg.bg, color: quadrantCfg.color }}>
                          {quadrantCfg.label}
                        </span>
                      )}
                      <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 11, background: "#f1f5f9", color: "#64748b" }}>
                        {FREQ_LABELS[plan.review_frequency]}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
                      <div>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>Scorecards</span>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{scorecardCount} total {activeCount > 0 ? `· ${activeCount} active` : ""}</div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>Created</span>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{formatDateShort(plan.created_at)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
