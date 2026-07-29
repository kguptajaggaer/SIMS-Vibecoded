"use client"

import { useState } from "react"

type MenuItem = {
  id: string
  label: string
  path: string
  visible: boolean
  requiresRole?: string
  parent?: string
  order: number
}

const INITIAL_MENU: MenuItem[] = [
  { id: "m1", label: "Home", path: "/", visible: true, order: 1 },
  { id: "m2", label: "Sourcing", path: "/sourcing", visible: true, order: 2 },
  { id: "m3", label: "Compliance", path: "/compliance", visible: true, order: 3 },
  { id: "m3a", label: "SubK Contract", path: "/compliance/subk/contracts", visible: true, parent: "m3", order: 1 },
  { id: "m3b", label: "SubK Contract Batch Approval", path: "/compliance/subk/contracts/batch-approval", visible: true, parent: "m3", order: 2 },
  { id: "m3c", label: "SubK Contract CO Batch Approval", path: "/compliance/subk/contracts/co-batch-approval", visible: true, parent: "m3", order: 3 },
  { id: "m3d", label: "Publish SubK Reports", path: "/compliance/subk/reports/publish", visible: true, parent: "m3", order: 4 },
  { id: "m3e", label: "SubK Reports", path: "/compliance/subk/reports", visible: true, parent: "m3", order: 5 },
  { id: "m3f", label: "EPP Contract", path: "/compliance/epp/contracts", visible: true, parent: "m3", order: 6 },
  { id: "m3g", label: "EPP Contract Batch Approval", path: "/compliance/epp/contracts/batch-approval", visible: true, parent: "m3", order: 7 },
  { id: "m3h", label: "EPP Reports", path: "/compliance/epp/reports", visible: true, parent: "m3", order: 8 },
  { id: "m4", label: "Supplier Performance", path: "/supplier-performance/suppliers", visible: true, order: 4 },
  { id: "m5", label: "Email", path: "/email", visible: true, order: 5 },
  { id: "m6", label: "Content", path: "/content", visible: true, order: 6 },
  { id: "m7", label: "General", path: "/general", visible: true, order: 7 },
  { id: "m8", label: "Administrator", path: "/administrator", visible: true, requiresRole: "admin", order: 8 },
  { id: "m9", label: "User Guides & Help Links", path: "/help", visible: true, order: 9 },
]

export default function MenusPage() {
  const [items, setItems] = useState<MenuItem[]>(INITIAL_MENU)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  function toggleVisibility(id: string) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, visible: !i.visible } : i)))
  }

  function handleSave() {
    setMsg({ type: "success", text: "Menu settings saved successfully." })
    setTimeout(() => setMsg(null), 3000)
  }

  const topLevel = items.filter(i => !i.parent).sort((a, b) => a.order - b.order)
  const getChildren = (id: string) => items.filter(i => i.parent === id).sort((a, b) => a.order - b.order)

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Menu Settings</h1>
          <p className="page-subtitle">
            Configure which navigation items are visible and their order in the top navigation.
          </p>
        </div>
        <button
          onClick={handleSave}
          style={{
            backgroundColor: "#004B87",
            color: "white",
            border: "none",
            borderRadius: 5,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save Changes
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
        <div
          style={{
            backgroundColor: "#004B87",
            color: "white",
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Top Navigation Bar Configuration
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              {["Order", "Menu Item", "Path", "Requires Role", "Visible"].map(h => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topLevel.map((item, i) => (
              <>
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    backgroundColor: i % 2 === 0 ? "#f8fafc" : "white",
                    opacity: item.visible ? 1 : 0.5,
                  }}
                >
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#6b7280", width: 60 }}>
                    {item.order}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1a2332" }}>{item.label}</span>
                    {getChildren(item.id).length > 0 && (
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>
                        ({getChildren(item.id).length} sub-items)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>
                    {item.path}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {item.requiresRole ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 10,
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                        }}
                      >
                        {item.requiresRole}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>All users</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => toggleVisibility(item.id)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 12, color: item.visible ? "#16a34a" : "#9ca3af", fontWeight: 500 }}>
                        {item.visible ? "Visible" : "Hidden"}
                      </span>
                    </label>
                  </td>
                </tr>

                {/* Sub-items */}
                {getChildren(item.id).map(child => (
                  <tr
                    key={child.id}
                    style={{
                      borderBottom: "1px solid #f0f2f5",
                      backgroundColor: "#fefeff",
                      opacity: child.visible ? 1 : 0.4,
                    }}
                  >
                    <td style={{ padding: "7px 14px", fontSize: 12, color: "#9ca3af" }}>
                      └ {child.order}
                    </td>
                    <td style={{ padding: "7px 14px 7px 28px" }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>{child.label}</span>
                    </td>
                    <td style={{ padding: "7px 14px", fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>
                      {child.path}
                    </td>
                    <td style={{ padding: "7px 14px" }}>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
                    </td>
                    <td style={{ padding: "7px 14px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={child.visible}
                          onChange={() => toggleVisibility(child.id)}
                          style={{ width: 14, height: 14, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 12, color: child.visible ? "#16a34a" : "#9ca3af" }}>
                          {child.visible ? "Visible" : "Hidden"}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
