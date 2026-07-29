"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface CycleWithContract {
  id: string;
  contract_id: string;
  name: string;
  fiscal_year?: string;
  start_date?: string;
  end_date?: string;
  goals?: string;
  contracts?: { contract_number: string; supplier_name: string };
}

export default function EditSubkCycle() {
  const { contractId, cycleId } = useParams<{ contractId: string; cycleId: string }>();
  const router = useRouter();
  const [cycle, setCycle] = useState<CycleWithContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", fiscal_year: "", start_date: "", end_date: "", goals: "",
  });

  useEffect(() => {
    loadCycle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function loadCycle() {
    setLoading(true);
    const { data } = await supabase
      .from("contract_cycles")
      .select("*, contracts(contract_number, supplier_name)")
      .eq("id", cycleId)
      .single();
    if (data) {
      setCycle(data);
      setForm({
        name: data.name || "",
        fiscal_year: data.fiscal_year || "",
        start_date: data.start_date || "",
        end_date: data.end_date || "",
        goals: data.goals || "",
      });
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Cycle name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("contract_cycles").update({
      name: form.name,
      fiscal_year: form.fiscal_year || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      goals: form.goals || null,
      updated_at: new Date().toISOString(),
    }).eq("id", cycleId);
    if (err) {
      setError("Failed to save changes. Please try again.");
    } else {
      router.push(`/compliance/subk/contracts/${contractId}`);
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  if (!cycle) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Cycle not found.</div>;

  const contractNum = cycle.contracts?.contract_number ?? contractId;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/compliance/subk/contracts" style={{ color: "var(--usps-blue)" }}>SubK Contracts</Link>
        {" / "}
        <Link href={`/compliance/subk/contracts/${contractId}`} style={{ color: "var(--usps-blue)" }}>
          {contractNum}
        </Link>
        {" / "}
        <Link href={`/compliance/subk/contracts/${contractId}/cycles/${cycleId}`} style={{ color: "var(--usps-blue)" }}>
          {cycle.name}
        </Link>
        {" / Edit"}
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Reporting Cycle</h1>
          <p className="page-subtitle">{cycle.name} — {contractNum}</p>
        </div>
        <Link href={`/compliance/subk/contracts/${contractId}`} className="btn btn-ghost">
          Cancel
        </Link>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "inherit", opacity: 0.7 }}>&times;</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Cycle Details</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Cycle Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. FY2025 Q1"
                required
              />
            </div>
            <div>
              <label className="form-label">Fiscal Year</label>
              <input
                className="form-input"
                value={form.fiscal_year}
                onChange={e => setForm({ ...form, fiscal_year: e.target.value })}
                placeholder="e.g. FY2025"
              />
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Goals</label>
              <textarea
                className="form-textarea"
                value={form.goals}
                onChange={e => setForm({ ...form, goals: e.target.value })}
                rows={4}
                placeholder="Reporting goals for this cycle…"
              />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <Link href={`/compliance/subk/contracts/${contractId}`} className="btn btn-ghost">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
