"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Contract, ContractCycle } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new_contract", label: "New Contract" },
  { key: "open_for_reporting", label: "Open for Reporting" },
  { key: "ready_for_co_review", label: "Ready for CO Review" },
  { key: "ready_for_portfolio_review", label: "Ready for Portfolio Review" },
  { key: "ready_for_diversity_review", label: "Ready for Diversity Review" },
  { key: "close_for_report", label: "Close for Report" },
  { key: "closed", label: "Closed" },
];

interface ContractWithCycles extends Contract {
  contract_cycles: ContractCycle[];
}

function getLatestCycleStatus(contract: ContractWithCycles): string {
  const cycles = contract.contract_cycles ?? [];
  if (cycles.length === 0) return "new_contract";
  const sorted = [...cycles].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted[0].status;
}

const BLANK_ADD_FORM = {
  contract_number: "", supplier_name: "", supplier_apex: "", portfolios: "",
  commodity: "", vendor_contact: "", contract_amount: "", contract_officer: "",
  contract_officer_email: "", start_date: "", expiration_date: "", comments: "", exception: "",
};

export default function SubKContractListPage() {
  const [contracts, setContracts] = useState<ContractWithCycles[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...BLANK_ADD_FORM });
  const [savingContract, setSavingContract] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // getUser is available for potential role-based UI decisions
  void getUser;

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    setLoading(true);
    const { data } = await supabase
      .from("contracts")
      .select("*, contract_cycles(*)")
      .in("contract_type", ["subk", "subk_epp"])
      .order("created_at", { ascending: false });
    setContracts((data as ContractWithCycles[]) ?? []);
    setLoading(false);
  }

  async function addContract(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.contract_number || !addForm.supplier_name || !addForm.contract_officer) {
      setMsg({ type: "error", text: "Contract number, supplier name, and contract officer are required." });
      return;
    }
    setSavingContract(true);
    const { error } = await supabase.from("contracts").insert({
      contract_number: addForm.contract_number,
      supplier_name: addForm.supplier_name,
      supplier_apex: addForm.supplier_apex || null,
      portfolios: addForm.portfolios || null,
      commodity: addForm.commodity || null,
      vendor_contact: addForm.vendor_contact || null,
      contract_amount: addForm.contract_amount ? parseFloat(addForm.contract_amount) : null,
      contract_officer: addForm.contract_officer,
      contract_officer_email: addForm.contract_officer_email || null,
      start_date: addForm.start_date || null,
      expiration_date: addForm.expiration_date || null,
      comments: addForm.comments || null,
      exception: addForm.exception || null,
      contract_type: "subk",
    });
    if (error) {
      setMsg({ type: "error", text: "Failed to create contract." });
    } else {
      setMsg({ type: "success", text: "Contract created successfully." });
      setShowAddForm(false);
      setAddForm({ ...BLANK_ADD_FORM });
      await loadContracts();
    }
    setSavingContract(false);
  }

  const filtered = contracts.filter((c) => {
    const status = getLatestCycleStatus(c);
    const matchesTab = activeTab === "all" || status === activeTab;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.contract_number.toLowerCase().includes(q) ||
      c.supplier_name.toLowerCase().includes(q) ||
      c.contract_officer.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleTabChange(key: string) {
    setActiveTab(key);
    setPage(1);
  }

  function handleSearch(q: string) {
    setSearch(q);
    setPage(1);
  }

  function tabCount(key: string): number {
    if (key === "all") return contracts.length;
    return contracts.filter((c) => getLatestCycleStatus(c) === key).length;
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">SubK Contract List</h1>
          <p className="page-subtitle">
            Subcontracting compliance contracts
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by contract no, vendor, or CO…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Add Contract
          </button>
          <Link href="/compliance/subk/contracts/import" className="btn btn-outline">
            Import CSV
          </Link>
        </div>
      </div>

      {/* Alert */}
      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "inherit", opacity: 0.7 }} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Inline Add Contract form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--usps-blue)" }}>
          <div className="card-header" style={{ background: "var(--usps-blue-light)" }}>
            <h2 className="card-title">New SubK Contract</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={addContract} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="form-label">Contract No *</label>
                <input className="form-input" value={addForm.contract_number} onChange={e => setAddForm({ ...addForm, contract_number: e.target.value })} placeholder="e.g. USPS-2025-001" required />
              </div>
              <div>
                <label className="form-label">Supplier Name *</label>
                <input className="form-input" value={addForm.supplier_name} onChange={e => setAddForm({ ...addForm, supplier_name: e.target.value })} placeholder="Legal company name" required />
              </div>
              <div>
                <label className="form-label">Supplier APEX</label>
                <input className="form-input" value={addForm.supplier_apex} onChange={e => setAddForm({ ...addForm, supplier_apex: e.target.value })} placeholder="APEX number" />
              </div>
              <div>
                <label className="form-label">Contract Officer *</label>
                <input className="form-input" value={addForm.contract_officer} onChange={e => setAddForm({ ...addForm, contract_officer: e.target.value })} placeholder="Full name" required />
              </div>
              <div>
                <label className="form-label">CO Email</label>
                <input type="email" className="form-input" value={addForm.contract_officer_email} onChange={e => setAddForm({ ...addForm, contract_officer_email: e.target.value })} placeholder="co@usps.gov" />
              </div>
              <div>
                <label className="form-label">Contract Amount ($)</label>
                <input type="number" className="form-input" value={addForm.contract_amount} onChange={e => setAddForm({ ...addForm, contract_amount: e.target.value })} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={addForm.start_date} onChange={e => setAddForm({ ...addForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Expiration Date</label>
                <input type="date" className="form-input" value={addForm.expiration_date} onChange={e => setAddForm({ ...addForm, expiration_date: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Portfolios</label>
                <input className="form-input" value={addForm.portfolios} onChange={e => setAddForm({ ...addForm, portfolios: e.target.value })} placeholder="e.g. Operations, IT" />
              </div>
              <div>
                <label className="form-label">Commodity</label>
                <input className="form-input" value={addForm.commodity} onChange={e => setAddForm({ ...addForm, commodity: e.target.value })} placeholder="Service or commodity type" />
              </div>
              <div>
                <label className="form-label">Vendor Contact</label>
                <input className="form-input" value={addForm.vendor_contact} onChange={e => setAddForm({ ...addForm, vendor_contact: e.target.value })} placeholder="Primary vendor contact" />
              </div>
              <div>
                <label className="form-label">Exception</label>
                <input className="form-input" value={addForm.exception} onChange={e => setAddForm({ ...addForm, exception: e.target.value })} placeholder="Exception type, if applicable" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Comments</label>
                <textarea className="form-textarea" value={addForm.comments} onChange={e => setAddForm({ ...addForm, comments: e.target.value })} rows={2} placeholder="General comments…" />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingContract}>{savingContract ? "Creating…" : "Create Contract"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tabCount(tab.key);
          return (
            <button
              key={tab.key}
              className={`tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: activeTab === tab.key ? "var(--usps-blue)" : "var(--border)",
                    color: activeTab === tab.key ? "white" : "var(--text-muted)",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    lineHeight: "16px",
                    display: "inline-block",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contracts table */}
      <div className="card">
        {loading ? (
          <div
            className="card-body"
            style={{ textAlign: "center", color: "var(--text-muted)", padding: "56px 20px" }}
          >
            Loading contracts…
          </div>
        ) : paginated.length === 0 ? (
          <div
            className="card-body"
            style={{ textAlign: "center", color: "var(--text-muted)", padding: "56px 20px" }}
          >
            No contracts found
            {search ? ` matching "${search}"` : ""}.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract No</th>
                  <th>Vendor Name</th>
                  <th>Contract Officer</th>
                  <th>Contract Amount</th>
                  <th>Start Date</th>
                  <th>Expiration Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((contract) => {
                  const status = getLatestCycleStatus(contract);
                  return (
                    <tr key={contract.id}>
                      <td>
                        <Link
                          href={`/compliance/subk/contracts/${contract.id}`}
                          style={{ color: "var(--usps-blue)", fontWeight: 600, textDecoration: "none" }}
                        >
                          {contract.contract_number}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 500 }}>{contract.supplier_name}</td>
                      <td>{contract.contract_officer}</td>
                      <td>{formatCurrency(contract.contract_amount)}</td>
                      <td>{formatDate(contract.start_date ?? "")}</td>
                      <td>{formatDate(contract.expiration_date ?? "")}</td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Link
                            href={`/compliance/subk/contracts/${contract.id}`}
                            className="btn btn-outline btn-sm"
                          >
                            View
                          </Link>
                          <Link
                            href={`/compliance/subk/contracts/${contract.id}/edit`}
                            className="btn btn-ghost btn-sm"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
              contract{filtered.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>

              {/* Page number buttons — truncate if many pages */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - safePage) <= 2
                )
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push("…");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{ padding: "0 4px", color: "var(--text-muted)" }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={`btn btn-sm ${item === safePage ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setPage(item as number)}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                className="btn btn-ghost btn-sm"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Single-page count when no pagination needed */}
        {!loading && filtered.length > 0 && totalPages === 1 && (
          <div
            style={{
              padding: "10px 20px",
              borderTop: "1px solid var(--border)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            {filtered.length} contract{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
