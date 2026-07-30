"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Contract, ContractCycle, EppContractCycle } from "@/lib/types";

const PAGE_SIZE = 20;

type FilterType = "all" | "subk" | "epp" | "subk_epp";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new_contract", label: "New Contract" },
  { key: "enter_epp_data", label: "Enter EPP Data" },
  { key: "open_for_reporting", label: "Open for Reporting" },
  { key: "ready_for_co_review", label: "Ready for CO Review" },
  { key: "ready_for_epp_admin_review", label: "Ready for EPP Admin Review" },
  { key: "close_for_report", label: "Close for Report" },
  { key: "closed", label: "Closed" },
  { key: "finalized", label: "Finalized" },
];

const TYPE_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "subk", label: "SubK" },
  { key: "epp", label: "EPP" },
  { key: "subk_epp", label: "SubK & EPP" },
];

const CATEGORY_LABELS: Record<string, string> = {
  recycled_content: "Recycled",
  ecolabel: "Ecolabel",
  biobased: "Bio-Based",
  energy_efficient: "Energy",
  water_efficient: "Water",
};

const PORTFOLIO_OPTIONS = [
  "Operations", "Technology", "Logistics", "Finance", "HR", "Legal",
  "Real Estate", "Capital Projects", "Network Operations", "Mail Processing",
];

const CMC_OPTIONS = [
  "Eastern Area", "Western Area", "Southern Area", "Great Lakes", "Northeast",
  "Pacific", "Capital Metro",
];

interface CycleWithEpp extends ContractCycle {
  epp_contract_cycles: EppContractCycle[];
}

interface ContractWithCycles extends Contract {
  contract_cycles: CycleWithEpp[];
}

interface SupplierOption {
  id: string;
  name: string;
  apex_number?: string;
  email?: string;
}

interface COOption {
  id: string;
  name: string;
  email: string;
}

type AttachmentSlot = { description: string; file: File | null; fileName: string };
function emptySlot(): AttachmentSlot { return { description: "", file: null, fileName: "" }; }

function getLatestEppStatus(contract: ContractWithCycles): string {
  const cycles = contract.contract_cycles ?? [];
  if (cycles.length === 0) return "new_contract";
  const sorted = [...cycles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const eppCycles = sorted[0].epp_contract_cycles ?? [];
  if (eppCycles.length === 0) return "new_contract";
  return eppCycles[0].epp_status;
}

function getLatestEppCategories(contract: ContractWithCycles): string[] {
  const cycles = contract.contract_cycles ?? [];
  if (cycles.length === 0) return [];
  const sorted = [...cycles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const eppCycles = sorted[0].epp_contract_cycles ?? [];
  if (eppCycles.length === 0) return [];
  return (eppCycles[0].epp_categories as string[]) ?? [];
}

const BLANK_ADD_FORM = {
  contract_number: "",
  supplier_id: "",
  supplier_name: "",
  supplier_apex: "",
  supplier_contact: "",
  supplier_contact_email: "",
  portfolios: [] as string[],
  cmc: "",
  contract_officer_id: "",
  contract_officer: "",
  contract_officer_email: "",
  contract_amount: "",
  start_date: "",
  expiration_date: "",
  comments: "",
  exception: "",
  commodity: "",
  vendor_contact: "",
  contract_type: "epp" as "epp" | "subk_epp",
  epp_categories: [] as string[],
};

// ─── Supplier Search ──────────────────────────────────────────────────────────

function SupplierSearch({ value, onSelect }: { value: string; onSelect: (s: SupplierOption) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SupplierOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    supabase
      .from("suppliers")
      .select("id, name, apex_number, email")
      .or(`name.ilike.%${q}%,apex_number.ilike.%${q}%`)
      .order("name").limit(10)
      .then(({ data }) => { setResults((data as SupplierOption[]) ?? []); setOpen(true); setLoading(false); });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 300);
  }

  function handleSelect(s: SupplierOption) { setQuery(s.name); setOpen(false); onSelect(s); }

  return (
    <div style={{ position: "relative" }}>
      <input className="form-input" value={query} onChange={handleChange}
        onFocus={() => query && search(query)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Type to search supplier…" autoComplete="off" />
      {loading && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)" }}>Searching…</div>}
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 300, maxHeight: 220, overflowY: "auto" }}>
          {results.map(s => (
            <button key={s.id} type="button" onMouseDown={() => handleSelect(s)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f0f2f5" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0f7ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.apex_number && <>APEX: {s.apex_number}</>}{s.email && <> · {s.email}</>}</div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.trim() && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "var(--text-muted)", zIndex: 300 }}>No suppliers found.</div>
      )}
    </div>
  );
}

// ─── CO Search ────────────────────────────────────────────────────────────────

function COSearch({ value, onSelect }: { value: string; onSelect: (co: COOption) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<COOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    supabase.from("users").select("id, name, email").eq("user_type", "internal").eq("is_active", true)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`).order("name").limit(10)
      .then(({ data }) => { setResults((data as COOption[]) ?? []); setOpen(true); setLoading(false); });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 300);
  }

  function handleSelect(co: COOption) { setQuery(co.name); setOpen(false); onSelect(co); }

  return (
    <div style={{ position: "relative" }}>
      <input className="form-input" value={query} onChange={handleChange}
        onFocus={() => query && search(query)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Type to search contract officer…" autoComplete="off" />
      {loading && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)" }}>Searching…</div>}
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 300, maxHeight: 200, overflowY: "auto" }}>
          {results.map(co => (
            <button key={co.id} type="button" onMouseDown={() => handleSelect(co)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f0f2f5" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0f7ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
              <div style={{ fontWeight: 600 }}>{co.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{co.email}</div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.trim() && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "var(--text-muted)", zIndex: 300 }}>No internal users found.</div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EppContractListPage() {
  const [contracts, setContracts] = useState<ContractWithCycles[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addingToEpp, setAddingToEpp] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...BLANK_ADD_FORM });
  const [attachments, setAttachments] = useState<AttachmentSlot[]>(Array.from({ length: 5 }, emptySlot));
  const [savingContract, setSavingContract] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  void getUser;

  useEffect(() => { loadContracts(); }, []);

  async function loadContracts() {
    setLoading(true);
    const { data } = await supabase
      .from("contracts")
      .select("*, contract_cycles(*, epp_contract_cycles(*))")
      .in("contract_type", ["epp", "subk_epp", "subk"])
      .order("created_at", { ascending: false });
    setContracts((data as ContractWithCycles[]) ?? []);
    setLoading(false);
  }

  function setSlot(idx: number, patch: Partial<AttachmentSlot>) {
    setAttachments(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  async function addContract(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.contract_number || !addForm.supplier_name || !addForm.contract_officer) {
      setMsg({ type: "error", text: "Contract number, supplier, and contract officer are required." });
      return;
    }
    setSavingContract(true);

    const { data: inserted, error } = await supabase.from("contracts").insert({
      contract_number: addForm.contract_number,
      supplier_id: addForm.supplier_id || null,
      supplier_name: addForm.supplier_name,
      supplier_apex: addForm.supplier_apex || null,
      supplier_contact: addForm.supplier_contact || null,
      supplier_contact_email: addForm.supplier_contact_email || null,
      portfolios: addForm.portfolios.join(", ") || null,
      cmc: addForm.cmc || null,
      commodity: addForm.commodity || null,
      vendor_contact: addForm.vendor_contact || null,
      contract_amount: addForm.contract_amount ? parseFloat(addForm.contract_amount) : null,
      contract_officer: addForm.contract_officer,
      contract_officer_email: addForm.contract_officer_email || null,
      start_date: addForm.start_date || null,
      expiration_date: addForm.expiration_date || null,
      comments: addForm.comments || null,
      exception: addForm.exception || null,
      contract_type: addForm.contract_type,
    }).select("id").single();

    if (error || !inserted) {
      setMsg({ type: "error", text: "Failed to create EPP contract." });
      setSavingContract(false);
      return;
    }

    const contractId = inserted.id;
    for (let i = 0; i < attachments.length; i++) {
      const slot = attachments[i];
      if (!slot.file) continue;
      let fileUrl = "";
      try {
        const path = `${contractId}/${i + 1}_${slot.file.name}`;
        const { error: uploadErr } = await supabase.storage.from("contract-documents").upload(path, slot.file);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("contract-documents").getPublicUrl(path);
          fileUrl = urlData.publicUrl;
        }
      } catch {}
      await supabase.from("contract_documents").insert({
        contract_id: contractId, slot_number: i + 1,
        file_name: slot.file.name, file_url: fileUrl,
        description: slot.description || null, file_size: slot.file.size,
      });
    }

    setMsg({ type: "success", text: "EPP contract created successfully." });
    setShowAddForm(false);
    setAddForm({ ...BLANK_ADD_FORM });
    setAttachments(Array.from({ length: 5 }, emptySlot));
    await loadContracts();
    setSavingContract(false);
  }

  async function handleAddToEpp(contractId: string) {
    setAddingToEpp(contractId);
    await supabase.from("contracts").update({ contract_type: "subk_epp", updated_at: new Date().toISOString() }).eq("id", contractId);
    await loadContracts();
    setAddingToEpp(null);
  }

  const filtered = contracts.filter((c) => {
    if (typeFilter !== "all" && c.contract_type !== typeFilter) return false;
    if (c.contract_type !== "subk") {
      const eppStatus = getLatestEppStatus(c);
      if (activeTab !== "all" && eppStatus !== activeTab) return false;
    } else if (activeTab !== "all") {
      return false;
    }
    const q = search.trim().toLowerCase();
    if (q) {
      return (
        c.contract_number.toLowerCase().includes(q) ||
        c.supplier_name.toLowerCase().includes(q) ||
        c.contract_officer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleTabChange(key: string) { setActiveTab(key); setPage(1); }
  function handleTypeFilterChange(key: FilterType) { setTypeFilter(key); setPage(1); }
  function handleSearch(q: string) { setSearch(q); setPage(1); }

  function tabCount(key: string): number {
    const base = contracts.filter((c) => typeFilter === "all" || c.contract_type === typeFilter);
    if (key === "all") return base.length;
    return base.filter((c) => c.contract_type !== "subk" && getLatestEppStatus(c) === key).length;
  }

  const portfolioSet = new Set(addForm.portfolios);
  function togglePortfolio(p: string) {
    setAddForm(f => ({ ...f, portfolios: portfolioSet.has(p) ? f.portfolios.filter(x => x !== p) : [...f.portfolios, p] }));
  }

  const eppCatSet = new Set(addForm.epp_categories);
  function toggleEppCat(c: string) {
    setAddForm(f => ({ ...f, epp_categories: eppCatSet.has(c) ? f.epp_categories.filter(x => x !== c) : [...f.epp_categories, c] }));
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">EPP Contract List</h1>
          <p className="page-subtitle">Environmentally Preferable Purchasing compliance contracts</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text" className="form-input"
            placeholder="Search by contract no, supplier, or CO…"
            value={search} onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add Contract</button>
          <Link href="/compliance/epp/contracts/import" className="btn btn-outline">Import CSV</Link>
        </div>
      </div>

      {/* Alert */}
      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "inherit", opacity: 0.7 }} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Inline Add Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--usps-blue)" }}>
          <div className="card-header" style={{ background: "var(--usps-blue-light)" }}>
            <h2 className="card-title">New EPP Contract</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={addContract}>

              {/* Contract Info */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contract Information</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Contract No *</label>
                    <input className="form-input" value={addForm.contract_number} onChange={e => setAddForm({ ...addForm, contract_number: e.target.value })} placeholder="e.g. USPS-EPP-2025-001" required />
                  </div>
                  <div>
                    <label className="form-label">Contract Type</label>
                    <select className="form-select" value={addForm.contract_type} onChange={e => setAddForm({ ...addForm, contract_type: e.target.value as "epp" | "subk_epp" })}>
                      <option value="epp">EPP Only</option>
                      <option value="subk_epp">SubK + EPP</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Exception</label>
                    <input className="form-input" value={addForm.exception} onChange={e => setAddForm({ ...addForm, exception: e.target.value })} placeholder="Exception type, if applicable" />
                  </div>
                </div>
              </div>

              {/* Supplier */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Supplier</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Supplier *</label>
                    <SupplierSearch
                      value={addForm.supplier_name}
                      onSelect={s => setAddForm(f => ({ ...f, supplier_id: s.id, supplier_name: s.name, supplier_apex: s.apex_number ?? "" }))}
                    />
                    {addForm.supplier_apex && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>APEX: {addForm.supplier_apex}</div>}
                  </div>
                  <div>
                    <label className="form-label">Supplier Contact</label>
                    <input className="form-input" value={addForm.supplier_contact} onChange={e => setAddForm({ ...addForm, supplier_contact: e.target.value })} placeholder="Primary contact name" />
                  </div>
                  <div>
                    <label className="form-label">EPP Contact Email</label>
                    <input type="email" className="form-input" value={addForm.supplier_contact_email} onChange={e => setAddForm({ ...addForm, supplier_contact_email: e.target.value })} placeholder="contact@supplier.com" />
                  </div>
                </div>
              </div>

              {/* Contract Officer */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contract Officer</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Contract Officer *</label>
                    <COSearch
                      value={addForm.contract_officer}
                      onSelect={co => setAddForm(f => ({ ...f, contract_officer_id: co.id, contract_officer: co.name, contract_officer_email: co.email }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">CO Email</label>
                    <input type="email" className="form-input" value={addForm.contract_officer_email} onChange={e => setAddForm({ ...addForm, contract_officer_email: e.target.value })} placeholder="Auto-populated from selection" />
                  </div>
                </div>
              </div>

              {/* Portfolios & CMC */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Classification</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Portfolio *</label>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", maxHeight: 120, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {PORTFOLIO_OPTIONS.map(p => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                          <input type="checkbox" checked={portfolioSet.has(p)} onChange={() => togglePortfolio(p)} />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Category Management Center (CMC) *</label>
                    <select className="form-select" value={addForm.cmc} onChange={e => setAddForm({ ...addForm, cmc: e.target.value })}>
                      <option value="">— Select CMC —</option>
                      {CMC_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ marginTop: 10 }}>
                      <label className="form-label">Commodity</label>
                      <input className="form-input" value={addForm.commodity} onChange={e => setAddForm({ ...addForm, commodity: e.target.value })} placeholder="Service or commodity type" />
                    </div>
                  </div>
                </div>
              </div>

              {/* EPP Categories */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>EPP Categories</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "6px 12px", border: `1px solid ${eppCatSet.has(key) ? "var(--usps-blue)" : "var(--border)"}`, borderRadius: 6, background: eppCatSet.has(key) ? "var(--usps-blue-light)" : "white" }}>
                      <input type="checkbox" checked={eppCatSet.has(key)} onChange={() => toggleEppCat(key)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Amounts & Dates */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Amounts & Dates</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Contract Amount ($) *</label>
                    <input type="number" className="form-input" value={addForm.contract_amount} onChange={e => setAddForm({ ...addForm, contract_amount: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div />
                  <div>
                    <label className="form-label">Contract Start Date *</label>
                    <input type="date" className="form-input" value={addForm.start_date} onChange={e => setAddForm({ ...addForm, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Contract Finish Date *</label>
                    <input type="date" className="form-input" value={addForm.expiration_date} onChange={e => setAddForm({ ...addForm, expiration_date: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Comments */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label">Comments</label>
                <textarea className="form-textarea" value={addForm.comments} onChange={e => setAddForm({ ...addForm, comments: e.target.value })} rows={3} placeholder="General comments…" />
              </div>

              {/* Attachments */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Attachments (up to 5 files)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {attachments.map((slot, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, alignItems: "end", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "#fafbfc" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", alignSelf: "center" }}>File {i + 1}</div>
                      <div>
                        <label className="form-label" style={{ fontSize: 11 }}>Description</label>
                        <input className="form-input" value={slot.description} onChange={e => setSlot(i, { description: e.target.value })} placeholder={`Description for file ${i + 1}`} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 11 }}>Choose File</label>
                        <input type="file" style={{ display: "block", fontSize: 13 }}
                          onChange={e => { const f = e.target.files?.[0] ?? null; setSlot(i, { file: f, fileName: f?.name ?? "" }); }} />
                        {slot.fileName && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{slot.fileName}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingContract}>{savingContract ? "Creating…" : "Create Contract"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Type filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>Type:</span>
        {TYPE_FILTERS.map((f) => (
          <button key={f.key} className={`btn btn-sm ${typeFilter === f.key ? "btn-primary" : "btn-ghost"}`} onClick={() => handleTypeFilterChange(f.key)}>{f.label}</button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tabCount(tab.key);
          return (
            <button key={tab.key} className={`tab${activeTab === tab.key ? " active" : ""}`} onClick={() => handleTabChange(tab.key)}>
              {tab.label}
              {count > 0 && (
                <span style={{ marginLeft: 6, background: activeTab === tab.key ? "var(--usps-blue)" : "var(--border)", color: activeTab === tab.key ? "white" : "var(--text-muted)", borderRadius: 100, fontSize: 11, fontWeight: 700, padding: "1px 7px", lineHeight: "16px", display: "inline-block" }}>
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
          <div className="card-body" style={{ textAlign: "center", color: "var(--text-muted)", padding: "56px 20px" }}>Loading contracts…</div>
        ) : paginated.length === 0 ? (
          <div className="card-body" style={{ textAlign: "center", color: "var(--text-muted)", padding: "56px 20px" }}>No contracts found{search ? ` matching "${search}"` : ""}.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract No</th>
                  <th>Supplier Name</th>
                  <th>Contract Officer</th>
                  <th>Contract Amount</th>
                  <th>EPP Status</th>
                  <th>Categories</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((contract) => {
                  const isSubkOnly = contract.contract_type === "subk";
                  const eppStatus = isSubkOnly ? null : getLatestEppStatus(contract);
                  const categories = isSubkOnly ? [] : getLatestEppCategories(contract);
                  return (
                    <tr key={contract.id}>
                      <td>
                        <Link href={`/compliance/epp/contracts/${contract.id}`} style={{ color: "var(--usps-blue)", fontWeight: 600, textDecoration: "none" }}>
                          {contract.contract_number}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 500 }}>{contract.supplier_name}</td>
                      <td>{contract.contract_officer}</td>
                      <td>{formatCurrency(contract.contract_amount)}</td>
                      <td>
                        {isSubkOnly ? <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Not in EPP</span>
                          : eppStatus ? <StatusBadge status={eppStatus} />
                          : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td>
                        {categories.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {categories.map((cat) => (
                              <span key={cat} className="badge badge-green" style={{ fontSize: 10 }}>
                                {CATEGORY_LABELS[cat] || cat}
                              </span>
                            ))}
                          </div>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {isSubkOnly ? (
                            <button className="btn btn-primary btn-sm" disabled={addingToEpp === contract.id} onClick={() => handleAddToEpp(contract.id)}>
                              {addingToEpp === contract.id ? "Adding…" : "Add to EPP"}
                            </button>
                          ) : (
                            <>
                              <Link href={`/compliance/epp/contracts/${contract.id}`} className="btn btn-outline btn-sm">View</Link>
                              <Link href={`/compliance/epp/contracts/${contract.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>
            <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} contract{filtered.length !== 1 ? "s" : ""}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn btn-ghost btn-sm" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && totalPages === 1 && (
          <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>
            {filtered.length} contract{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
