"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, getUser } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  category: string | null;
  label: string | null;
  description: string | null;
}

interface MenuSetting {
  id: string;
  menu_key: string;
  label: string;
  url: string | null;
  parent_key: string | null;
  sort_order: number;
  is_active: boolean;
  required_permission: string | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_active: boolean;
}

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  page_type: string | null;
  is_active: boolean;
  sort_order: number;
}

interface MetricLibrary {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  default_target: string | null;
  is_active: boolean;
}

interface SupplierQuestion {
  id: string;
  section: string | null;
  question_text: string;
  field_type: string | null;
  options: unknown;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS = [
  "System Settings",
  "Menu Settings",
  "Categories",
  "Email Templates",
  "Content Pages",
  "Metric Library",
  "Supplier Questions",
] as const;

type Tab = (typeof TABS)[number];

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item) || "General";
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "10px",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "20px",
              color: "var(--text-muted)",
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── System Settings Tab ──────────────────────────────────────────────────────

function SystemSettingsTab() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_settings")
      .select("*")
      .order("category")
      .order("label");
    if (data) {
      setSettings(data as SystemSetting[]);
      const vals: Record<string, string> = {};
      (data as SystemSetting[]).forEach((s) => {
        vals[s.id] = s.setting_value ?? "";
      });
      setEditValues(vals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSetting(setting: SystemSetting) {
    setSaving(setting.id);
    const user = getUser();
    await supabase
      .from("system_settings")
      .update({
        setting_value: editValues[setting.id],
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", setting.id);
    setSaving(null);
    setToast("Saved");
    setTimeout(() => setToast(""), 2000);
  }

  const groups = groupBy(settings, (s) => s.category ?? "General");

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div>
      {toast && (
        <div className="alert alert-success" style={{ marginBottom: "16px" }}>
          {toast}
        </div>
      )}
      {Object.entries(groups).map(([category, items]) => (
        <div key={category} style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "10px",
              paddingBottom: "6px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {category}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Setting</th>
                <th style={{ width: "40%" }}>Value</th>
                <th style={{ width: "20%" }}>Description</th>
                <th style={{ width: "10%" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.label || s.setting_key}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {s.setting_key}
                    </div>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      value={editValues[s.id] ?? ""}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                      style={{ fontSize: "13px" }}
                    />
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {s.description}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveSetting(s)}
                      disabled={saving === s.id}
                    >
                      {saving === s.id ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {settings.length === 0 && (
        <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>
          No system settings found.
        </div>
      )}
    </div>
  );
}

// ─── Menu Settings Tab ────────────────────────────────────────────────────────

const EMPTY_MENU: Omit<MenuSetting, "id"> = {
  menu_key: "",
  label: "",
  url: "",
  parent_key: "",
  sort_order: 0,
  is_active: true,
  required_permission: "",
};

function MenuSettingsTab() {
  const [items, setItems] = useState<MenuSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<MenuSetting>>(EMPTY_MENU);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("menu_settings")
      .select("*")
      .order("sort_order");
    if (data) setItems(data as MenuSetting[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_MENU });
    setError("");
    setModal("add");
  }

  function openEdit(item: MenuSetting) {
    setForm({ ...item });
    setError("");
    setModal("edit");
  }

  async function save() {
    if (!form.menu_key?.trim() || !form.label?.trim()) {
      setError("Menu key and label are required.");
      return;
    }
    setSaving(true);
    setError("");
    if (modal === "add") {
      const { error: err } = await supabase.from("menu_settings").insert({
        menu_key: form.menu_key,
        label: form.label,
        url: form.url || null,
        parent_key: form.parent_key || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active ?? true,
        required_permission: form.required_permission || null,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("menu_settings")
        .update({
          menu_key: form.menu_key,
          label: form.label,
          url: form.url || null,
          parent_key: form.parent_key || null,
          sort_order: Number(form.sort_order) || 0,
          is_active: form.is_active ?? true,
          required_permission: form.required_permission || null,
        })
        .eq("id", form.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this menu item?")) return;
    await supabase.from("menu_settings").delete().eq("id", id);
    load();
  }

  async function moveOrder(item: MenuSetting, dir: -1 | 1) {
    const peers = items.filter((i) => i.parent_key === item.parent_key);
    const idx = peers.findIndex((i) => i.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= peers.length) return;
    const swap = peers[swapIdx];
    await supabase
      .from("menu_settings")
      .update({ sort_order: swap.sort_order })
      .eq("id", item.id);
    await supabase
      .from("menu_settings")
      .update({ sort_order: item.sort_order })
      .eq("id", swap.id);
    load();
  }

  // Build tree
  const roots = items.filter((i) => !i.parent_key);
  const childrenOf = (key: string) => items.filter((i) => i.parent_key === key);

  function renderRow(item: MenuSetting, depth: number) {
    return (
      <tr key={item.id}>
        <td>
          <span
            style={{
              paddingLeft: `${depth * 20}px`,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {depth > 0 && (
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                └
              </span>
            )}
            <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>
              {item.label}
            </span>
          </span>
        </td>
        <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{item.menu_key}</td>
        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.url}</td>
        <td>
          <span className={`badge ${item.is_active ? "badge-green" : "badge-gray"}`}>
            {item.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveOrder(item, -1)}
              title="Move up"
            >
              ↑
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveOrder(item, 1)}
              title="Move down"
            >
              ↓
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => openEdit(item)}
            >
              Edit
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => deleteItem(item.id)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function renderTree(rootItems: MenuSetting[], depth: number): React.ReactNode[] {
    return rootItems.flatMap((item) => [
      renderRow(item, depth),
      ...renderTree(childrenOf(item.menu_key), depth + 1),
    ]);
  }

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ fontSize: "16px" }}>Menu Items</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add Menu Item
        </button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Key</th>
              <th>URL</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {renderTree(roots, 0)}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No menu items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Add Menu Item" : "Edit Menu Item"}
          onClose={() => setModal(null)}
        >
          {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label">Menu Key *</label>
              <input
                className="form-input"
                value={form.menu_key ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, menu_key: e.target.value }))}
                placeholder="e.g. suppliers.list"
              />
            </div>
            <div>
              <label className="form-label">Label *</label>
              <input
                className="form-input"
                value={form.label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Display label"
              />
            </div>
            <div>
              <label className="form-label">URL</label>
              <input
                className="form-input"
                value={form.url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="/suppliers"
              />
            </div>
            <div>
              <label className="form-label">Parent Key</label>
              <select
                className="form-select"
                value={form.parent_key ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, parent_key: e.target.value || null }))}
              >
                <option value="">— Top-level —</option>
                {items
                  .filter((i) => i.id !== form.id)
                  .map((i) => (
                    <option key={i.id} value={i.menu_key}>
                      {i.label} ({i.menu_key})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sort Order</label>
              <input
                className="form-input"
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label">Required Permission</label>
              <input
                className="form-input"
                value={form.required_permission ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, required_permission: e.target.value || null }))}
                placeholder="e.g. supplier.list_access"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="menu-active"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <label htmlFor="menu-active" style={{ fontSize: "13px", fontWeight: 600 }}>
                Active
              </label>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

const EMPTY_CAT: Omit<Category, "id"> = {
  name: "",
  description: "",
  parent_id: null,
  is_active: true,
  sort_order: 0,
};

function CategoriesTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<Category>>(EMPTY_CAT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    if (data) setCats(data as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(parentId?: string) {
    setForm({ ...EMPTY_CAT, parent_id: parentId ?? null });
    setError("");
    setModal("add");
  }

  function openEdit(cat: Category) {
    setForm({ ...cat });
    setError("");
    setModal("edit");
  }

  async function save() {
    if (!form.name?.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    setError("");
    if (modal === "add") {
      const { error: err } = await supabase.from("categories").insert({
        name: form.name,
        description: form.description || null,
        parent_id: form.parent_id || null,
        is_active: form.is_active ?? true,
        sort_order: Number(form.sort_order) || 0,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("categories")
        .update({
          name: form.name,
          description: form.description || null,
          parent_id: form.parent_id || null,
          is_active: form.is_active ?? true,
          sort_order: Number(form.sort_order) || 0,
        })
        .eq("id", form.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function deleteCat(id: string) {
    if (!confirm("Delete this category? Child categories will become top-level.")) return;
    await supabase.from("categories").delete().eq("id", id);
    load();
  }

  const roots = cats.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => cats.filter((c) => c.parent_id === pid);

  function renderCatRow(cat: Category, depth: number): React.ReactNode[] {
    return [
      <tr key={cat.id}>
        <td>
          <span style={{ paddingLeft: `${depth * 20}px`, display: "flex", alignItems: "center", gap: "6px" }}>
            {depth > 0 && <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>└</span>}
            <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>{cat.name}</span>
          </span>
        </td>
        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{cat.description}</td>
        <td>
          <span className={`badge ${cat.is_active ? "badge-green" : "badge-gray"}`}>
            {cat.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div style={{ display: "flex", gap: "4px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => openAdd(cat.id)}>
              + Child
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(cat)}>
              Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => deleteCat(cat.id)}>
              Delete
            </button>
          </div>
        </td>
      </tr>,
      ...childrenOf(cat.id).flatMap((child) => renderCatRow(child, depth + 1)),
    ];
  }

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ fontSize: "16px" }}>Categories</div>
        <button className="btn btn-primary" onClick={() => openAdd()}>
          + Add Category
        </button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roots.flatMap((c) => renderCatRow(c, 0))}
            {cats.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Add Category" : "Edit Category"}
          onClose={() => setModal(null)}
        >
          {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <label className="form-label">Parent Category</label>
              <select
                className="form-select"
                value={form.parent_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value || null }))}
              >
                <option value="">— Top-level —</option>
                {cats
                  .filter((c) => c.id !== form.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sort Order</label>
              <input
                className="form-input"
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="cat-active"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <label htmlFor="cat-active" style={{ fontSize: "13px", fontWeight: 600 }}>
                Active
              </label>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Email Templates Tab ──────────────────────────────────────────────────────

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("name");
    if (data) setTemplates(data as EmailTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openTemplate(tpl: EmailTemplate) {
    setSelected(tpl);
    setEditSubject(tpl.subject);
    setEditBody(tpl.body_html);
    setEditActive(tpl.is_active);
  }

  async function saveTemplate() {
    if (!selected) return;
    setSaving(true);
    const user = getUser();
    await supabase
      .from("email_templates")
      .update({
        subject: editSubject,
        body_html: editBody,
        is_active: editActive,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);
    setSaving(false);
    setToast("Template saved");
    setTimeout(() => setToast(""), 2500);
    load();
  }

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", height: "70vh" }}>
      {/* List panel */}
      <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "12px 16px",
            fontWeight: 700,
            fontSize: "13px",
            borderBottom: "1px solid var(--border)",
            background: "#f8fafc",
          }}
        >
          Templates ({templates.length})
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => openTemplate(tpl)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: "1px solid #f1f5f9",
                background: selected?.id === tpl.id ? "var(--usps-blue-light)" : "transparent",
                transition: "background 0.1s",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "13px", color: selected?.id === tpl.id ? "var(--usps-blue)" : "var(--text)" }}>
                {tpl.name}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "monospace" }}>
                {tpl.template_key}
              </div>
              <div style={{ marginTop: "4px" }}>
                <span className={`badge ${tpl.is_active ? "badge-green" : "badge-gray"}`}>
                  {tpl.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No templates found.
            </div>
          )}
        </div>
      </div>

      {/* Edit panel */}
      <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {selected ? (
          <>
            <div
              className="card-header"
              style={{ flexShrink: 0 }}
            >
              <div>
                <div className="card-title">{selected.name}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {selected.template_key}
                </div>
                {selected.variables.length > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Variables:{" "}
                    {selected.variables.map((v) => (
                      <code
                        key={v}
                        style={{
                          background: "#f1f5f9",
                          borderRadius: "4px",
                          padding: "1px 5px",
                          marginRight: "4px",
                          fontSize: "11px",
                        }}
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  Active
                </label>
                {toast && <span style={{ fontSize: "12px", color: "var(--success)", fontWeight: 600 }}>{toast}</span>}
                <button className="btn btn-primary btn-sm" onClick={saveTemplate} disabled={saving}>
                  {saving ? "Saving…" : "Save Template"}
                </button>
              </div>
            </div>
            <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="form-label">Subject *</label>
                <input
                  className="form-input"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label className="form-label">Body (HTML)</label>
                <textarea
                  className="form-textarea"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  style={{ flex: 1, minHeight: "300px", fontFamily: "monospace", fontSize: "12px" }}
                />
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: "14px",
            }}
          >
            Select a template to edit
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Content Pages Tab ────────────────────────────────────────────────────────

const PAGE_TYPES = ["internal", "user_guide", "policy", "help"] as const;

const EMPTY_PAGE = {
  title: "",
  slug: "",
  content: "",
  page_type: "internal" as string,
  is_active: true,
  sort_order: 0,
};

function ContentPagesTab() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<ContentPage>>(EMPTY_PAGE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("content_pages")
      .select("*")
      .order("sort_order")
      .order("title");
    if (data) setPages(data as ContentPage[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_PAGE });
    setError("");
    setModal("add");
  }

  function openEdit(page: ContentPage) {
    setForm({ ...page });
    setError("");
    setModal("edit");
  }

  async function save() {
    if (!form.title?.trim() || !form.slug?.trim()) {
      setError("Title and slug are required.");
      return;
    }
    setSaving(true);
    setError("");
    const user = getUser();
    const now = new Date().toISOString();
    if (modal === "add") {
      const { error: err } = await supabase.from("content_pages").insert({
        title: form.title,
        slug: form.slug,
        content: form.content || null,
        page_type: form.page_type || null,
        is_active: form.is_active ?? true,
        sort_order: Number(form.sort_order) || 0,
        created_by: user?.id,
        updated_by: user?.id,
        updated_at: now,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("content_pages")
        .update({
          title: form.title,
          slug: form.slug,
          content: form.content || null,
          page_type: form.page_type || null,
          is_active: form.is_active ?? true,
          sort_order: Number(form.sort_order) || 0,
          updated_by: user?.id,
          updated_at: now,
        })
        .eq("id", form.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function deletePage(id: string) {
    if (!confirm("Delete this content page?")) return;
    await supabase.from("content_pages").delete().eq("id", id);
    load();
  }

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ fontSize: "16px" }}>Content Pages</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Page</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.title}</td>
                <td style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)" }}>
                  /{p.slug}
                </td>
                <td>
                  {p.page_type && (
                    <span className="badge badge-blue">
                      {p.page_type.replace("_", " ")}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${p.is_active ? "badge-green" : "badge-gray"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deletePage(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No content pages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Add Content Page" : "Edit Content Page"}
          onClose={() => setModal(null)}
        >
          {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                value={form.title ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Slug *</label>
              <input
                className="form-input"
                value={form.slug ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-"),
                  }))
                }
                placeholder="my-page-slug"
              />
            </div>
            <div>
              <label className="form-label">Page Type</label>
              <select
                className="form-select"
                value={form.page_type ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, page_type: e.target.value || null }))}
              >
                <option value="">— Select type —</option>
                {PAGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sort Order</label>
              <input
                className="form-input"
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="form-label">Content</label>
              <textarea
                className="form-textarea"
                value={form.content ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={8}
                style={{ fontFamily: "monospace", fontSize: "12px" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="page-active"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <label htmlFor="page-active" style={{ fontSize: "13px", fontWeight: 600 }}>Active</label>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Metric Library Tab ───────────────────────────────────────────────────────

const EMPTY_METRIC = {
  name: "",
  category: "",
  description: "",
  default_target: "",
  is_active: true,
};

function MetricLibraryTab() {
  const [metrics, setMetrics] = useState<MetricLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<MetricLibrary>>(EMPTY_METRIC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("metric_library")
      .select("*")
      .order("category")
      .order("name");
    if (data) setMetrics(data as MetricLibrary[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = metrics.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm({ ...EMPTY_METRIC });
    setError("");
    setModal("add");
  }

  function openEdit(m: MetricLibrary) {
    setForm({ ...m });
    setError("");
    setModal("edit");
  }

  async function save() {
    if (!form.name?.trim()) {
      setError("Metric name is required.");
      return;
    }
    setSaving(true);
    setError("");
    if (modal === "add") {
      const { error: err } = await supabase.from("metric_library").insert({
        name: form.name,
        category: form.category || null,
        description: form.description || null,
        default_target: form.default_target || null,
        is_active: form.is_active ?? true,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("metric_library")
        .update({
          name: form.name,
          category: form.category || null,
          description: form.description || null,
          default_target: form.default_target || null,
          is_active: form.is_active ?? true,
        })
        .eq("id", form.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function deleteMetric(id: string) {
    if (!confirm("Delete this metric?")) return;
    await supabase.from("metric_library").delete().eq("id", id);
    load();
  }

  const categories = [...new Set(metrics.map((m) => m.category ?? "Uncategorized"))].sort();

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ fontSize: "16px" }}>Metric Library</div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            className="form-input"
            style={{ width: "220px" }}
            placeholder="Search metrics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Metric</button>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Default Target</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>
                  {m.category && <span className="badge badge-blue">{m.category}</span>}
                </td>
                <td style={{ fontSize: "12px" }}>{m.default_target}</td>
                <td style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "200px" }}>
                  <span
                    title={m.description ?? undefined}
                    style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {m.description}
                  </span>
                </td>
                <td>
                  <span className={`badge ${m.is_active ? "badge-green" : "badge-gray"}`}>
                    {m.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(m)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteMetric(m.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  {search ? "No metrics match your search." : "No metrics found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Add Metric" : "Edit Metric"}
          onClose={() => setModal(null)}
        >
          {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Category</label>
              <input
                className="form-input"
                value={form.category ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                list="metric-cats"
                placeholder="e.g. Quality, Delivery, Cost"
              />
              <datalist id="metric-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="form-label">Default Target</label>
              <input
                className="form-input"
                value={form.default_target ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, default_target: e.target.value }))}
                placeholder="e.g. 95%, &lt; 3 days"
              />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="metric-active"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <label htmlFor="metric-active" style={{ fontSize: "13px", fontWeight: 600 }}>Active</label>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Supplier Questions Tab ───────────────────────────────────────────────────

const FIELD_TYPES = ["text", "select", "multiselect", "boolean", "number", "date"] as const;

const EMPTY_QUESTION = {
  section: "",
  question_text: "",
  field_type: "text" as string,
  options: null,
  is_required: false,
  sort_order: 0,
  is_active: true,
};

function SupplierQuestionsTab() {
  const [questions, setQuestions] = useState<SupplierQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<SupplierQuestion>>(EMPTY_QUESTION);
  const [optionsText, setOptionsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("supplier_profile_questions")
      .select("*")
      .order("section")
      .order("sort_order");
    if (data) setQuestions(data as SupplierQuestion[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_QUESTION });
    setOptionsText("");
    setError("");
    setModal("add");
  }

  function openEdit(q: SupplierQuestion) {
    setForm({ ...q });
    setOptionsText(
      q.options
        ? typeof q.options === "string"
          ? q.options
          : JSON.stringify(q.options, null, 2)
        : ""
    );
    setError("");
    setModal("edit");
  }

  async function save() {
    if (!form.question_text?.trim()) {
      setError("Question text is required.");
      return;
    }
    setSaving(true);
    setError("");

    let parsedOptions: unknown = null;
    if (optionsText.trim()) {
      try {
        parsedOptions = JSON.parse(optionsText);
      } catch {
        setError("Options must be valid JSON (e.g. [\"Option A\", \"Option B\"])");
        setSaving(false);
        return;
      }
    }

    const payload = {
      section: form.section || null,
      question_text: form.question_text,
      field_type: form.field_type || "text",
      options: parsedOptions,
      is_required: form.is_required ?? false,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active ?? true,
    };

    if (modal === "add") {
      const { error: err } = await supabase.from("supplier_profile_questions").insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("supplier_profile_questions")
        .update(payload)
        .eq("id", form.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this supplier question?")) return;
    await supabase.from("supplier_profile_questions").delete().eq("id", id);
    load();
  }

  async function moveOrder(q: SupplierQuestion, dir: -1 | 1) {
    const section = q.section ?? "";
    const peers = questions
      .filter((x) => (x.section ?? "") === section)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = peers.findIndex((x) => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= peers.length) return;
    const swap = peers[swapIdx];
    await supabase
      .from("supplier_profile_questions")
      .update({ sort_order: swap.sort_order })
      .eq("id", q.id);
    await supabase
      .from("supplier_profile_questions")
      .update({ sort_order: q.sort_order })
      .eq("id", swap.id);
    load();
  }

  const sections = groupBy(questions, (q) => q.section ?? "General");

  if (loading) return <div style={{ color: "var(--text-muted)", padding: "20px" }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{ fontSize: "16px" }}>Supplier Profile Questions</div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Question</button>
      </div>

      {Object.entries(sections).map(([section, items]) => (
        <div key={section} style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "10px",
              paddingBottom: "6px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {section}
          </div>
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "36px" }}></th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((q, idx) => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => moveOrder(q, -1)}
                          disabled={idx === 0}
                          style={{ padding: "2px 6px" }}
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => moveOrder(q, 1)}
                          disabled={idx === items.length - 1}
                          style={{ padding: "2px 6px" }}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{q.question_text}</td>
                    <td>
                      <span className="badge badge-blue">{q.field_type}</span>
                    </td>
                    <td>
                      {q.is_required ? (
                        <span className="badge badge-red">Required</span>
                      ) : (
                        <span className="badge badge-gray">Optional</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${q.is_active ? "badge-green" : "badge-gray"}`}>
                        {q.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(q)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {questions.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
          No supplier questions found.
        </div>
      )}

      {modal && (
        <Modal
          title={modal === "add" ? "Add Supplier Question" : "Edit Supplier Question"}
          onClose={() => setModal(null)}
        >
          {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label">Section</label>
              <input
                className="form-input"
                value={form.section ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                placeholder="e.g. Company Profile, Certifications"
              />
            </div>
            <div>
              <label className="form-label">Question Text *</label>
              <textarea
                className="form-textarea"
                value={form.question_text ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <label className="form-label">Field Type</label>
              <select
                className="form-select"
                value={form.field_type ?? "text"}
                onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value }))}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {(form.field_type === "select" || form.field_type === "multiselect") && (
              <div>
                <label className="form-label">
                  Options (JSON array)
                </label>
                <textarea
                  className="form-textarea"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={4}
                  placeholder={'["Option A", "Option B", "Option C"]'}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
              </div>
            )}
            <div>
              <label className="form-label">Sort Order</label>
              <input
                className="form-input"
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
            <div style={{ display: "flex", gap: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.is_required ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
                />
                Required
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("System Settings");

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Settings</h1>
          <p className="page-subtitle">
            Configure system settings, navigation, content, and lookup data.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: "24px", overflowX: "auto" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={{ whiteSpace: "nowrap" }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "System Settings" && <SystemSettingsTab />}
      {activeTab === "Menu Settings" && <MenuSettingsTab />}
      {activeTab === "Categories" && <CategoriesTab />}
      {activeTab === "Email Templates" && <EmailTemplatesTab />}
      {activeTab === "Content Pages" && <ContentPagesTab />}
      {activeTab === "Metric Library" && <MetricLibraryTab />}
      {activeTab === "Supplier Questions" && <SupplierQuestionsTab />}
    </div>
  );
}
