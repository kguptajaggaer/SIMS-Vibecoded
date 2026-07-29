"use client"

import { useState } from "react"

type Permission = {
  id: string
  name: string
  description: string
  category: string
  assigned_to: string[]
}

const ALL_PERMISSIONS: Permission[] = [
  { id: "p1", name: "CO Approve Contract", category: "SubK Compliance", description: "Approve SubK contracts as Contract Officer", assigned_to: ["co", "admin"] },
  { id: "p2", name: "Import Delete SubK", category: "SubK Compliance", description: "Import and delete SubK contract data", assigned_to: ["admin"] },
  { id: "p3", name: "Diversity Approve", category: "SubK Compliance", description: "Approve contracts at diversity review stage", assigned_to: ["diversity_manager", "admin"] },
  { id: "p4", name: "Edit SubK Data", category: "SubK Compliance", description: "Edit SubK spend data submitted by suppliers", assigned_to: ["co", "admin"] },
  { id: "p5", name: "EPP Admin Approve", category: "EPP Compliance", description: "Approve EPP contracts as EPP Admin", assigned_to: ["epp_admin", "admin"] },
  { id: "p6", name: "EPP Contract Management", category: "EPP Compliance", description: "Add and edit EPP contracts", assigned_to: ["co", "epp_admin", "admin"] },
  { id: "p7", name: "EPP Contract Setup", category: "EPP Compliance", description: "Configure EPP contract setup and categories", assigned_to: ["epp_admin", "admin"] },
  { id: "p8", name: "Portfolio Approve SubK", category: "SubK Compliance", description: "Approve SubK contracts at portfolio review stage", assigned_to: ["portfolio_manager", "admin"] },
  { id: "p9", name: "SubK Contract Management", category: "SubK Compliance", description: "Create and manage SubK contracts", assigned_to: ["co", "admin"] },
  { id: "p10", name: "Manage Supplier Performance", category: "Supplier Performance", description: "Create and manage development plans, scorecards, and reviews", assigned_to: ["ibp_manager", "cmc_manager", "sr_manager", "admin"] },
  { id: "p11", name: "Delete Scorecard", category: "Supplier Performance", description: "Delete scorecards and development plans", assigned_to: ["admin"] },
  { id: "p12", name: "Supplier Performance Reports", category: "Supplier Performance", description: "View and export supplier performance reports", assigned_to: ["ibp_manager", "portfolio_manager", "admin"] },
  { id: "p13", name: "Add Supplier", category: "Supplier Management", description: "Add new supplier profiles", assigned_to: ["admin", "co"] },
  { id: "p14", name: "Delete Supplier", category: "Supplier Management", description: "Remove supplier profiles from the system", assigned_to: ["admin"] },
  { id: "p15", name: "Modify Supplier Information", category: "Supplier Management", description: "Edit supplier profile and contact information", assigned_to: ["admin", "co"] },
  { id: "p16", name: "Import Suppliers", category: "Supplier Management", description: "Bulk import supplier data via CSV", assigned_to: ["admin"] },
  { id: "p17", name: "Manage User Accounts", category: "System Admin", description: "Add, edit, and deactivate user accounts", assigned_to: ["admin"] },
  { id: "p18", name: "Manage User Roles", category: "System Admin", description: "Create and modify user roles", assigned_to: ["admin"] },
  { id: "p19", name: "Manage System Settings", category: "System Admin", description: "Configure system-wide settings", assigned_to: ["admin"] },
  { id: "p20", name: "Manage Workflows", category: "System Admin", description: "Configure approval workflows and status transitions", assigned_to: ["admin"] },
  { id: "p21", name: "View Audit Log", category: "Reports", description: "View system audit logs and user activity", assigned_to: ["admin"] },
  { id: "p22", name: "Global Reports", category: "Reports", description: "Access all global reporting dashboards", assigned_to: ["admin", "portfolio_manager"] },
  { id: "p23", name: "Batch Email Internal Users", category: "Email", description: "Send batch emails to internal USPS users", assigned_to: ["admin"] },
  { id: "p24", name: "Batch Email Suppliers", category: "Email", description: "Send batch emails to supplier contacts", assigned_to: ["admin", "co"] },
  { id: "p25", name: "Content Manage", category: "Content", description: "Manage internal content pages and help links", assigned_to: ["admin"] },
]

const ROLES = ["admin", "co", "portfolio_manager", "diversity_manager", "epp_admin", "ibp_manager", "cmc_manager", "sr_manager", "ap_reviewer"]

export default function PermissionsPage() {
  const [perms] = useState<Permission[]>(ALL_PERMISSIONS)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("All")

  const categories = ["All", ...Array.from(new Set(perms.map(p => p.category)))]

  const filtered = perms.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === "All" || p.category === catFilter
    return matchSearch && matchCat
  })

  const grouped: Record<string, Permission[]> = {}
  for (const p of filtered) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Permission Settings</h1>
          <p className="page-subtitle">
            View and manage system permissions and which roles have access to each.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search permissions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            border: "1px solid #d1d9e6",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 13,
            width: 260,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                border: "1px solid",
                borderColor: catFilter === c ? "#004B87" : "#d1d9e6",
                backgroundColor: catFilter === c ? "#004B87" : "white",
                color: catFilter === c ? "white" : "#374151",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: catFilter === c ? 600 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      {Object.entries(grouped).map(([cat, catPerms]) => (
        <div
          key={cat}
          style={{
            marginBottom: 20,
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
              padding: "8px 16px",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {cat}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 220 }}>
                    Permission
                  </th>
                  {ROLES.map(r => (
                    <th key={r} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                      {r.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catPerms.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f0f2f5", backgroundColor: i % 2 === 0 ? "white" : "#fafbfc" }}>
                    <td style={{ padding: "8px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: "#1a2332" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{p.description}</div>
                    </td>
                    {ROLES.map(r => (
                      <td key={r} style={{ padding: "8px 6px", textAlign: "center" }}>
                        <span style={{ fontSize: 16, color: p.assigned_to.includes(r) ? "#16a34a" : "#e5e7eb" }}>
                          {p.assigned_to.includes(r) ? "✓" : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
