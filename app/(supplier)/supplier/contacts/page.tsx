"use client";
import { useEffect, useState } from "react";
import { supabase, getUser } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface Contact {
  id?: string;
  supplier_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  is_primary: boolean;
  contact_type: string;
}

const CONTACT_TYPES = ["Primary", "Billing", "Technical", "Legal", "Sales", "Operations", "Other"];

export default function SupplierContacts() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.supplier_id) loadContacts(u.supplier_id);
    else setLoading(false);
  }, []);

  async function loadContacts(supplierId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("supplier_contacts")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("is_primary", { ascending: false });
    setContacts(data || []);
    setLoading(false);
  }

  function startNew() {
    setForm({ contact_type: "Primary", is_primary: false, name: "", title: "", email: "", phone: "" });
    setEditingId("new");
    setMsg(null);
  }

  function startEdit(c: Contact) {
    setForm({ ...c });
    setEditingId(c.id || null);
    setMsg(null);
  }

  async function saveContact() {
    if (!user?.supplier_id) return;
    if (!form.name?.trim() || !form.email?.trim()) {
      setMsg({ type: "error", text: "Name and email are required." });
      return;
    }
    setSaving(true);
    setMsg(null);

    if (editingId === "new") {
      const { error } = await supabase.from("supplier_contacts").insert({
        supplier_id: user.supplier_id,
        name: form.name.trim(),
        title: form.title?.trim() || null,
        email: form.email.trim(),
        phone: form.phone?.trim() || null,
        is_primary: form.is_primary || false,
        contact_type: form.contact_type || "Other",
      });
      if (error) setMsg({ type: "error", text: "Failed to add contact." });
      else { setMsg({ type: "success", text: "Contact added." }); setEditingId(null); await loadContacts(user.supplier_id); }
    } else if (editingId) {
      const { error } = await supabase.from("supplier_contacts").update({
        name: form.name!.trim(),
        title: form.title?.trim() || null,
        email: form.email!.trim(),
        phone: form.phone?.trim() || null,
        is_primary: form.is_primary || false,
        contact_type: form.contact_type || "Other",
        updated_at: new Date().toISOString(),
      }).eq("id", editingId);
      if (error) setMsg({ type: "error", text: "Failed to update contact." });
      else { setMsg({ type: "success", text: "Contact updated." }); setEditingId(null); await loadContacts(user.supplier_id); }
    }
    setSaving(false);
  }

  async function deleteContact(id: string) {
    if (!confirm("Delete this contact?")) return;
    await supabase.from("supplier_contacts").delete().eq("id", id);
    if (user?.supplier_id) await loadContacts(user.supplier_id);
  }

  void user;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage your organization's contact people for USPS communications</p>
        </div>
        {editingId !== "new" && (
          <button className="btn btn-primary" onClick={startNew}>+ Add Contact</button>
        )}
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {editingId === "new" && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--usps-blue)" }}>
          <div className="card-header" style={{ background: "var(--usps-blue-light)" }}>
            <h2 className="card-title">New Contact</h2>
          </div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="form-label">Title / Role</label>
              <input className="form-input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="VP Compliance" />
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="555-000-0000" />
            </div>
            <div>
              <label className="form-label">Contact Type</label>
              <select className="form-select" value={form.contact_type || "Other"} onChange={e => setForm({ ...form, contact_type: e.target.value })}>
                {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 24 }}>
              <input type="checkbox" id="is_primary" checked={!!form.is_primary} onChange={e => setForm({ ...form, is_primary: e.target.checked })} />
              <label htmlFor="is_primary" style={{ cursor: "pointer", fontSize: 13 }}>Primary contact for USPS communications</label>
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveContact} disabled={saving}>{saving ? "Saving…" : "Add Contact"}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
            No contacts added yet. Click &quot;Add Contact&quot; to add your first contact.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contacts.map(c => (
            <div key={c.id} className="card">
              {editingId === c.id ? (
                <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Title / Role</label>
                    <input className="form-input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Contact Type</label>
                    <select className="form-select" value={form.contact_type || "Other"} onChange={e => setForm({ ...form, contact_type: e.target.value })}>
                      {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 24 }}>
                    <input type="checkbox" checked={!!form.is_primary} onChange={e => setForm({ ...form, is_primary: e.target.checked })} />
                    <label style={{ cursor: "pointer", fontSize: 13 }}>Primary contact</label>
                  </div>
                  <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn btn-success" onClick={saveContact} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              ) : (
                <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                        {c.is_primary && <span className="badge badge-blue">Primary</span>}
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>{c.contact_type}</span>
                      </div>
                      {c.title && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{c.title}</div>}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <div><a href={`mailto:${c.email}`} style={{ color: "var(--usps-blue)" }}>{c.email}</a></div>
                      {c.phone && <div style={{ marginTop: 2, color: "var(--text-muted)" }}>{c.phone}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteContact(c.id!)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
