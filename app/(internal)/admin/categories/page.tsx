"use client"

import { useState } from "react"

type Category = {
  id: string
  name: string
  code: string
  parent: string | null
  status: "active" | "inactive"
  subcategories?: Category[]
}

const SAMPLE: Category[] = [
  {
    id: "c1", name: "Information Technology", code: "IT", parent: null, status: "active",
    subcategories: [
      { id: "c1a", name: "Hardware", code: "IT-HW", parent: "c1", status: "active" },
      { id: "c1b", name: "Software", code: "IT-SW", parent: "c1", status: "active" },
      { id: "c1c", name: "Networking", code: "IT-NET", parent: "c1", status: "active" },
    ],
  },
  {
    id: "c2", name: "Professional Services", code: "PS", parent: null, status: "active",
    subcategories: [
      { id: "c2a", name: "Consulting", code: "PS-CON", parent: "c2", status: "active" },
      { id: "c2b", name: "Legal Services", code: "PS-LEG", parent: "c2", status: "inactive" },
    ],
  },
  {
    id: "c3", name: "Facilities & Maintenance", code: "FM", parent: null, status: "active",
    subcategories: [
      { id: "c3a", name: "Janitorial", code: "FM-JAN", parent: "c3", status: "active" },
      { id: "c3b", name: "HVAC", code: "FM-HVAC", parent: "c3", status: "active" },
    ],
  },
  {
    id: "c4", name: "Logistics & Transportation", code: "LT", parent: null, status: "active",
    subcategories: [
      { id: "c4a", name: "Ground Transport", code: "LT-GND", parent: "c4", status: "active" },
      { id: "c4b", name: "Air Freight", code: "LT-AIR", parent: "c4", status: "active" },
    ],
  },
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(SAMPLE)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["c1", "c2"]))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", code: "", parent: "", status: "active" })
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      setMsg({ type: "error", text: "Name and code are required." })
      return
    }
    const newCat: Category = {
      id: `c${Date.now()}`,
      name: form.name,
      code: form.code.toUpperCase(),
      parent: form.parent || null,
      status: form.status as "active" | "inactive",
    }
    if (form.parent) {
      setCategories(prev =>
        prev.map(c =>
          c.id === form.parent
            ? { ...c, subcategories: [...(c.subcategories ?? []), newCat] }
            : c,
        ),
      )
    } else {
      setCategories(prev => [...prev, { ...newCat, subcategories: [] }])
    }
    setForm({ name: "", code: "", parent: "", status: "active" })
    setShowAdd(false)
    setMsg({ type: "success", text: "Category added successfully." })
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Product / Service Category Management</h1>
          <p className="page-subtitle">
            Add, edit, and organize categories and sub-categories used in contract reporting.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            backgroundColor: "#004B87",
            color: "white",
            border: "none",
            borderRadius: 5,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Category
        </button>
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 5,
            fontSize: 13,
            backgroundColor: msg.type === "success" ? "#dcfce7" : "#fee2e2",
            color: msg.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {msg.text}
        </div>
      )}

      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#004B87", color: "white" }}>
              {["Category / Subcategory", "Code", "Level", "Status", "Actions"].map(h => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, ci) => (
              <>
                <tr
                  key={cat.id}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    backgroundColor: ci % 2 === 0 ? "#f8fafc" : "white",
                  }}
                >
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => toggleExpand(cat.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0 4px",
                          fontSize: 14,
                          color: "#6b7280",
                          fontWeight: "bold",
                        }}
                      >
                        {expanded.has(cat.id) ? "▾" : "▸"}
                      </button>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#1a2332" }}>{cat.name}</span>
                      {cat.subcategories && (
                        <span
                          style={{
                            fontSize: 11,
                            backgroundColor: "#dbeafe",
                            color: "#1d4ed8",
                            padding: "1px 6px",
                            borderRadius: 8,
                            fontWeight: 600,
                          }}
                        >
                          {cat.subcategories.length} sub
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: "#374151" }}>
                    {cat.code}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>Parent</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        backgroundColor: cat.status === "active" ? "#dcfce7" : "#fee2e2",
                        color: cat.status === "active" ? "#166534" : "#991b1b",
                      }}
                    >
                      {cat.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={{
                          padding: "4px 10px",
                          border: "1px solid #004B87",
                          borderRadius: 4,
                          color: "#004B87",
                          background: "white",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setForm({ name: "", code: "", parent: cat.id, status: "active" })
                          setShowAdd(true)
                        }}
                        style={{
                          padding: "4px 10px",
                          border: "1px solid #16a34a",
                          borderRadius: 4,
                          color: "#16a34a",
                          background: "white",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        + Sub
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Subcategories */}
                {expanded.has(cat.id) &&
                  (cat.subcategories ?? []).map(sub => (
                    <tr
                      key={sub.id}
                      style={{ borderBottom: "1px solid #f0f2f5", backgroundColor: "#fefeff" }}
                    >
                      <td style={{ padding: "8px 14px 8px 44px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#9ca3af", fontSize: 12 }}>└─</span>
                          <span style={{ fontSize: 13, color: "#374151" }}>{sub.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>
                        {sub.code}
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#9ca3af" }}>Sub-category</td>
                      <td style={{ padding: "8px 14px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 10,
                            backgroundColor: sub.status === "active" ? "#dcfce7" : "#fee2e2",
                            color: sub.status === "active" ? "#166534" : "#991b1b",
                          }}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <button
                          style={{
                            padding: "3px 10px",
                            border: "1px solid #004B87",
                            borderRadius: 4,
                            color: "#004B87",
                            background: "white",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowAdd(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              padding: 28,
              width: 440,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>
              {form.parent ? "Add Subcategory" : "Add Category"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {form.parent && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#eff6ff",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#1d4ed8",
                  }}
                >
                  Parent: <strong>{categories.find(c => c.id === form.parent)?.name}</strong>
                </div>
              )}
              {[
                { label: "Category Name *", key: "name", type: "text" },
                { label: "Category Code *", key: "code", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{
                      width: "100%",
                      border: "1px solid #d1d9e6",
                      borderRadius: 4,
                      padding: "7px 10px",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
              {!form.parent && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Parent Category
                  </label>
                  <select
                    value={form.parent}
                    onChange={e => setForm(prev => ({ ...prev, parent: e.target.value }))}
                    style={{
                      width: "100%",
                      border: "1px solid #d1d9e6",
                      borderRadius: 4,
                      padding: "7px 10px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  >
                    <option value="">None (Top-level)</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d9e6",
                    borderRadius: 4,
                    padding: "7px 10px",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setShowAdd(false); setForm({ name: "", code: "", parent: "", status: "active" }) }}
                style={{ padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 5, background: "white", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ padding: "8px 16px", border: "none", borderRadius: 5, backgroundColor: "#004B87", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
