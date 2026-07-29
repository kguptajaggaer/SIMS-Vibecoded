"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, getUser, formatDate, formatCurrency, formatPct } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import type { User, Contract, ContractCycle, EppContractCycle, EppRecycledContent, EppEcolabel, EppBiobased, EppEnergyEfficient, EppWaterEfficient } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  recycled_content: "Recycled Content",
  ecolabel: "Independent Ecolabel",
  biobased: "Bio-Based",
  energy_efficient: "Energy Efficient",
  water_efficient: "Water Efficient",
};

type Tab = "summary" | "recycled" | "ecolabel" | "biobased" | "energy" | "water";

export default function EppCycleDetail() {
  const { contractId, cycleId } = useParams<{ contractId: string; cycleId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [cycle, setCycle] = useState<ContractCycle | null>(null);
  const [eppCycle, setEppCycle] = useState<EppContractCycle | null>(null);
  const [recycled, setRecycled] = useState<EppRecycledContent[]>([]);
  const [ecolabel, setEcolabel] = useState<EppEcolabel[]>([]);
  const [biobased, setBiobased] = useState<EppBiobased[]>([]);
  const [energy, setEnergy] = useState<EppEnergyEfficient[]>([]);
  const [water, setWater] = useState<EppWaterEfficient[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    loadData();
  }, [cycleId]);

  async function loadData() {
    setLoading(true);
    const [{ data: c }, { data: cy }, { data: epp }] = await Promise.all([
      supabase.from("contracts").select("*").eq("id", contractId).single(),
      supabase.from("contract_cycles").select("*").eq("id", cycleId).single(),
      supabase.from("epp_contract_cycles").select("*").eq("contract_cycle_id", cycleId).single(),
    ]);
    setContract(c);
    setCycle(cy);
    setEppCycle(epp);

    if (epp) {
      const [rc, ec, bb, en, wa] = await Promise.all([
        supabase.from("epp_recycled_content").select("*").eq("epp_contract_cycle_id", epp.id),
        supabase.from("epp_ecolabel").select("*").eq("epp_contract_cycle_id", epp.id),
        supabase.from("epp_biobased").select("*").eq("epp_contract_cycle_id", epp.id),
        supabase.from("epp_energy_efficient").select("*").eq("epp_contract_cycle_id", epp.id),
        supabase.from("epp_water_efficient").select("*").eq("epp_contract_cycle_id", epp.id),
      ]);
      setRecycled(rc.data || []);
      setEcolabel(ec.data || []);
      setBiobased(bb.data || []);
      setEnergy(en.data || []);
      setWater(wa.data || []);
    }
    setLoading(false);
  }

  const categories = eppCycle ? (eppCycle.epp_categories as string[]) : [];
  const tabItems: { key: Tab; label: string; count?: number }[] = [
    { key: "summary", label: "Summary" },
    ...(categories.includes("recycled_content") ? [{ key: "recycled" as Tab, label: "Recycled Content", count: recycled.length }] : []),
    ...(categories.includes("ecolabel") ? [{ key: "ecolabel" as Tab, label: "Ecolabel", count: ecolabel.length }] : []),
    ...(categories.includes("biobased") ? [{ key: "biobased" as Tab, label: "Bio-Based", count: biobased.length }] : []),
    ...(categories.includes("energy_efficient") ? [{ key: "energy" as Tab, label: "Energy Efficient", count: energy.length }] : []),
    ...(categories.includes("water_efficient") ? [{ key: "water" as Tab, label: "Water Efficient", count: water.length }] : []),
  ];

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!contract || !cycle) return <div className="p-8 text-center text-gray-400">Not found.</div>;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/compliance/epp/contracts" style={{ color: "var(--usps-blue)" }}>EPP Contracts</Link>
        {" / "}
        <Link href={`/compliance/epp/contracts/${contractId}`} style={{ color: "var(--usps-blue)" }}>{contract.contract_number}</Link>
        {" / "}{cycle.name}
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{cycle.name} — {contract.supplier_name}</h1>
          <p className="page-subtitle">Contract: {contract.contract_number} · CO: {contract.contract_officer}</p>
        </div>
        {eppCycle && <StatusBadge status={eppCycle.epp_status} />}
      </div>

      {/* Stats row */}
      {eppCycle && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {[
            ["Total Contract Spend", formatCurrency(eppCycle.total_contract_spend)],
            ["Total EPP Spend", formatCurrency(eppCycle.total_epp_spend)],
            ["EPP Percentage", formatPct(eppCycle.epp_percentage)],
            ["EPP Categories", (eppCycle.epp_categories as string[]).length.toString()],
          ].map(([label, val]) => (
            <div key={label} className="stat-widget">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {tabItems.map(t => (
          <button key={t.key} className={`tab${activeTab === t.key ? " active" : ""}`} onClick={() => setActiveTab(t.key)}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">EPP Summary Report</h2></div>
          <div className="card-body">
            {eppCycle?.instructions && (
              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: 13 }}>Instructions:</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>{eppCycle.instructions}</p>
              </div>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>EPP Category</th>
                  <th>Products Reported</th>
                  <th>Total EPP Spend</th>
                  <th>% of Contract Spend</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "recycled_content", items: recycled, spend: recycled.reduce((s, r) => s + (r.total_spend || 0), 0) },
                  { key: "ecolabel", items: ecolabel, spend: ecolabel.reduce((s, r) => s + (r.total_spend || 0), 0) },
                  { key: "biobased", items: biobased, spend: biobased.reduce((s, r) => s + (r.total_spend || 0), 0) },
                  { key: "energy_efficient", items: energy, spend: energy.reduce((s, r) => s + (r.total_spend || 0), 0) },
                  { key: "water_efficient", items: water, spend: water.reduce((s, r) => s + (r.total_spend || 0), 0) },
                ]
                  .filter(r => categories.includes(r.key))
                  .map(r => {
                    const pct = eppCycle?.total_contract_spend ? (r.spend / eppCycle.total_contract_spend) * 100 : 0;
                    return (
                      <tr key={r.key}>
                        <td>{CATEGORY_LABELS[r.key]}</td>
                        <td>{r.items.length}</td>
                        <td>{formatCurrency(r.spend)}</td>
                        <td>{pct.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recycled Content */}
      {activeTab === "recycled" && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Recycled Content Products</h2></div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Manufacturer</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total Spend</th>
                  <th>Recovered %</th>
                  <th>Post-Consumer %</th>
                  <th>EPA Designation</th>
                </tr>
              </thead>
              <tbody>
                {recycled.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                    <td>{r.manufacturer || "—"}</td>
                    <td>{r.unit_of_measure || "—"}</td>
                    <td>{r.quantity_purchased || "—"}</td>
                    <td>{formatCurrency(r.unit_price)}</td>
                    <td style={{ fontWeight: 600, background: "#f8fafc" }}>{formatCurrency(r.total_spend)}</td>
                    <td>{r.recovered_material_content_pct ? `${r.recovered_material_content_pct}%` : "—"}</td>
                    <td>{r.post_consumer_content_pct ? `${r.post_consumer_content_pct}%` : "—"}</td>
                    <td>{r.epa_designation || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ecolabel */}
      {activeTab === "ecolabel" && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Independent Ecolabel Products</h2></div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Manufacturer</th>
                  <th>Ecolabel Name</th>
                  <th>Cert. Number</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {ecolabel.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                    <td>{r.manufacturer || "—"}</td>
                    <td>{r.ecolabel_name || "—"}</td>
                    <td>{r.certification_number || "—"}</td>
                    <td>{r.unit_of_measure || "—"}</td>
                    <td>{r.quantity_purchased || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(r.total_spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bio-Based */}
      {activeTab === "biobased" && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Bio-Based Products</h2></div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Manufacturer</th>
                  <th>USDA Designation</th>
                  <th>Biobased Content %</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {biobased.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                    <td>{r.manufacturer || "—"}</td>
                    <td>{r.usda_designation || "—"}</td>
                    <td>{r.biobased_content_pct ? `${r.biobased_content_pct}%` : "—"}</td>
                    <td>{r.unit_of_measure || "—"}</td>
                    <td>{r.quantity_purchased || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(r.total_spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Energy Efficient */}
      {activeTab === "energy" && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Energy Efficient Products</h2></div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Manufacturer</th>
                  <th>Energy Star</th>
                  <th>FEMP</th>
                  <th>Efficiency Rating</th>
                  <th>Qty</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {energy.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                    <td>{r.manufacturer || "—"}</td>
                    <td>{r.energy_star_certified ? <span className="badge badge-green">Yes</span> : "No"}</td>
                    <td>{r.femp_designated ? <span className="badge badge-blue">Yes</span> : "No"}</td>
                    <td>{r.efficiency_rating || "—"}</td>
                    <td>{r.quantity_purchased || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(r.total_spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Water Efficient */}
      {activeTab === "water" && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Water Efficient Products</h2></div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Manufacturer</th>
                  <th>WaterSense Certified</th>
                  <th>Efficiency Rating</th>
                  <th>Qty</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {water.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                    <td>{r.manufacturer || "—"}</td>
                    <td>{r.watersense_certified ? <span className="badge badge-blue">Yes</span> : "No"}</td>
                    <td>{r.efficiency_rating || "—"}</td>
                    <td>{r.quantity_purchased || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(r.total_spend)}</td>
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
