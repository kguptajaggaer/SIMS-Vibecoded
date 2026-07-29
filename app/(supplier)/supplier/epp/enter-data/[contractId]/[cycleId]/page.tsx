"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, getUser, formatCurrency } from "@/lib/supabase";
import type { User } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EppCycleData {
  id: string;
  epp_status: string;
  epp_categories: string[];
  instructions?: string;
  supplier_instructions?: string;
  total_contract_spend?: number;
}

interface ContractInfo {
  contract_number: string;
  contract_officer: string;
}

interface CycleInfo {
  name: string;
}

// Shared fields across all product rows
interface BaseProduct {
  id?: string;
  product_name: string;
  manufacturer: string;
  unit_of_measure: string;
  quantity_purchased: string;
  unit_price: string;
  notes: string;
  isEditing?: boolean;
  isNew?: boolean;
}

interface RecycledRow extends BaseProduct {
  description: string;
  recovered_material_content_pct: string;
  post_consumer_content_pct: string;
  epa_designation: string;
  cpg_item: string;
}

interface EcolabelRow extends BaseProduct {
  ecolabel_name: string;
  certification_number: string;
}

interface BiobasedRow extends BaseProduct {
  usda_designation: string;
  biobased_content_pct: string;
}

interface EnergyRow extends BaseProduct {
  energy_star_certified: boolean;
  femp_designated: boolean;
  efficiency_rating: string;
}

interface WaterRow extends BaseProduct {
  watersense_certified: boolean;
  efficiency_rating: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTotalSpend(qty: string, price: string): number {
  const q = parseFloat(qty) || 0;
  const p = parseFloat(price) || 0;
  return q * p;
}

function emptyRecycled(): RecycledRow {
  return { product_name: "", manufacturer: "", description: "", unit_of_measure: "", quantity_purchased: "", unit_price: "", recovered_material_content_pct: "", post_consumer_content_pct: "", epa_designation: "", cpg_item: "", notes: "", isNew: true, isEditing: true };
}
function emptyEcolabel(): EcolabelRow {
  return { product_name: "", manufacturer: "", ecolabel_name: "", certification_number: "", unit_of_measure: "", quantity_purchased: "", unit_price: "", notes: "", isNew: true, isEditing: true };
}
function emptyBiobased(): BiobasedRow {
  return { product_name: "", manufacturer: "", usda_designation: "", biobased_content_pct: "", unit_of_measure: "", quantity_purchased: "", unit_price: "", notes: "", isNew: true, isEditing: true };
}
function emptyEnergy(): EnergyRow {
  return { product_name: "", manufacturer: "", energy_star_certified: false, femp_designated: false, efficiency_rating: "", unit_of_measure: "", quantity_purchased: "", unit_price: "", notes: "", isNew: true, isEditing: true };
}
function emptyWater(): WaterRow {
  return { product_name: "", manufacturer: "", watersense_certified: false, efficiency_rating: "", unit_of_measure: "", quantity_purchased: "", unit_price: "", notes: "", isNew: true, isEditing: true };
}

const CATEGORY_STEPS: Record<string, number> = {};
const CATEGORY_LABELS: Record<string, string> = {
  recycled_content: "Recycled Content",
  ecolabel: "Independent Ecolabel",
  biobased: "Bio-Based",
  energy_efficient: "Energy Efficient",
  water_efficient: "Water Efficient",
};

// ─── Sub-components: Inline edit helpers ─────────────────────────────────────

function CalcCell({ qty, price }: { qty: string; price: string }) {
  const total = calcTotalSpend(qty, price);
  return (
    <td style={{ background: "#1e293b", color: "#f1f5f9", fontWeight: 700, fontSize: 13, padding: "8px 14px", whiteSpace: "nowrap" }}>
      {formatCurrency(total)}
    </td>
  );
}

function ReadCalcCell({ value }: { value?: number }) {
  return (
    <td style={{ background: "#1e293b", color: "#f1f5f9", fontWeight: 700, fontSize: 13, padding: "8px 14px", whiteSpace: "nowrap" }}>
      {formatCurrency(value ?? 0)}
    </td>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupplierEppDataEntry() {
  const { contractId, cycleId } = useParams<{ contractId: string; cycleId: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [eppCycle, setEppCycle] = useState<EppCycleData | null>(null);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Steps: 0 = Instructions, then one per enabled category, last = Summary
  const [step, setStep] = useState(0);

  // Per-category product rows
  const [recycledRows, setRecycledRows] = useState<RecycledRow[]>([]);
  const [ecolabelRows, setEcolabelRows] = useState<EcolabelRow[]>([]);
  const [biobasedRows, setBiobasedRows] = useState<BiobasedRow[]>([]);
  const [energyRows, setEnergyRows] = useState<EnergyRow[]>([]);
  const [waterRows, setWaterRows] = useState<WaterRow[]>([]);

  const categories = eppCycle?.epp_categories || [];

  // Build dynamic step list: 0 = Instructions, 1..n = categories, last = Summary
  const stepList = ["instructions", ...categories, "summary"];
  const totalSteps = stepList.length;
  const currentStepKey = stepList[step] ?? "summary";
  const isReadOnly = eppCycle?.epp_status === "ready_for_co_review" || eppCycle?.epp_status === "finalized";

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: cy }] = await Promise.all([
      supabase.from("contracts").select("contract_number,contract_officer").eq("id", contractId).single(),
      supabase.from("contract_cycles").select("name").eq("id", cycleId).single(),
    ]);
    setContract(c);
    setCycle(cy);

    const { data: ec } = await supabase
      .from("epp_contract_cycles")
      .select("id,epp_status,epp_categories,instructions,supplier_instructions,total_contract_spend")
      .eq("contract_cycle_id", cycleId)
      .single();

    setEppCycle(ec);

    if (ec?.id) {
      const [{ data: rc }, { data: el }, { data: bb }, { data: en }, { data: we }] = await Promise.all([
        supabase.from("epp_recycled_content").select("*").eq("epp_contract_cycle_id", ec.id).order("created_at"),
        supabase.from("epp_ecolabels").select("*").eq("epp_contract_cycle_id", ec.id).order("created_at"),
        supabase.from("epp_biobased").select("*").eq("epp_contract_cycle_id", ec.id).order("created_at"),
        supabase.from("epp_energy_efficient").select("*").eq("epp_contract_cycle_id", ec.id).order("created_at"),
        supabase.from("epp_water_efficient").select("*").eq("epp_contract_cycle_id", ec.id).order("created_at"),
      ]);

      setRecycledRows((rc || []).map((r: {
        id: string; product_name: string; manufacturer?: string; product_description?: string;
        unit_of_measure?: string; quantity_purchased?: number; unit_price?: number;
        recovered_material_content_pct?: number; post_consumer_content_pct?: number;
        epa_designation?: string; cpg_item?: string; notes?: string;
      }) => ({
        id: r.id, product_name: r.product_name, manufacturer: r.manufacturer || "",
        description: r.product_description || "", unit_of_measure: r.unit_of_measure || "",
        quantity_purchased: r.quantity_purchased?.toString() || "", unit_price: r.unit_price?.toString() || "",
        recovered_material_content_pct: r.recovered_material_content_pct?.toString() || "",
        post_consumer_content_pct: r.post_consumer_content_pct?.toString() || "",
        epa_designation: r.epa_designation || "", cpg_item: r.cpg_item || "", notes: r.notes || "",
        isEditing: false,
      })));

      setEcolabelRows((el || []).map((r: {
        id: string; product_name: string; manufacturer?: string; ecolabel_name?: string;
        certification_number?: string; unit_of_measure?: string; quantity_purchased?: number;
        unit_price?: number; notes?: string;
      }) => ({
        id: r.id, product_name: r.product_name, manufacturer: r.manufacturer || "",
        ecolabel_name: r.ecolabel_name || "", certification_number: r.certification_number || "",
        unit_of_measure: r.unit_of_measure || "", quantity_purchased: r.quantity_purchased?.toString() || "",
        unit_price: r.unit_price?.toString() || "", notes: r.notes || "", isEditing: false,
      })));

      setBiobasedRows((bb || []).map((r: {
        id: string; product_name: string; manufacturer?: string; usda_designation?: string;
        biobased_content_pct?: number; unit_of_measure?: string; quantity_purchased?: number;
        unit_price?: number; notes?: string;
      }) => ({
        id: r.id, product_name: r.product_name, manufacturer: r.manufacturer || "",
        usda_designation: r.usda_designation || "", biobased_content_pct: r.biobased_content_pct?.toString() || "",
        unit_of_measure: r.unit_of_measure || "", quantity_purchased: r.quantity_purchased?.toString() || "",
        unit_price: r.unit_price?.toString() || "", notes: r.notes || "", isEditing: false,
      })));

      setEnergyRows((en || []).map((r: {
        id: string; product_name: string; manufacturer?: string; energy_star_certified?: boolean;
        femp_designated?: boolean; efficiency_rating?: string; unit_of_measure?: string;
        quantity_purchased?: number; unit_price?: number; notes?: string;
      }) => ({
        id: r.id, product_name: r.product_name, manufacturer: r.manufacturer || "",
        energy_star_certified: r.energy_star_certified || false, femp_designated: r.femp_designated || false,
        efficiency_rating: r.efficiency_rating || "", unit_of_measure: r.unit_of_measure || "",
        quantity_purchased: r.quantity_purchased?.toString() || "", unit_price: r.unit_price?.toString() || "",
        notes: r.notes || "", isEditing: false,
      })));

      setWaterRows((we || []).map((r: {
        id: string; product_name: string; manufacturer?: string; watersense_certified?: boolean;
        efficiency_rating?: string; unit_of_measure?: string; quantity_purchased?: number;
        unit_price?: number; notes?: string;
      }) => ({
        id: r.id, product_name: r.product_name, manufacturer: r.manufacturer || "",
        watersense_certified: r.watersense_certified || false, efficiency_rating: r.efficiency_rating || "",
        unit_of_measure: r.unit_of_measure || "", quantity_purchased: r.quantity_purchased?.toString() || "",
        unit_price: r.unit_price?.toString() || "", notes: r.notes || "", isEditing: false,
      })));
    }

    setLoading(false);
  }, [contractId, cycleId]);

  useEffect(() => {
    setUser(getUser());
    loadData();
  }, [loadData]);

  void user;

  // ─── Save helpers ────────────────────────────────────────────────────────

  async function saveRecycled(idx: number) {
    const r = recycledRows[idx];
    if (!r.product_name.trim()) { setMsg({ type: "error", text: "Product name is required." }); return; }
    setSaving(true);
    const data = {
      epp_contract_cycle_id: eppCycle!.id,
      product_name: r.product_name.trim(),
      manufacturer: r.manufacturer.trim() || null,
      product_description: r.description.trim() || null,
      unit_of_measure: r.unit_of_measure.trim() || null,
      quantity_purchased: parseFloat(r.quantity_purchased) || null,
      unit_price: parseFloat(r.unit_price) || null,
      total_spend: calcTotalSpend(r.quantity_purchased, r.unit_price) || null,
      recovered_material_content_pct: parseFloat(r.recovered_material_content_pct) || null,
      post_consumer_content_pct: parseFloat(r.post_consumer_content_pct) || null,
      epa_designation: r.epa_designation.trim() || null,
      cpg_item: r.cpg_item.trim() || null,
      notes: r.notes.trim() || null,
    };
    if (r.id) {
      await supabase.from("epp_recycled_content").update({ ...data, updated_at: new Date().toISOString() }).eq("id", r.id);
    } else {
      const { data: ins } = await supabase.from("epp_recycled_content").insert(data).select().single();
      if (ins) {
        const u = [...recycledRows]; u[idx] = { ...u[idx], id: ins.id, isNew: false, isEditing: false };
        setRecycledRows(u); setSaving(false); return;
      }
    }
    const u = [...recycledRows]; u[idx] = { ...u[idx], isNew: false, isEditing: false };
    setRecycledRows(u); setSaving(false);
  }

  async function deleteRecycled(idx: number) {
    const r = recycledRows[idx];
    if (r.id) await supabase.from("epp_recycled_content").delete().eq("id", r.id);
    setRecycledRows(recycledRows.filter((_, i) => i !== idx));
  }

  async function saveEcolabel(idx: number) {
    const r = ecolabelRows[idx];
    if (!r.product_name.trim()) { setMsg({ type: "error", text: "Product name is required." }); return; }
    setSaving(true);
    const data = {
      epp_contract_cycle_id: eppCycle!.id,
      product_name: r.product_name.trim(),
      manufacturer: r.manufacturer.trim() || null,
      ecolabel_name: r.ecolabel_name.trim() || null,
      certification_number: r.certification_number.trim() || null,
      unit_of_measure: r.unit_of_measure.trim() || null,
      quantity_purchased: parseFloat(r.quantity_purchased) || null,
      unit_price: parseFloat(r.unit_price) || null,
      total_spend: calcTotalSpend(r.quantity_purchased, r.unit_price) || null,
      notes: r.notes.trim() || null,
    };
    if (r.id) {
      await supabase.from("epp_ecolabels").update({ ...data, updated_at: new Date().toISOString() }).eq("id", r.id);
    } else {
      const { data: ins } = await supabase.from("epp_ecolabels").insert(data).select().single();
      if (ins) {
        const u = [...ecolabelRows]; u[idx] = { ...u[idx], id: ins.id, isNew: false, isEditing: false };
        setEcolabelRows(u); setSaving(false); return;
      }
    }
    const u = [...ecolabelRows]; u[idx] = { ...u[idx], isNew: false, isEditing: false };
    setEcolabelRows(u); setSaving(false);
  }

  async function deleteEcolabel(idx: number) {
    const r = ecolabelRows[idx];
    if (r.id) await supabase.from("epp_ecolabels").delete().eq("id", r.id);
    setEcolabelRows(ecolabelRows.filter((_, i) => i !== idx));
  }

  async function saveBiobased(idx: number) {
    const r = biobasedRows[idx];
    if (!r.product_name.trim()) { setMsg({ type: "error", text: "Product name is required." }); return; }
    setSaving(true);
    const data = {
      epp_contract_cycle_id: eppCycle!.id,
      product_name: r.product_name.trim(),
      manufacturer: r.manufacturer.trim() || null,
      usda_designation: r.usda_designation.trim() || null,
      biobased_content_pct: parseFloat(r.biobased_content_pct) || null,
      unit_of_measure: r.unit_of_measure.trim() || null,
      quantity_purchased: parseFloat(r.quantity_purchased) || null,
      unit_price: parseFloat(r.unit_price) || null,
      total_spend: calcTotalSpend(r.quantity_purchased, r.unit_price) || null,
      notes: r.notes.trim() || null,
    };
    if (r.id) {
      await supabase.from("epp_biobased").update({ ...data, updated_at: new Date().toISOString() }).eq("id", r.id);
    } else {
      const { data: ins } = await supabase.from("epp_biobased").insert(data).select().single();
      if (ins) {
        const u = [...biobasedRows]; u[idx] = { ...u[idx], id: ins.id, isNew: false, isEditing: false };
        setBiobasedRows(u); setSaving(false); return;
      }
    }
    const u = [...biobasedRows]; u[idx] = { ...u[idx], isNew: false, isEditing: false };
    setBiobasedRows(u); setSaving(false);
  }

  async function deleteBiobased(idx: number) {
    const r = biobasedRows[idx];
    if (r.id) await supabase.from("epp_biobased").delete().eq("id", r.id);
    setBiobasedRows(biobasedRows.filter((_, i) => i !== idx));
  }

  async function saveEnergy(idx: number) {
    const r = energyRows[idx];
    if (!r.product_name.trim()) { setMsg({ type: "error", text: "Product name is required." }); return; }
    setSaving(true);
    const data = {
      epp_contract_cycle_id: eppCycle!.id,
      product_name: r.product_name.trim(),
      manufacturer: r.manufacturer.trim() || null,
      energy_star_certified: r.energy_star_certified,
      femp_designated: r.femp_designated,
      efficiency_rating: r.efficiency_rating.trim() || null,
      unit_of_measure: r.unit_of_measure.trim() || null,
      quantity_purchased: parseFloat(r.quantity_purchased) || null,
      unit_price: parseFloat(r.unit_price) || null,
      total_spend: calcTotalSpend(r.quantity_purchased, r.unit_price) || null,
      notes: r.notes.trim() || null,
    };
    if (r.id) {
      await supabase.from("epp_energy_efficient").update({ ...data, updated_at: new Date().toISOString() }).eq("id", r.id);
    } else {
      const { data: ins } = await supabase.from("epp_energy_efficient").insert(data).select().single();
      if (ins) {
        const u = [...energyRows]; u[idx] = { ...u[idx], id: ins.id, isNew: false, isEditing: false };
        setEnergyRows(u); setSaving(false); return;
      }
    }
    const u = [...energyRows]; u[idx] = { ...u[idx], isNew: false, isEditing: false };
    setEnergyRows(u); setSaving(false);
  }

  async function deleteEnergy(idx: number) {
    const r = energyRows[idx];
    if (r.id) await supabase.from("epp_energy_efficient").delete().eq("id", r.id);
    setEnergyRows(energyRows.filter((_, i) => i !== idx));
  }

  async function saveWater(idx: number) {
    const r = waterRows[idx];
    if (!r.product_name.trim()) { setMsg({ type: "error", text: "Product name is required." }); return; }
    setSaving(true);
    const data = {
      epp_contract_cycle_id: eppCycle!.id,
      product_name: r.product_name.trim(),
      manufacturer: r.manufacturer.trim() || null,
      watersense_certified: r.watersense_certified,
      efficiency_rating: r.efficiency_rating.trim() || null,
      unit_of_measure: r.unit_of_measure.trim() || null,
      quantity_purchased: parseFloat(r.quantity_purchased) || null,
      unit_price: parseFloat(r.unit_price) || null,
      total_spend: calcTotalSpend(r.quantity_purchased, r.unit_price) || null,
      notes: r.notes.trim() || null,
    };
    if (r.id) {
      await supabase.from("epp_water_efficient").update({ ...data, updated_at: new Date().toISOString() }).eq("id", r.id);
    } else {
      const { data: ins } = await supabase.from("epp_water_efficient").insert(data).select().single();
      if (ins) {
        const u = [...waterRows]; u[idx] = { ...u[idx], id: ins.id, isNew: false, isEditing: false };
        setWaterRows(u); setSaving(false); return;
      }
    }
    const u = [...waterRows]; u[idx] = { ...u[idx], isNew: false, isEditing: false };
    setWaterRows(u); setSaving(false);
  }

  async function deleteWater(idx: number) {
    const r = waterRows[idx];
    if (r.id) await supabase.from("epp_water_efficient").delete().eq("id", r.id);
    setWaterRows(waterRows.filter((_, i) => i !== idx));
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function submitForReview() {
    setSubmitting(true);
    const { error } = await supabase
      .from("epp_contract_cycles")
      .update({ epp_status: "ready_for_co_review", updated_at: new Date().toISOString() })
      .eq("id", eppCycle!.id);

    if (error) {
      setMsg({ type: "error", text: "Failed to submit. Please try again." });
    } else {
      setMsg({ type: "success", text: "EPP data submitted successfully for CO review." });
      await loadData();
    }
    setSubmitting(false);
  }

  // ─── Summary calculations ────────────────────────────────────────────────

  function categorySpend(cat: string): { count: number; spend: number } {
    if (cat === "recycled_content") {
      const saved = recycledRows.filter(r => !r.isNew);
      return { count: saved.length, spend: saved.reduce((s, r) => s + calcTotalSpend(r.quantity_purchased, r.unit_price), 0) };
    }
    if (cat === "ecolabel") {
      const saved = ecolabelRows.filter(r => !r.isNew);
      return { count: saved.length, spend: saved.reduce((s, r) => s + calcTotalSpend(r.quantity_purchased, r.unit_price), 0) };
    }
    if (cat === "biobased") {
      const saved = biobasedRows.filter(r => !r.isNew);
      return { count: saved.length, spend: saved.reduce((s, r) => s + calcTotalSpend(r.quantity_purchased, r.unit_price), 0) };
    }
    if (cat === "energy_efficient") {
      const saved = energyRows.filter(r => !r.isNew);
      return { count: saved.length, spend: saved.reduce((s, r) => s + calcTotalSpend(r.quantity_purchased, r.unit_price), 0) };
    }
    if (cat === "water_efficient") {
      const saved = waterRows.filter(r => !r.isNew);
      return { count: saved.length, spend: saved.reduce((s, r) => s + calcTotalSpend(r.quantity_purchased, r.unit_price), 0) };
    }
    return { count: 0, spend: 0 };
  }

  const totalEppSpend = categories.reduce((s, cat) => s + categorySpend(cat).spend, 0);
  const contractSpend = eppCycle?.total_contract_spend ?? 0;
  const eppPct = contractSpend > 0 ? (totalEppSpend / contractSpend) * 100 : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  if (!eppCycle) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      No EPP cycle found for this contract period.
      <br />
      <Link href="/supplier/epp/enter-data" className="btn btn-ghost" style={{ marginTop: 16 }}>Back to Contracts</Link>
    </div>
  );

  // Assign step indices dynamically for progress indicator
  const stepsWithIndex = stepList.map((key, i) => ({
    key,
    index: i,
    label: key === "instructions" ? "Instructions" : key === "summary" ? "Summary" : CATEGORY_LABELS[key] || key,
  }));

  void CATEGORY_STEPS;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href="/supplier/epp/enter-data" style={{ color: "var(--usps-blue)" }}>Enter EPP Data</Link>
        {" / "}{contract?.contract_number} – {cycle?.name}
      </div>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{contract?.contract_number} — {cycle?.name}</h1>
          <p className="page-subtitle">CO: {contract?.contract_officer}</p>
        </div>
        {isReadOnly && (
          <span className="badge badge-green" style={{ fontSize: 14, padding: "6px 14px" }}>Submitted for CO Review</span>
        )}
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {stepsWithIndex.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => setStep(s.index)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", padding: "0 4px", minWidth: 80,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13,
                background: step === s.index ? "var(--usps-blue)" : step > s.index ? "#16a34a" : "#e2e8f0",
                color: step >= s.index ? "#fff" : "#64748b",
              }}>
                {step > s.index ? "✓" : s.index + 1}
              </div>
              <span style={{ fontSize: 10, color: step === s.index ? "var(--usps-blue)" : "#64748b", textAlign: "center", maxWidth: 80 }}>
                {s.label}
              </span>
            </button>
            {i < stepsWithIndex.length - 1 && (
              <div style={{ height: 2, width: 24, background: step > s.index ? "#16a34a" : "#e2e8f0", marginBottom: 20, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* ── Step: Instructions ─────────────────────────────────────────────── */}
      {currentStepKey === "instructions" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">EPP Reporting Instructions</h2>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {eppCycle.supplier_instructions ? (
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>
                {eppCycle.supplier_instructions}
              </div>
            ) : eppCycle.instructions ? (
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>
                {eppCycle.instructions}
              </div>
            ) : (
              <div className="alert alert-info">
                <strong>General Instructions:</strong> Please complete each EPP category section below by entering all
                Environmentally Preferable Products purchased under this contract during the reporting period.
                For each product, provide product name, manufacturer, unit price, and quantity purchased.
                The total spend will be calculated automatically. Submit when all entries are complete.
              </div>
            )}

            <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: 13 }}>Categories enabled for this contract:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {categories.length === 0 ? (
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No categories configured</span>
                ) : categories.map(cat => (
                  <span key={cat} className="badge badge-blue">{CATEGORY_LABELS[cat] || cat}</span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => setStep(1)}>
                Continue to Data Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: Recycled Content ─────────────────────────────────────────── */}
      {currentStepKey === "recycled_content" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recycled Content Products</h2>
            {!isReadOnly && (
              <button className="btn btn-primary btn-sm" onClick={() => setRecycledRows([...recycledRows, emptyRecycled()])}>
                + Add Product
              </button>
            )}
          </div>
          <div style={{ padding: "0 0 4px 0", overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name *</th>
                  <th>Manufacturer</th>
                  <th>Description</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Price ($)</th>
                  <th style={{ background: "#1e293b", color: "#f1f5f9" }}>Total Spend</th>
                  <th>Recovered Mat. %</th>
                  <th>Post-Consumer %</th>
                  <th>EPA Designation</th>
                  <th>CPG Item</th>
                  {!isReadOnly && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {recycledRows.length === 0 ? (
                  <tr><td colSpan={isReadOnly ? 11 : 12} style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)" }}>
                    No products added yet.
                  </td></tr>
                ) : recycledRows.map((r, idx) => (
                  <tr key={idx}>
                    {r.isEditing ? (
                      <>
                        <td><input className="form-input" value={r.product_name} onChange={e => { const u = [...recycledRows]; u[idx].product_name = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input className="form-input" value={r.manufacturer} onChange={e => { const u = [...recycledRows]; u[idx].manufacturer = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input className="form-input" value={r.description} onChange={e => { const u = [...recycledRows]; u[idx].description = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input className="form-input" style={{ width: 80 }} value={r.unit_of_measure} onChange={e => { const u = [...recycledRows]; u[idx].unit_of_measure = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.quantity_purchased} onChange={e => { const u = [...recycledRows]; u[idx].quantity_purchased = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 100 }} value={r.unit_price} onChange={e => { const u = [...recycledRows]; u[idx].unit_price = e.target.value; setRecycledRows(u); }} /></td>
                        <CalcCell qty={r.quantity_purchased} price={r.unit_price} />
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.recovered_material_content_pct} onChange={e => { const u = [...recycledRows]; u[idx].recovered_material_content_pct = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.post_consumer_content_pct} onChange={e => { const u = [...recycledRows]; u[idx].post_consumer_content_pct = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input className="form-input" value={r.epa_designation} onChange={e => { const u = [...recycledRows]; u[idx].epa_designation = e.target.value; setRecycledRows(u); }} /></td>
                        <td><input className="form-input" value={r.cpg_item} onChange={e => { const u = [...recycledRows]; u[idx].cpg_item = e.target.value; setRecycledRows(u); }} /></td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-success btn-sm" onClick={() => saveRecycled(idx)} disabled={saving}>Save</button>
                            {r.isNew && <button className="btn btn-ghost btn-sm" onClick={() => setRecycledRows(recycledRows.filter((_, i) => i !== idx))}>Cancel</button>}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                        <td>{r.manufacturer || "—"}</td>
                        <td>{r.description || "—"}</td>
                        <td>{r.unit_of_measure || "—"}</td>
                        <td>{r.quantity_purchased || "—"}</td>
                        <td>{r.unit_price ? formatCurrency(parseFloat(r.unit_price)) : "—"}</td>
                        <ReadCalcCell value={calcTotalSpend(r.quantity_purchased, r.unit_price)} />
                        <td>{r.recovered_material_content_pct ? `${r.recovered_material_content_pct}%` : "—"}</td>
                        <td>{r.post_consumer_content_pct ? `${r.post_consumer_content_pct}%` : "—"}</td>
                        <td>{r.epa_designation || "—"}</td>
                        <td>{r.cpg_item || "—"}</td>
                        {!isReadOnly && (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { const u = [...recycledRows]; u[idx].isEditing = true; setRecycledRows(u); }}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteRecycled(idx)}>Del</button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)", paddingLeft: 16 }}>
            Columns with dark background are auto-calculated from Qty x Unit Price.
          </div>
        </div>
      )}

      {/* ── Step: Independent Ecolabel ─────────────────────────────────────── */}
      {currentStepKey === "ecolabel" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Independent Ecolabel Products</h2>
            {!isReadOnly && (
              <button className="btn btn-primary btn-sm" onClick={() => setEcolabelRows([...ecolabelRows, emptyEcolabel()])}>
                + Add Product
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name *</th>
                  <th>Manufacturer</th>
                  <th>Ecolabel Name</th>
                  <th>Certification No.</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Price ($)</th>
                  <th style={{ background: "#1e293b", color: "#f1f5f9" }}>Total Spend</th>
                  {!isReadOnly && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {ecolabelRows.length === 0 ? (
                  <tr><td colSpan={isReadOnly ? 8 : 9} style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)" }}>No products added yet.</td></tr>
                ) : ecolabelRows.map((r, idx) => (
                  <tr key={idx}>
                    {r.isEditing ? (
                      <>
                        <td><input className="form-input" value={r.product_name} onChange={e => { const u = [...ecolabelRows]; u[idx].product_name = e.target.value; setEcolabelRows(u); }} /></td>
                        <td><input className="form-input" value={r.manufacturer} onChange={e => { const u = [...ecolabelRows]; u[idx].manufacturer = e.target.value; setEcolabelRows(u); }} /></td>
                        <td><input className="form-input" value={r.ecolabel_name} onChange={e => { const u = [...ecolabelRows]; u[idx].ecolabel_name = e.target.value; setEcolabelRows(u); }} /></td>
                        <td><input className="form-input" value={r.certification_number} onChange={e => { const u = [...ecolabelRows]; u[idx].certification_number = e.target.value; setEcolabelRows(u); }} /></td>
                        <td><input className="form-input" style={{ width: 80 }} value={r.unit_of_measure} onChange={e => { const u = [...ecolabelRows]; u[idx].unit_of_measure = e.target.value; setEcolabelRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.quantity_purchased} onChange={e => { const u = [...ecolabelRows]; u[idx].quantity_purchased = e.target.value; setEcolabelRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 100 }} value={r.unit_price} onChange={e => { const u = [...ecolabelRows]; u[idx].unit_price = e.target.value; setEcolabelRows(u); }} /></td>
                        <CalcCell qty={r.quantity_purchased} price={r.unit_price} />
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-success btn-sm" onClick={() => saveEcolabel(idx)} disabled={saving}>Save</button>
                            {r.isNew && <button className="btn btn-ghost btn-sm" onClick={() => setEcolabelRows(ecolabelRows.filter((_, i) => i !== idx))}>Cancel</button>}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                        <td>{r.manufacturer || "—"}</td>
                        <td>{r.ecolabel_name || "—"}</td>
                        <td>{r.certification_number || "—"}</td>
                        <td>{r.unit_of_measure || "—"}</td>
                        <td>{r.quantity_purchased || "—"}</td>
                        <td>{r.unit_price ? formatCurrency(parseFloat(r.unit_price)) : "—"}</td>
                        <ReadCalcCell value={calcTotalSpend(r.quantity_purchased, r.unit_price)} />
                        {!isReadOnly && (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { const u = [...ecolabelRows]; u[idx].isEditing = true; setEcolabelRows(u); }}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteEcolabel(idx)}>Del</button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 0 4px 16px", fontSize: 11, color: "var(--text-muted)" }}>
            Columns with dark background are auto-calculated from Qty x Unit Price.
          </div>
        </div>
      )}

      {/* ── Step: Bio-Based ────────────────────────────────────────────────── */}
      {currentStepKey === "biobased" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bio-Based Products</h2>
            {!isReadOnly && (
              <button className="btn btn-primary btn-sm" onClick={() => setBiobasedRows([...biobasedRows, emptyBiobased()])}>
                + Add Product
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name *</th>
                  <th>Manufacturer</th>
                  <th>USDA Designation</th>
                  <th>Bio-Based Content %</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Price ($)</th>
                  <th style={{ background: "#1e293b", color: "#f1f5f9" }}>Total Spend</th>
                  {!isReadOnly && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {biobasedRows.length === 0 ? (
                  <tr><td colSpan={isReadOnly ? 8 : 9} style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)" }}>No products added yet.</td></tr>
                ) : biobasedRows.map((r, idx) => (
                  <tr key={idx}>
                    {r.isEditing ? (
                      <>
                        <td><input className="form-input" value={r.product_name} onChange={e => { const u = [...biobasedRows]; u[idx].product_name = e.target.value; setBiobasedRows(u); }} /></td>
                        <td><input className="form-input" value={r.manufacturer} onChange={e => { const u = [...biobasedRows]; u[idx].manufacturer = e.target.value; setBiobasedRows(u); }} /></td>
                        <td><input className="form-input" value={r.usda_designation} onChange={e => { const u = [...biobasedRows]; u[idx].usda_designation = e.target.value; setBiobasedRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.biobased_content_pct} onChange={e => { const u = [...biobasedRows]; u[idx].biobased_content_pct = e.target.value; setBiobasedRows(u); }} /></td>
                        <td><input className="form-input" style={{ width: 80 }} value={r.unit_of_measure} onChange={e => { const u = [...biobasedRows]; u[idx].unit_of_measure = e.target.value; setBiobasedRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.quantity_purchased} onChange={e => { const u = [...biobasedRows]; u[idx].quantity_purchased = e.target.value; setBiobasedRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 100 }} value={r.unit_price} onChange={e => { const u = [...biobasedRows]; u[idx].unit_price = e.target.value; setBiobasedRows(u); }} /></td>
                        <CalcCell qty={r.quantity_purchased} price={r.unit_price} />
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-success btn-sm" onClick={() => saveBiobased(idx)} disabled={saving}>Save</button>
                            {r.isNew && <button className="btn btn-ghost btn-sm" onClick={() => setBiobasedRows(biobasedRows.filter((_, i) => i !== idx))}>Cancel</button>}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                        <td>{r.manufacturer || "—"}</td>
                        <td>{r.usda_designation || "—"}</td>
                        <td>{r.biobased_content_pct ? `${r.biobased_content_pct}%` : "—"}</td>
                        <td>{r.unit_of_measure || "—"}</td>
                        <td>{r.quantity_purchased || "—"}</td>
                        <td>{r.unit_price ? formatCurrency(parseFloat(r.unit_price)) : "—"}</td>
                        <ReadCalcCell value={calcTotalSpend(r.quantity_purchased, r.unit_price)} />
                        {!isReadOnly && (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { const u = [...biobasedRows]; u[idx].isEditing = true; setBiobasedRows(u); }}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteBiobased(idx)}>Del</button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 0 4px 16px", fontSize: 11, color: "var(--text-muted)" }}>
            Columns with dark background are auto-calculated from Qty x Unit Price.
          </div>
        </div>
      )}

      {/* ── Step: Energy Efficient ─────────────────────────────────────────── */}
      {currentStepKey === "energy_efficient" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Energy Efficient Products</h2>
            {!isReadOnly && (
              <button className="btn btn-primary btn-sm" onClick={() => setEnergyRows([...energyRows, emptyEnergy()])}>
                + Add Product
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name *</th>
                  <th>Manufacturer</th>
                  <th>ENERGY STAR</th>
                  <th>FEMP Designated</th>
                  <th>Efficiency Rating</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Price ($)</th>
                  <th style={{ background: "#1e293b", color: "#f1f5f9" }}>Total Spend</th>
                  {!isReadOnly && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {energyRows.length === 0 ? (
                  <tr><td colSpan={isReadOnly ? 9 : 10} style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)" }}>No products added yet.</td></tr>
                ) : energyRows.map((r, idx) => (
                  <tr key={idx}>
                    {r.isEditing ? (
                      <>
                        <td><input className="form-input" value={r.product_name} onChange={e => { const u = [...energyRows]; u[idx].product_name = e.target.value; setEnergyRows(u); }} /></td>
                        <td><input className="form-input" value={r.manufacturer} onChange={e => { const u = [...energyRows]; u[idx].manufacturer = e.target.value; setEnergyRows(u); }} /></td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={r.energy_star_certified} onChange={e => { const u = [...energyRows]; u[idx].energy_star_certified = e.target.checked; setEnergyRows(u); }} />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={r.femp_designated} onChange={e => { const u = [...energyRows]; u[idx].femp_designated = e.target.checked; setEnergyRows(u); }} />
                        </td>
                        <td><input className="form-input" value={r.efficiency_rating} onChange={e => { const u = [...energyRows]; u[idx].efficiency_rating = e.target.value; setEnergyRows(u); }} /></td>
                        <td><input className="form-input" style={{ width: 80 }} value={r.unit_of_measure} onChange={e => { const u = [...energyRows]; u[idx].unit_of_measure = e.target.value; setEnergyRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.quantity_purchased} onChange={e => { const u = [...energyRows]; u[idx].quantity_purchased = e.target.value; setEnergyRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 100 }} value={r.unit_price} onChange={e => { const u = [...energyRows]; u[idx].unit_price = e.target.value; setEnergyRows(u); }} /></td>
                        <CalcCell qty={r.quantity_purchased} price={r.unit_price} />
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-success btn-sm" onClick={() => saveEnergy(idx)} disabled={saving}>Save</button>
                            {r.isNew && <button className="btn btn-ghost btn-sm" onClick={() => setEnergyRows(energyRows.filter((_, i) => i !== idx))}>Cancel</button>}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                        <td>{r.manufacturer || "—"}</td>
                        <td style={{ textAlign: "center" }}>{r.energy_star_certified ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                        <td style={{ textAlign: "center" }}>{r.femp_designated ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                        <td>{r.efficiency_rating || "—"}</td>
                        <td>{r.unit_of_measure || "—"}</td>
                        <td>{r.quantity_purchased || "—"}</td>
                        <td>{r.unit_price ? formatCurrency(parseFloat(r.unit_price)) : "—"}</td>
                        <ReadCalcCell value={calcTotalSpend(r.quantity_purchased, r.unit_price)} />
                        {!isReadOnly && (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { const u = [...energyRows]; u[idx].isEditing = true; setEnergyRows(u); }}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteEnergy(idx)}>Del</button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 0 4px 16px", fontSize: 11, color: "var(--text-muted)" }}>
            Columns with dark background are auto-calculated from Qty x Unit Price.
          </div>
        </div>
      )}

      {/* ── Step: Water Efficient ──────────────────────────────────────────── */}
      {currentStepKey === "water_efficient" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Water Efficient Products</h2>
            {!isReadOnly && (
              <button className="btn btn-primary btn-sm" onClick={() => setWaterRows([...waterRows, emptyWater()])}>
                + Add Product
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name *</th>
                  <th>Manufacturer</th>
                  <th>WaterSense Certified</th>
                  <th>Efficiency Rating</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Price ($)</th>
                  <th style={{ background: "#1e293b", color: "#f1f5f9" }}>Total Spend</th>
                  {!isReadOnly && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {waterRows.length === 0 ? (
                  <tr><td colSpan={isReadOnly ? 8 : 9} style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)" }}>No products added yet.</td></tr>
                ) : waterRows.map((r, idx) => (
                  <tr key={idx}>
                    {r.isEditing ? (
                      <>
                        <td><input className="form-input" value={r.product_name} onChange={e => { const u = [...waterRows]; u[idx].product_name = e.target.value; setWaterRows(u); }} /></td>
                        <td><input className="form-input" value={r.manufacturer} onChange={e => { const u = [...waterRows]; u[idx].manufacturer = e.target.value; setWaterRows(u); }} /></td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={r.watersense_certified} onChange={e => { const u = [...waterRows]; u[idx].watersense_certified = e.target.checked; setWaterRows(u); }} />
                        </td>
                        <td><input className="form-input" value={r.efficiency_rating} onChange={e => { const u = [...waterRows]; u[idx].efficiency_rating = e.target.value; setWaterRows(u); }} /></td>
                        <td><input className="form-input" style={{ width: 80 }} value={r.unit_of_measure} onChange={e => { const u = [...waterRows]; u[idx].unit_of_measure = e.target.value; setWaterRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 80 }} value={r.quantity_purchased} onChange={e => { const u = [...waterRows]; u[idx].quantity_purchased = e.target.value; setWaterRows(u); }} /></td>
                        <td><input type="number" className="form-input" style={{ width: 100 }} value={r.unit_price} onChange={e => { const u = [...waterRows]; u[idx].unit_price = e.target.value; setWaterRows(u); }} /></td>
                        <CalcCell qty={r.quantity_purchased} price={r.unit_price} />
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-success btn-sm" onClick={() => saveWater(idx)} disabled={saving}>Save</button>
                            {r.isNew && <button className="btn btn-ghost btn-sm" onClick={() => setWaterRows(waterRows.filter((_, i) => i !== idx))}>Cancel</button>}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                        <td>{r.manufacturer || "—"}</td>
                        <td style={{ textAlign: "center" }}>{r.watersense_certified ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                        <td>{r.efficiency_rating || "—"}</td>
                        <td>{r.unit_of_measure || "—"}</td>
                        <td>{r.quantity_purchased || "—"}</td>
                        <td>{r.unit_price ? formatCurrency(parseFloat(r.unit_price)) : "—"}</td>
                        <ReadCalcCell value={calcTotalSpend(r.quantity_purchased, r.unit_price)} />
                        {!isReadOnly && (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { const u = [...waterRows]; u[idx].isEditing = true; setWaterRows(u); }}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteWater(idx)}>Del</button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 0 4px 16px", fontSize: 11, color: "var(--text-muted)" }}>
            Columns with dark background are auto-calculated from Qty x Unit Price.
          </div>
        </div>
      )}

      {/* ── Step: Summary ─────────────────────────────────────────────────── */}
      {currentStepKey === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">EPP Summary Report</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Products Count</th>
                    <th>Total Spend</th>
                    <th>% of Contract Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)" }}>No categories configured.</td></tr>
                  ) : categories.map(cat => {
                    const { count, spend } = categorySpend(cat);
                    const pct = contractSpend > 0 ? (spend / contractSpend) * 100 : null;
                    return (
                      <tr key={cat}>
                        <td style={{ fontWeight: 500 }}>{CATEGORY_LABELS[cat] || cat}</td>
                        <td>{count}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(spend)}</td>
                        <td>{pct !== null ? `${pct.toFixed(2)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ fontWeight: 700, padding: "10px 14px" }}>Total EPP Spend</td>
                    <td style={{ fontWeight: 700, padding: "10px 14px" }}>
                      {categories.reduce((s, cat) => s + categorySpend(cat).count, 0)}
                    </td>
                    <td style={{ fontWeight: 700, padding: "10px 14px" }}>{formatCurrency(totalEppSpend)}</td>
                    <td style={{ fontWeight: 700, padding: "10px 14px" }}>
                      {eppPct !== null ? `${eppPct.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Contract spend note */}
          <div className="alert alert-info">
            <strong>Total Contract Spend:</strong>{" "}
            {contractSpend > 0 ? formatCurrency(contractSpend) : "Not set — contact your CO to configure the total contract spend."}{" "}
            {eppPct !== null && (
              <>EPP percentage is calculated as total EPP spend ({formatCurrency(totalEppSpend)}) divided by total contract spend ({formatCurrency(contractSpend)}).</>
            )}
          </div>

          {/* Submit */}
          {!isReadOnly ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-success"
                onClick={submitForReview}
                disabled={submitting || categories.every(cat => categorySpend(cat).count === 0)}
              >
                {submitting ? "Submitting…" : "Submit EPP Data for CO Review"}
              </button>
            </div>
          ) : (
            <div className="alert alert-success">
              EPP data has been submitted for CO review. No further edits are allowed.
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/supplier/epp/enter-data" className="btn btn-ghost">
            Back to Contracts
          </Link>
          {step > 0 && (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)}>
              Previous
            </button>
          )}
        </div>
        {step < totalSteps - 1 && (
          <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>
            {step === 0 ? "Continue" : "Next Step"}
          </button>
        )}
      </div>
    </div>
  );
}
