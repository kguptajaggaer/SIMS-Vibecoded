"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface SpendRow {
  cycleId: string;
  contractId: string;
  contractNumber: string;
  contractOfficer: string;
  contractAmount?: number;
  cycleName: string;
  startDate?: string;
  endDate?: string;
  status: string;
  supplierStatus: string;
}

interface SupplierResult {
  id: string;
  name: string;
  apex_number?: string;
  diversity_classifications: string[];
}

interface SubkWidget {
  contractId: string;
  cycleId: string;
  contractNumber: string;
}

export default function SupplierSpendData() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<SpendRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Select Subcontractors widget state
  const [widget, setWidget] = useState<SubkWidget | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SupplierResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [widgetMsg, setWidgetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      .select("id, contract_number, contract_officer, contract_amount")
      .eq("supplier_id", supplierId);

    const contractIds = (contracts || []).map((c: { id: string }) => c.id);
    if (!contractIds.length) { setLoading(false); return; }

    const { data: cycles } = await supabase
      .from("contract_cycles")
      .select("*")
      .in("contract_id", contractIds)
      .eq("supplier_status", "enter_spend_data")
      .order("created_at", { ascending: false });

    const contractMap = Object.fromEntries(
      (contracts || []).map((c: {
        id: string;
        contract_number: string;
        contract_officer: string;
        contract_amount?: number;
      }) => [c.id, c])
    );

    const result: SpendRow[] = (cycles || []).map((cy: {
      id: string;
      contract_id: string;
      name: string;
      start_date?: string;
      end_date?: string;
      status: string;
      supplier_status: string;
    }) => {
      const c = contractMap[cy.contract_id];
      return {
        cycleId: cy.id,
        contractId: cy.contract_id,
        contractNumber: c?.contract_number || "—",
        contractOfficer: c?.contract_officer || "—",
        contractAmount: c?.contract_amount,
        cycleName: cy.name,
        startDate: cy.start_date,
        endDate: cy.end_date,
        status: cy.status,
        supplierStatus: cy.supplier_status,
      };
    });

    setRows(result);
    setLoading(false);
  }

  async function handleSearchVendors(query: string) {
    setSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, apex_number, diversity_classifications")
      .ilike("name", `%${query.trim()}%`)
      .limit(20);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function addSubcontractor(supplier: SupplierResult) {
    if (!widget) return;
    setAdding(supplier.id);
    setWidgetMsg(null);

    const { error } = await supabase.from("subcontractors").insert({
      contract_cycle_id: widget.cycleId,
      vendor_name: supplier.name,
      vendor_apex: supplier.apex_number || null,
      classifications: supplier.diversity_classifications || [],
      direct_expense: 0,
      indirect_expense: 0,
    });

    if (error) {
      setWidgetMsg({ type: "error", text: `Failed to add ${supplier.name}.` });
    } else {
      setWidgetMsg({ type: "success", text: `${supplier.name} added as subcontractor.` });
    }
    setAdding(null);
  }

  function openWidget(row: SpendRow) {
    setWidget({ contractId: row.contractId, cycleId: row.cycleId, contractNumber: row.contractNumber });
    setSearch("");
    setSearchResults([]);
    setWidgetMsg(null);
  }

  function closeWidget() {
    setWidget(null);
    setSearch("");
    setSearchResults([]);
    setWidgetMsg(null);
  }

  void user;
  void formatCurrency;
  void formatDate;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Enter Spend Data</h1>
          <p className="page-subtitle">Submit subcontractor vendor and expense information for your contracts</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading contracts…</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract No</th>
                  <th>Contract Officer</th>
                  <th>Spend Period</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                      No contracts are currently open for spend data entry. Contact your Contract Officer.
                    </td>
                  </tr>
                ) : rows.map(r => (
                  <tr key={r.cycleId}>
                    <td style={{ fontWeight: 600 }}>{r.contractNumber}</td>
                    <td>{r.contractOfficer}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.cycleName}</div>
                      {(r.startDate || r.endDate) && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {r.startDate ? formatDate(r.startDate) : "—"} – {r.endDate ? formatDate(r.endDate) : "—"}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        r.supplierStatus === "enter_spend_data" ? "badge-yellow" :
                        r.supplierStatus === "supplier_reported" ? "badge-green" : "badge-gray"
                      }`}>
                        {r.supplierStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link
                          href={`/supplier/subk/spend-data/${r.contractId}/${r.cycleId}`}
                          className="btn btn-primary btn-sm"
                        >
                          Enter Spend Data
                        </Link>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openWidget(r)}
                        >
                          Select Subcontractors
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Select Subcontractors Widget */}
      {widget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}
          onClick={e => { if (e.target === e.currentTarget) closeWidget(); }}
        >
          <div style={{
            background: "var(--card-bg, #fff)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            width: "100%",
            maxWidth: 560,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Widget Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--usps-blue)",
              color: "white",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Select Subcontractors</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                  Contract: {widget.contractNumber}
                </div>
              </div>
              <button
                onClick={closeWidget}
                style={{
                  background: "transparent", border: "none", color: "white",
                  fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>

            {/* Widget Body */}
            <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Search Vendors</label>
                <input
                  className="form-input"
                  placeholder="Type vendor name to search…"
                  value={search}
                  onChange={e => handleSearchVendors(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Searching…</div>
                )}
              </div>

              {widgetMsg && (
                <div className={`alert ${widgetMsg.type === "success" ? "alert-success" : "alert-error"}`}>
                  {widgetMsg.text}
                </div>
              )}

              {searchResults.length > 0 && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                  {searchResults.map((s, i) => (
                    <div key={s.id} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: i < searchResults.length - 1 ? "1px solid var(--border)" : "none",
                      background: i % 2 === 0 ? "transparent" : "var(--bg-subtle, #f8fafc)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                          {s.apex_number && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>APEX: {s.apex_number}</span>
                          )}
                          {(s.diversity_classifications || []).map(cls => (
                            <span key={cls} className="badge badge-blue" style={{ fontSize: 10 }}>{cls}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => addSubcontractor(s)}
                        disabled={adding === s.id}
                        style={{ flexShrink: 0, marginLeft: 12 }}
                      >
                        {adding === s.id ? "Adding…" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!searching && search.trim().length >= 2 && searchResults.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No vendors found matching &quot;{search}&quot;
                </div>
              )}

              {search.trim().length < 2 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  Type at least 2 characters to search for vendors
                </div>
              )}
            </div>

            {/* Widget Footer */}
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-subtle, #f8fafc)",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Added vendors will appear in Spend Data entry
              </span>
              <button className="btn btn-ghost btn-sm" onClick={closeWidget}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
