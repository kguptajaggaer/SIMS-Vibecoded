"use client";
import { useEffect, useState } from "react";
import { supabase, getUser, formatDate, formatCurrency } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface ContractRow {
  id: string;
  contract_number: string;
  supplier_name: string;
  contract_officer: string;
  contract_amount?: number;
  start_date?: string;
  expiration_date?: string;
  contract_type: string;
}

export default function AddSubkToEpp() {
  const [user, setUser] = useState<User | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "subk" | "epp" | "subk_epp">("all");

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.supplier_id) loadData(u.supplier_id);
    else setLoading(false);
  }, []);

  async function loadData(supplierId: string) {
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("contract_number");
    setContracts(data || []);
    setLoading(false);
  }

  async function addToEpp(contractId: string) {
    if (!user) return;
    setAdding(contractId);

    const { data: existing } = await supabase
      .from("contracts")
      .select("contract_type")
      .eq("id", contractId)
      .single();

    if (existing?.contract_type === "subk_epp") {
      setMsg({ type: "error", text: "This contract is already linked to EPP." });
      setAdding(null);
      return;
    }

    const { error } = await supabase
      .from("contracts")
      .update({ contract_type: "subk_epp", updated_at: new Date().toISOString() })
      .eq("id", contractId);

    if (error) {
      setMsg({ type: "error", text: "Failed to add contract to EPP." });
    } else {
      setMsg({ type: "success", text: "Contract added to EPP successfully." });
      if (user.supplier_id) await loadData(user.supplier_id);
    }
    setAdding(null);
  }

  const filtered = contracts.filter(c =>
    filter === "all" ? true :
    filter === "subk" ? c.contract_type === "subk" :
    filter === "epp" ? c.contract_type === "epp" :
    c.contract_type === "subk_epp"
  );

  void user;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add SubK Contracts to EPP</h1>
          <p className="page-subtitle">Link your existing SubK contracts to Environmental Preferred Product tracking</p>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([
          ["all", "All Contracts"],
          ["subk", "SubK Only"],
          ["epp", "EPP Only"],
          ["subk_epp", "SubK & EPP"],
        ] as [typeof filter, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
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
                  <th>Supplier Name</th>
                  <th>Contract Officer</th>
                  <th>Contract Amount</th>
                  <th>Start Date</th>
                  <th>Expiration</th>
                  <th>Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No contracts found.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.contract_number}</td>
                    <td>{c.supplier_name}</td>
                    <td>{c.contract_officer}</td>
                    <td>{formatCurrency(c.contract_amount)}</td>
                    <td style={{ fontSize: 12 }}>{c.start_date ? formatDate(c.start_date) : "—"}</td>
                    <td style={{ fontSize: 12 }}>{c.expiration_date ? formatDate(c.expiration_date) : "—"}</td>
                    <td>
                      <span className={`badge ${
                        c.contract_type === "subk_epp" ? "badge-green" :
                        c.contract_type === "epp" ? "badge-blue" : "badge-gray"
                      }`}>{c.contract_type.replace(/_/g, " ").toUpperCase()}</span>
                    </td>
                    <td>
                      {c.contract_type === "subk" ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => addToEpp(c.id)}
                          disabled={adding === c.id}
                        >
                          {adding === c.id ? "Adding…" : "Add to EPP"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {c.contract_type === "subk_epp" ? "✓ In EPP" : "EPP Only"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
