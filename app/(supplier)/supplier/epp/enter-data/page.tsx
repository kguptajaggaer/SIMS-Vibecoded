"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, getUser, formatDate } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface EppContractRow {
  eppCycleId: string;
  contractCycleId: string;
  contractId: string;
  contractNumber: string;
  contractOfficer: string;
  cycleName: string;
  startDate?: string;
  endDate?: string;
  eppStatus: string;
  eppCategories: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  recycled_content: "Recycled Content",
  ecolabel: "Independent Ecolabel",
  biobased: "Bio-Based",
  energy_efficient: "Energy Efficient",
  water_efficient: "Water Efficient",
};

export default function SupplierEppEnterData() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<EppContractRow[]>([]);
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
      .select("id,contract_cycle_id,epp_status,epp_categories")
      .in("contract_cycle_id", cycleIds)
      .in("epp_status", ["enter_epp_data", "open_for_reporting"]);

    const contractMap = Object.fromEntries(
      (contracts || []).map((c: { id: string; contract_number: string; contract_officer: string }) => [c.id, c])
    );
    const cycleMap = Object.fromEntries(
      (cycles || []).map((c: { id: string; name: string; start_date?: string; end_date?: string; contract_id: string }) => [c.id, c])
    );

    const result: EppContractRow[] = (eppCycles || []).map((ec: {
      id: string; contract_cycle_id: string; epp_status: string; epp_categories: string[];
    }) => {
      const cycle = cycleMap[ec.contract_cycle_id];
      const contract = cycle ? contractMap[cycle.contract_id] : null;
      return {
        eppCycleId: ec.id,
        contractCycleId: ec.contract_cycle_id,
        contractId: cycle?.contract_id || "",
        contractNumber: contract?.contract_number || "—",
        contractOfficer: contract?.contract_officer || "—",
        cycleName: cycle?.name || "—",
        startDate: cycle?.start_date,
        endDate: cycle?.end_date,
        eppStatus: ec.epp_status,
        eppCategories: ec.epp_categories || [],
      };
    });

    setRows(result);
    setLoading(false);
  }

  void user;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Enter EPP Data</h1>
          <p className="page-subtitle">Submit Environmentally Preferable Product data for your contracts</p>
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
                  <th>CO</th>
                  <th>Period</th>
                  <th>EPP Categories Enabled</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                      No EPP contracts open for data entry. Contact your Contract Officer.
                    </td>
                  </tr>
                ) : rows.map(r => (
                  <tr key={r.eppCycleId}>
                    <td style={{ fontWeight: 600 }}>{r.contractNumber}</td>
                    <td>{r.contractOfficer}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.cycleName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {r.startDate ? formatDate(r.startDate) : "—"} – {r.endDate ? formatDate(r.endDate) : "—"}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {r.eppCategories.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None configured</span>
                        ) : r.eppCategories.map(cat => (
                          <span key={cat} className="badge badge-blue" style={{ fontSize: 10 }}>
                            {CATEGORY_LABELS[cat] || cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        r.eppStatus === "enter_epp_data" ? "badge-yellow" :
                        r.eppStatus === "open_for_reporting" ? "badge-orange" :
                        "badge-gray"
                      }`}>
                        {r.eppStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/supplier/epp/enter-data/${r.contractId}/${r.contractCycleId}`}
                        className="btn btn-primary btn-sm"
                      >
                        Enter EPP Data
                      </Link>
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
