"use client";
import { useEffect, useState } from "react";
import { supabase, getUser } from "@/lib/supabase";
import type { User } from "@/lib/types";

const BUSINESS_TYPES = [
  "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Non-Profit", "Government", "Other"
];

const DIVERSITY_CLASSIFICATIONS = [
  "Small Business", "Minority-Owned", "Women-Owned", "Veteran-Owned",
  "Service-Disabled Veteran", "HUBZone", "Large Business",
];

const NAICS_COMMON = [
  "236220 - Commercial Building Construction",
  "423430 - Computer & Peripheral Equipment",
  "511210 - Software Publishers",
  "541511 - Custom Computer Programming",
  "541512 - Computer Systems Design",
  "541611 - Management Consulting",
  "561210 - Facilities Support Services",
  "562111 - Solid Waste Collection",
  "611430 - Professional Training",
  "999999 - Other",
];

interface SupplierProfile {
  id: string;
  name: string;
  apex_number?: string;
  duns_number?: string;
  cage_code?: string;
  ein?: string;
  business_type?: string;
  naics_codes?: string[];
  diversity_classifications?: string[];
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  website?: string;
  description?: string;
  is_active: boolean;
}

export default function SupplierProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [form, setForm] = useState<Partial<SupplierProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.supplier_id) loadProfile(u.supplier_id);
    else setLoading(false);
  }, []);

  async function loadProfile(supplierId: string) {
    setLoading(true);
    const { data } = await supabase.from("suppliers").select("*").eq("id", supplierId).single();
    if (data) {
      setProfile(data as SupplierProfile);
      setForm(data as SupplierProfile);
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile?.id) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("suppliers").update({
      name: form.name,
      apex_number: form.apex_number || null,
      duns_number: form.duns_number || null,
      cage_code: form.cage_code || null,
      ein: form.ein || null,
      business_type: form.business_type || null,
      naics_codes: form.naics_codes || [],
      diversity_classifications: form.diversity_classifications || [],
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      country: form.country || "USA",
      phone: form.phone || null,
      website: form.website || null,
      description: form.description || null,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);

    if (error) {
      setMsg({ type: "error", text: "Failed to save profile. Please try again." });
    } else {
      setMsg({ type: "success", text: "Profile updated successfully." });
      setEditing(false);
      await loadProfile(profile.id);
    }
    setSaving(false);
  }

  function toggleClassification(c: string) {
    const current = form.diversity_classifications || [];
    if (current.includes(c)) setForm({ ...form, diversity_classifications: current.filter(x => x !== c) });
    else setForm({ ...form, diversity_classifications: [...current, c] });
  }

  function toggleNaics(c: string) {
    const current = form.naics_codes || [];
    if (current.includes(c)) setForm({ ...form, naics_codes: current.filter(x => x !== c) });
    else setForm({ ...form, naics_codes: [...current, c] });
  }

  void user;

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading profile…</div>;

  if (!profile) return (
    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
      No supplier profile found. Contact your administrator.
    </div>
  );

  const readonlyField = (label: string, value?: string | null) => (
    <div key={label}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <div style={{ fontWeight: 500, marginTop: 2 }}>{value || "—"}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Profile</h1>
          <p className="page-subtitle">Your organization information as registered with USPS SIMS</p>
        </div>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit Profile</button>
        )}
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic Info */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Basic Information</h2></div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Business Type</label>
                <select className="form-select" value={form.business_type || ""} onChange={e => setForm({ ...form, business_type: e.target.value })}>
                  <option value="">— Select —</option>
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">APEX Number</label>
                <input className="form-input" value={form.apex_number || ""} onChange={e => setForm({ ...form, apex_number: e.target.value })} />
              </div>
              <div>
                <label className="form-label">DUNS Number</label>
                <input className="form-input" value={form.duns_number || ""} onChange={e => setForm({ ...form, duns_number: e.target.value })} />
              </div>
              <div>
                <label className="form-label">CAGE Code</label>
                <input className="form-input" value={form.cage_code || ""} onChange={e => setForm({ ...form, cage_code: e.target.value })} />
              </div>
              <div>
                <label className="form-label">EIN</label>
                <input className="form-input" value={form.ein || ""} onChange={e => setForm({ ...form, ein: e.target.value })} placeholder="XX-XXXXXXX" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website || ""} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="form-label">Company Description</label>
                <textarea className="form-textarea" rows={3} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Address</h2></div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="form-label">Address Line 1</label>
                <input className="form-input" value={form.address_line1 || ""} onChange={e => setForm({ ...form, address_line1: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="form-label">Address Line 2</label>
                <input className="form-input" value={form.address_line2 || ""} onChange={e => setForm({ ...form, address_line2: e.target.value })} />
              </div>
              <div>
                <label className="form-label">City</label>
                <input className="form-input" value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="form-label">State</label>
                <input className="form-input" value={form.state || ""} onChange={e => setForm({ ...form, state: e.target.value })} maxLength={2} placeholder="TX" />
              </div>
              <div>
                <label className="form-label">ZIP Code</label>
                <input className="form-input" value={form.zip || ""} onChange={e => setForm({ ...form, zip: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Country</label>
                <input className="form-input" value={form.country || "USA"} onChange={e => setForm({ ...form, country: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Classifications */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Diversity Classifications</h2></div>
            <div className="card-body">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DIVERSITY_CLASSIFICATIONS.map(c => (
                  <label key={c} style={{
                    display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                    padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                    border: `2px solid ${(form.diversity_classifications || []).includes(c) ? "var(--usps-blue)" : "var(--border)"}`,
                    background: (form.diversity_classifications || []).includes(c) ? "var(--usps-blue-light)" : "transparent",
                  }}>
                    <input type="checkbox" checked={(form.diversity_classifications || []).includes(c)} onChange={() => toggleClassification(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* NAICS */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">NAICS Codes</h2></div>
            <div className="card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {NAICS_COMMON.map(c => (
                  <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={(form.naics_codes || []).includes(c)} onChange={() => toggleNaics(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setForm(profile); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? "Saving…" : "Save Profile"}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header"><h2 className="card-title">Basic Information</h2></div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {readonlyField("Company Name", profile.name)}
              {readonlyField("Business Type", profile.business_type)}
              {readonlyField("APEX Number", profile.apex_number)}
              {readonlyField("DUNS Number", profile.duns_number)}
              {readonlyField("CAGE Code", profile.cage_code)}
              {readonlyField("EIN", profile.ein)}
              {readonlyField("Phone", profile.phone)}
              {readonlyField("Website", profile.website)}
              {profile.description && (
                <div style={{ gridColumn: "1/-1" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</span>
                  <div style={{ marginTop: 4, lineHeight: 1.6 }}>{profile.description}</div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="card-title">Address</h2></div>
            <div className="card-body">
              <div style={{ lineHeight: 1.8 }}>
                {profile.address_line1 || "—"}<br />
                {profile.address_line2 && <>{profile.address_line2}<br /></>}
                {[profile.city, profile.state, profile.zip].filter(Boolean).join(", ")}<br />
                {profile.country || "USA"}
              </div>
            </div>
          </div>

          {(profile.diversity_classifications?.length || 0) > 0 && (
            <div className="card">
              <div className="card-header"><h2 className="card-title">Diversity Classifications</h2></div>
              <div className="card-body">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(profile.diversity_classifications || []).map(c => (
                    <span key={c} className="badge badge-blue">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(profile.naics_codes?.length || 0) > 0 && (
            <div className="card">
              <div className="card-header"><h2 className="card-title">NAICS Codes</h2></div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(profile.naics_codes || []).map(c => (
                    <span key={c} style={{ fontSize: 13 }}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
