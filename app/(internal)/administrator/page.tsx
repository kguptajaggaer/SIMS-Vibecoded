"use client"

import Link from "next/link"

const adminModules = [
  {
    title: "User Accounts",
    description: "Add, edit, and manage internal USPS users and their system access.",
    href: "/admin/users",
    icon: "👥",
    color: "#3b82f6",
  },
  {
    title: "User Roles",
    description: "Create and configure custom roles with specific system-level permissions.",
    href: "/admin/roles",
    icon: "🔐",
    color: "#8b5cf6",
  },
  {
    title: "System Settings",
    description: "Configure system-wide settings, reporting periods, and operational parameters.",
    href: "/admin/settings",
    icon: "⚙️",
    color: "#f59e0b",
  },
  {
    title: "Workflows",
    description: "Manage approval workflows and automated status transitions for contracts and scorecards.",
    href: "/admin/workflows",
    icon: "🔄",
    color: "#10b981",
  },
  {
    title: "Audit Logs",
    description: "Review user activity logs, page access history, and email delivery logs.",
    href: "/admin/audit-logs",
    icon: "📋",
    color: "#ef4444",
  },
  {
    title: "Permission Settings",
    description: "Create and manage custom permission sets for fine-grained access control.",
    href: "/admin/permissions",
    icon: "🛡️",
    color: "#06b6d4",
  },
  {
    title: "Menu Settings",
    description: "Configure navigation menus and page visibility across the portal.",
    href: "/admin/menus",
    icon: "📌",
    color: "#84cc16",
  },
  {
    title: "Categories",
    description: "Manage product/service categories and sub-categories used in contract reporting.",
    href: "/admin/categories",
    icon: "🏷️",
    color: "#f97316",
  },
]

export default function AdministratorPage() {
  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Administrator</h1>
          <p className="page-subtitle">
            System administration hub — manage users, roles, workflows, and system configuration.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {adminModules.map(mod => (
          <Link
            key={mod.href}
            href={mod.href}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "20px",
                cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.1s, border-color 0.15s",
                height: "100%",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.boxShadow = "0 4px 16px rgba(0,75,135,0.15)"
                el.style.transform = "translateY(-2px)"
                el.style.borderColor = mod.color
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.boxShadow = "none"
                el.style.transform = "translateY(0)"
                el.style.borderColor = "#e2e8f0"
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: `${mod.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {mod.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2332", marginBottom: 5 }}>
                    {mod.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    {mod.description}
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid #f0f2f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <span style={{ fontSize: 12, color: mod.color, fontWeight: 600 }}>
                  Open →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info box */}
      <div
        style={{
          marginTop: 24,
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 6,
          padding: "12px 16px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          fontSize: 13,
          color: "#92400e",
        }}
      >
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div>
          <strong>Admin Access Only</strong> — Changes made in the Administrator section affect all users system-wide.
          Please review changes carefully before saving.
        </div>
      </div>
    </div>
  )
}
