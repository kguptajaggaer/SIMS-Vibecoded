"use client";
import { useEffect, useState } from "react";
import { supabase, getUser, formatDate, formatCurrency, formatPct } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface EppReportRow {
  cycleId: string;
  cycleName: string;
  contractNumber: string;
  contractOfficer: string;
  eppStatus: string;
  totalContractSpend?: number;
  totalEppSpend?: number;
  eppPercentage?: number;
  categories: string[];
  periodStart?: string;
  periodEnd?: string;
}

export default function SupplierEppReports() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<EppReportRow[]>([]);
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
      .select("id,contract_number,contract_officer")
      .eq("supplier_id", supplierId);

    const contractIds = (contracts || []).map((c: { id: string }) => c.id);
    if (!contractIds.length) { setLoading(false); return; }

    const { data: cycles } = await supabase
      .from("contract_cycles")
      .select("id,name,start_date,end_date,contract_id")
      .in("contract_id", contractIds);

    const cycleIds = (cycles || []).map((c: { id: string }) => c.id);
    if (!cycleIds.length) { setLoading(false); return; }

    const { data: eppCycles } = await supabase
      .from("epp_contract_cycles")
      .select("*")
      .in("contract_cycle_id", cycleIds);

    const contractMap = Object.fromEntries(
      (contracts || []).map((c: { id: string; contract_number: string; contract_officer: string }) => [c.id, c])
    );
    const cycleMap = Object.fromEntries(
      (cycles || []).map((c: { id: string; name: string; start_date?: string; end_date?: string; contract_id: string }) => [c.id, c])
    );

    const result: EppReportRow[] = (eppCycles || []).map((ec: {
      contract_cycle_id: string; epp_status: string;
      total_contract_spend?: number; total_epp_spend?: number; epp_percentage?: number; epp_categories: string[];
    }) => {
      const cycle = cycleMap[ec.contract_cycle_id];
      const contract = cycle ? contractMap[cycle.contract_id] : null;
      return {
        cycleId: ec.contract_cycle_id,
        cycleName: cycle?.name || "—",
        contractNumber: contract?.contract_number || "—",
        contractOfficer: contract?.contract_officer || "—",
        eppStatus: ec.epp_status,
        totalContractSpend: ec.total_contract_spend,
        totalEppSpend: ec.total_epp_spend,
        eppPercentage: ec.epp_percentage,
        categories: ec.epp_categories || [],
        periodStart: cycle?.start_date,
        periodEnd: cycle?.end_date,
      };
    });

    setRows(result);
    setLoading(false);
  }

  const CATEGORY_LABELS: Record<string, string> = {
    recycled_content: "Recycled", ecolabel: "Ecolabel", biobased: "Bio-Based",
    energy_efficient: "Energy", water_efficient: "Water",
  };

  void user;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">EPP Report Summary</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract No</th>
                  <th>CO</th>
                  <th>Cycle / Period</th>
                  <th>EPP Status</th>
                  <th>Categories</th>
                  <th>Contract Spend</th>
                  <th>EPP Spend</th>
                  <th>EPP %</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No EPP reporting history found.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.cycleId}>
                    <td style={{ fontWeight: 500 }}>{r.contractNumber}</td>
                    <td>{r.contractOfficer}</td>
                    <td>
                      <div>{r.cycleName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {r.periodStart ? formatDate(r.periodStart) : "—"} – {r.periodEnd ? formatDate(r.periodEnd) : "—"}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        r.eppStatus === "finalized" ? "badge-green" :
                        r.eppStatus === "ready_for_co_review" || r.eppStatus === "ready_for_epp_admin_review" ? "badge-orange" :
                        r.eppStatus === "enter_epp_data" ? "badge-yellow" :
                        "badge-gray"
                      }`}>{r.eppStatus.replace(/_/g, " ")}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {r.categories.map(c => (
                          <span key={c} className="badge badge-blue" style={{ fontSize: 10 }}>{CATEGORY_LABELS[c] || c}</span>
                        ))}
                      </div>
                    </td>
                    <td>{formatCurrency(r.totalContractSpend)}</td>
                    <td>{formatCurrency(r.totalEppSpend)}</td>
                    <td style={{ fontWeight: 600 }}>{formatPct(r.eppPercentage)}</td>
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
