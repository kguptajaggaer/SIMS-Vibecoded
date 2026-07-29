"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Contract } from "@/lib/types";

export default function EditSubkContract() {
  const { contractId } = useParams<{ contractId: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    contract_number: "", supplier_name: "", supplier_apex: "",
    portfolios: "", commodity: "", vendor_contact: "",
    contract_amount: "", contract_officer: "", contract_officer_email: "",
    start_date: "", expiration_date: "", comments: "", exception: "",
  });

  useEffect(() => {
    loadContract();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  async function loadContract() {
    setLoading(true);
    const { data } = await supabase.from("contracts").select("*").eq("id", contractId).single();
    if (data) {
      setContract(data);
      setForm({
        contract_number: data.contract_number || "",
        supplier_name: data.supplier_name || "",
        supplier_apex: data.supplier_apex || "",
        portfolios: data.portfolios || "",
        commodity: data.commodity || "",
        vendor_contact: data.vendor_contact || "",
        contract_amount: data.contract_amount?.toString() || "",
        contract_officer: data.contract_officer || "",
        contract_officer_email: data.contract_officer_email || "",
        start_date: data.start_date || "",
        expiration_date: data.expiration_date || "",
        comments: data.comments || "",
        exception: data.exception || "",
      });
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contract_number || !form.supplier_name || !form.contract_officer) {
      setError("Contract number, supplier name, and contract officer are required.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("contracts").update({
      contract_number: form.contract_number,
      supplier_name: form.supplier_name,
      supplier_apex: form.supplier_apex || null,
      portfolios: form.portfolios || null,
      commodity: form.commodity || null,
      vendor_contact: form.vendor_contact || null,
      contract_amount: form.contract_amount ? parseFloat(form.contract_amount) : null,
      contract_officer: form.contract_officer,
      contract_officer_email: form.contract_officer_email || null,
      start_date: form.start_date || null,
      expiration_date: form.expiration_date || null,
      comments: form.comments || null,
      exception: form.exception || null,
      updated_at: new Date().toISOString(),
    }).eq("id", contractId);
    if (err) {
      setError("Failed to save changes. Please try again.");
    } else {
      router.push(`/compliance/subk/contracts/${contractId}`);
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  if (!contract) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Contract not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/compliance/subk/contracts" style={{ color: "var(--usps-blue)" }}>SubK Contracts</Link>
        {" / "}
        <Link href={`/compliance/subk/contracts/${contractId}`} style={{ color: "var(--usps-blue)" }}>
          {contract.contract_number}
        </Link>
        {" / Edit"}
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Contract</h1>
          <p className="page-subtitle">{contract.contract_number} — {contract.supplier_name}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/compliance/subk/contracts/${contractId}`} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "inherit", opacity: 0.7 }}>&times;</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Contract Details</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Contract No *</label>
              <input className="form-input" value={form.contract_number} onChange={e => setForm({ ...form, contract_number: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Supplier Name *</label>
              <input className="form-input" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Supplier APEX</label>
              <input className="form-input" value={form.supplier_apex} onChange={e => setForm({ ...form, supplier_apex: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Contract Officer *</label>
              <input className="form-input" value={form.contract_officer} onChange={e => setForm({ ...form, contract_officer: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">CO Email</label>
              <input type="email" className="form-input" value={form.contract_officer_email} onChange={e => setForm({ ...form, contract_officer_email: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Contract Amount ($)</label>
              <input type="number" className="form-input" value={form.contract_amount} onChange={e => setForm({ ...form, contract_amount: e.target.value })} min="0" step="0.01" />
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Expiration Date</label>
              <input type="date" className="form-input" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Portfolios</label>
              <input className="form-input" value={form.portfolios} onChange={e => setForm({ ...form, portfolios: e.target.value })} placeholder="e.g. Operations, IT" />
            </div>
            <div>
              <label className="form-label">Commodity</label>
              <input className="form-input" value={form.commodity} onChange={e => setForm({ ...form, commodity: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Vendor Contact</label>
              <input className="form-input" value={form.vendor_contact} onChange={e => setForm({ ...form, vendor_contact: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Exception</label>
              <input className="form-input" value={form.exception} onChange={e => setForm({ ...form, exception: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Comments</label>
              <textarea className="form-textarea" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={3} />
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
