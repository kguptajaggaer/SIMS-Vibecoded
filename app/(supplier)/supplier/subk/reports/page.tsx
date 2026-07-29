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
}

interface CycleRow {
  id: string;
  contract_id: string;
  name: string;
  status: string;
  supplier_status: string;
  start_date?: string;
  end_date?: string;
  contracts: ContractRow;
}

export default function SupplierSubkReports() {
  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.supplier_id) loadData(u.supplier_id);
    else setLoading(false);
  }, []);

  async function loadData(supplierId: string) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id")
      .eq("supplier_id", supplierId);

    const contractIds = (contracts || []).map((c: { id: string }) => c.id);
    if (!contractIds.length) { setLoading(false); return; }

    const { data: cycleData } = await supabase
      .from("contract_cycles")
      .select("*, contracts(*)")
      .in("contract_id", contractIds)
      .order("created_at", { ascending: false });

    setCycles(cycleData || []);
    setLoading(false);
  }

  void user;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">SubK Report Summary</h1>
          <p className="page-subtitle">Summary of all your SubK reporting activity</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading reports…</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract No</th>
                  <th>Supplier</th>
                  <th>Cycle / Period</th>
                  <th>Period Dates</th>
                  <th>Contract Amount</th>
                  <th>Status</th>
                  <th>Your Status</th>
                </tr>
              </thead>
              <tbody>
                {cycles.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No reporting history found.</td></tr>
                ) : cycles.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.contracts.contract_number}</td>
                    <td>{c.contracts.supplier_name}</td>
                    <td>{c.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {c.start_date ? formatDate(c.start_date) : "—"} – {c.end_date ? formatDate(c.end_date) : "—"}
                    </td>
                    <td>{formatCurrency(c.contracts.contract_amount)}</td>
                    <td>
                      <span className={`badge ${
                        c.status === "closed" ? "badge-green" :
                        c.status === "open_for_reporting" ? "badge-yellow" :
                        c.status === "ready_for_co_review" ? "badge-orange" :
                        "badge-gray"
                      }`}>{c.status.replace(/_/g, " ")}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        c.supplier_status === "supplier_reported" ? "badge-green" :
                        c.supplier_status === "enter_spend_data" ? "badge-yellow" :
                        "badge-gray"
                      }`}>{c.supplier_status.replace(/_/g, " ")}</span>
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
