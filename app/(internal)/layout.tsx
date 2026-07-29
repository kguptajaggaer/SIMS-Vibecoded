"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { getUser, removeUser } from "@/lib/supabase"
import type { User } from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

function navLinkStyle(pathname: string, href: string): React.CSSProperties {
  const active = isLinkActive(pathname, href)
  return {
    color: active ? "#ffffff" : "#c8d9ec",
    textDecoration: active ? "underline" : "none",
    textUnderlineOffset: "3px",
    fontSize: "13px",
    fontWeight: active ? "600" : "500",
    padding: "4px 6px",
    borderRadius: "4px",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    letterSpacing: "0.01em",
  }
}

function dropdownItemStyle(pathname: string, href: string): React.CSSProperties {
  const active = isLinkActive(pathname, href)
  return {
    display: "block",
    padding: "7px 16px",
    fontSize: "13px",
    color: active ? "#004B87" : "#1a2332",
    fontWeight: active ? "600" : "400",
    textDecoration: "none",
    backgroundColor: active ? "#e8f0fb" : "transparent",
    whiteSpace: "nowrap" as const,
  }
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [suppPerfOpen, setSuppPerfOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  // Auth guard
  useEffect(() => {
    const u = getUser()
    if (!u || u.user_type !== "internal") {
      router.replace("/login")
      return
    }
    setUser(u)
  }, [router])

  function handleLogout() {
    removeUser()
    router.push("/login")
  }

  // Don't render layout until user is confirmed
  if (!user) return null

  const isAdmin =
    user.role != null &&
    (user.role as { name?: string }).name === "admin"

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: "#004B87",
          height: "48px",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          gap: "14px",
          overflow: "visible",
        }}
      >
        {/* ── Logo ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: "700",
              letterSpacing: "0.06em",
            }}
          >
            SIMS
          </span>
          <span
            style={{
              color: "#c8d9ec",
              fontSize: "11px",
              fontWeight: "400",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            Supplier Information Management System
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "28px",
            backgroundColor: "rgba(255,255,255,0.25)",
            flexShrink: 0,
          }}
        />

        {/* ── Nav Links ── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Home */}
          <Link href="/" style={navLinkStyle(pathname, "/")}>
            Home
          </Link>

          {/* Sourcing */}
          <Link href="/sourcing" style={navLinkStyle(pathname, "/sourcing")}>
            Sourcing
          </Link>

          {/* Compliance — hover dropdown */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setComplianceOpen(true)}
            onMouseLeave={() => setComplianceOpen(false)}
          >
            <button
              type="button"
              style={{
                ...navLinkStyle(pathname, "/compliance"),
                background: "none",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Compliance
              <span style={{ fontSize: "9px", lineHeight: 1, marginTop: "1px" }}>
                ▾
              </span>
            </button>

            {complianceOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  boxShadow:
                    "0 4px 6px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: "200px",
                  padding: "6px 0",
                  zIndex: 200,
                  border: "1px solid #e5e7eb",
                }}
              >
                {/* SubK section */}
                <div style={{ padding: "5px 16px 3px", fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  SubK Contract
                </div>
                <Link href="/compliance/subk/contracts" style={dropdownItemStyle(pathname, "/compliance/subk/contracts")}>
                  SubK Contract List
                </Link>
                <Link href="/compliance/subk/contracts/batch-approval" style={dropdownItemStyle(pathname, "/compliance/subk/contracts/batch-approval")}>
                  SubK Contract Batch Approval
                </Link>
                <Link href="/compliance/subk/contracts/co-batch-approval" style={dropdownItemStyle(pathname, "/compliance/subk/contracts/co-batch-approval")}>
                  SubK Contract CO Batch Approval
                </Link>
                <Link href="/compliance/subk/contracts/import" style={dropdownItemStyle(pathname, "/compliance/subk/contracts/import")}>
                  SubK Contract Data Dump
                </Link>
                <Link href="/compliance/subk/reports/publish" style={dropdownItemStyle(pathname, "/compliance/subk/reports/publish")}>
                  Publish SubK Reports
                </Link>

                <div style={{ padding: "5px 16px 3px", fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>
                  SubK Report
                </div>
                <Link href="/compliance/subk/reports" style={dropdownItemStyle(pathname, "/compliance/subk/reports")}>
                  SubK Reports
                </Link>

                <div style={{ height: "1px", backgroundColor: "#e5e7eb", margin: "5px 0" }} />

                {/* EPP section */}
                <div style={{ padding: "5px 16px 3px", fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  EPP Contract
                </div>
                <Link href="/compliance/epp/contracts" style={dropdownItemStyle(pathname, "/compliance/epp/contracts")}>
                  EPP Contract List
                </Link>
                <Link href="/compliance/epp/contracts/batch-approval" style={dropdownItemStyle(pathname, "/compliance/epp/contracts/batch-approval")}>
                  EPP Contract Batch Approval
                </Link>
                <Link href="/compliance/epp/contracts/import" style={dropdownItemStyle(pathname, "/compliance/epp/contracts/import")}>
                  EPP Contract Data Dump
                </Link>

                <div style={{ padding: "5px 16px 3px", fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>
                  EPP Report
                </div>
                <Link href="/compliance/epp/reports" style={dropdownItemStyle(pathname, "/compliance/epp/reports")}>
                  EPP Reports
                </Link>
              </div>
            )}
          </div>

          {/* Supplier Performance dropdown */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setSuppPerfOpen(true)}
            onMouseLeave={() => setSuppPerfOpen(false)}
          >
            <button
              type="button"
              style={{
                ...navLinkStyle(pathname, "/supplier-performance"),
                background: "none",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Supplier Performance
              <span style={{ fontSize: "9px", lineHeight: 1, marginTop: "1px" }}>▾</span>
            </button>
            {suppPerfOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: "200px",
                  padding: "6px 0",
                  zIndex: 200,
                  border: "1px solid #e5e7eb",
                }}
              >
                <Link href="/supplier-performance/suppliers" style={dropdownItemStyle(pathname, "/supplier-performance/suppliers")}>
                  Supplier List
                </Link>
                <Link href="/suppliers" style={dropdownItemStyle(pathname, "/suppliers")}>
                  All Suppliers
                </Link>
              </div>
            )}
          </div>

          {/* Email */}
          <Link href="/email" style={navLinkStyle(pathname, "/email")}>
            Email
          </Link>

          {/* Content */}
          <Link href="/content" style={navLinkStyle(pathname, "/content")}>
            Content
          </Link>

          {/* General */}
          <Link href="/general" style={navLinkStyle(pathname, "/general")}>
            General
          </Link>

          {/* Administrator dropdown — admin role only */}
          {isAdmin && (
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => setAdminOpen(true)}
              onMouseLeave={() => setAdminOpen(false)}
            >
              <button
                type="button"
                style={{
                  ...navLinkStyle(pathname, "/admin"),
                  background: "none",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Administrator
                <span style={{ fontSize: "9px", lineHeight: 1, marginTop: "1px" }}>▾</span>
              </button>
              {adminOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    backgroundColor: "#ffffff",
                    borderRadius: "6px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.12)",
                    minWidth: "200px",
                    padding: "6px 0",
                    zIndex: 200,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Link href="/administrator" style={dropdownItemStyle(pathname, "/administrator")}>Administrator Hub</Link>
                  <Link href="/admin/users" style={dropdownItemStyle(pathname, "/admin/users")}>User Accounts</Link>
                  <Link href="/admin/roles" style={dropdownItemStyle(pathname, "/admin/roles")}>User Roles</Link>
                  <Link href="/admin/settings" style={dropdownItemStyle(pathname, "/admin/settings")}>System Settings</Link>
                  <Link href="/admin/workflows" style={dropdownItemStyle(pathname, "/admin/workflows")}>Workflows</Link>
                  <Link href="/admin/audit-logs" style={dropdownItemStyle(pathname, "/admin/audit-logs")}>Audit Logs</Link>
                  <Link href="/admin/permissions" style={dropdownItemStyle(pathname, "/admin/permissions")}>Permission Settings</Link>
                  <Link href="/admin/menus" style={dropdownItemStyle(pathname, "/admin/menus")}>Menu Settings</Link>
                  <Link href="/admin/categories" style={dropdownItemStyle(pathname, "/admin/categories")}>Categories</Link>
                </div>
              )}
            </div>
          )}

          {/* User Guides & Help Links */}
          <Link href="/help" style={navLinkStyle(pathname, "/help")}>
            User Guides &amp; Help Links
          </Link>
        </nav>

        {/* ── User info + Logout ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: "#c8d9ec",
              fontSize: "13px",
              fontWeight: "500",
              whiteSpace: "nowrap",
            }}
          >
            {user.name}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.45)",
              borderRadius: "4px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "500",
              padding: "3px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          padding: "20px",
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  )
}
