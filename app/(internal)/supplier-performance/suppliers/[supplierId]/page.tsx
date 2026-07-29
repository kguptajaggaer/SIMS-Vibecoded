"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase, formatDateShort } from "@/lib/supabase"
import type { Supplier, SegmentationQuadrant } from "@/lib/types"

const QUADRANT_CONFIG: Record<SegmentationQuadrant, { bg: string; color: string; label: string }> = {
  strategic: { bg: "#e8f0f8", color: "#004B87", label: "Strategic" },
  critical: { bg: "#fee2e2", color: "#dc2626", label: "Critical" },
  support: { bg: "#f1f5f9", color: "#475569", label: "Support" },
  leading: { bg: "#dcfce7", color: "#16a34a", label: "Leading" },
}

export default function SupplierPerformanceHubPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [scorecards, setScorecards] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [supplierId])

  async function loadData() {
    setLoading(true)
    const [{ data: s }, { data: p }, { data: sc }, { data: rv }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", supplierId).single(),
      supabase
        .from("development_plans")
        .select("id, name, status, segmentation_quadrant, review_frequency, created_at")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
      supabase
        .from("scorecards")
        .select("id, title, status, created_at, development_plan_id")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
      supabase
        .from("performance_reviews")
        .select("id, title, status, review_date, development_plan_id")
        .eq("supplier_id", supplierId)
        .order("review_date", { ascending: false }),
    ])
    setSupplier(s)
    setPlans(p ?? [])
    setScorecards(sc ?? [])
    setReviews(rv ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 14 }}>
        Loading supplier data…
      </div>
    )
  }

  if (!supplier) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 14 }}>
        Supplier not found.{" "}
        <Link href="/supplier-performance/suppliers" style={{ color: "#004B87" }}>
          Back to list
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <Link href="/supplier-performance/suppliers" style={{ color: "#004B87", textDecoration: "none" }}>
          Supplier Performance
        </Link>
        <span style={{ color: "#9ca3af" }}>/</span>
        <span style={{ color: "#6b7280" }}>{supplier.name}</span>
      </div>

      {/* Header */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "20px 24px",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#1a2332" }}>
            {supplier.name}
          </h1>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
            {supplier.apex_number && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                APEX: <strong>{supplier.apex_number}</strong>
              </span>
            )}
            {supplier.dba_name && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                DBA: <strong>{supplier.dba_name}</strong>
              </span>
            )}
            {supplier.is_diverse && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                  backgroundColor: "#dcfce7",
                  color: "#166534",
                }}
              >
                Diverse Supplier
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/supplier-performance/suppliers/${supplierId}/development-plans`}
          style={{
            padding: "8px 18px",
            backgroundColor: "#004B87",
            color: "white",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          + New Development Plan
        </Link>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Development Plans", count: plans.length, icon: "📋", href: `development-plans` },
          { label: "Scorecards", count: scorecards.length, icon: "📊", href: `development-plans` },
          { label: "Performance Reviews", count: reviews.length, icon: "🔍", href: `development-plans` },
        ].map(s => (
          <Link
            key={s.label}
            href={`/supplier-performance/suppliers/${supplierId}/${s.href}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#004B87")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
            >
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#004B87", lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Development Plans */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            backgroundColor: "#004B87",
            color: "white",
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Development Plans</span>
          <Link
            href={`/supplier-performance/suppliers/${supplierId}/development-plans`}
            style={{ fontSize: 12, color: "#c8d9ec", textDecoration: "none" }}
          >
            View All →
          </Link>
        </div>
        {plans.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            No development plans yet.{" "}
            <Link
              href={`/supplier-performance/suppliers/${supplierId}/development-plans`}
              style={{ color: "#004B87" }}
            >
              Create one →
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Plan Name", "Quadrant", "Frequency", "Status", "Created", "Action"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 14px",
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
              {plans.slice(0, 5).map((plan, i) => {
                const q = QUADRANT_CONFIG[plan.segmentation_quadrant as SegmentationQuadrant] ?? { bg: "#f3f4f6", color: "#6b7280", label: "—" }
                return (
                  <tr
                    key={plan.id}
                    style={{
                      borderBottom: "1px solid #f0f2f5",
                      backgroundColor: i % 2 === 0 ? "white" : "#fafbfc",
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1a2332" }}>
                      {plan.name}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {plan.segmentation_quadrant ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 10,
                            backgroundColor: q.bg,
                            color: q.color,
                          }}
                        >
                          {q.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                      {plan.review_frequency?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 10,
                          backgroundColor: plan.status === "active" ? "#dbeafe" : "#f3f4f6",
                          color: plan.status === "active" ? "#1d4ed8" : "#6b7280",
                        }}
                      >
                        {plan.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                      {formatDateShort(plan.created_at)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Link
                        href={`/supplier-performance/suppliers/${supplierId}/development-plans/${plan.id}`}
                        style={{
                          padding: "4px 10px",
                          border: "1px solid #004B87",
                          borderRadius: 4,
                          color: "#004B87",
                          fontSize: 12,
                          fontWeight: 500,
                          textDecoration: "none",
                          backgroundColor: "white",
                        }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Scorecards */}
      {scorecards.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#1d4ed8",
              color: "white",
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Recent Scorecards
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Scorecard Title", "Status", "Created"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 14px",
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
              {scorecards.slice(0, 5).map((sc, i) => (
                <tr
                  key={sc.id}
                  style={{
                    borderBottom: "1px solid #f0f2f5",
                    backgroundColor: i % 2 === 0 ? "white" : "#fafbfc",
                  }}
                >
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#1a2332" }}>{sc.title ?? "Untitled"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        backgroundColor: "#dbeafe",
                        color: "#1d4ed8",
                      }}
                    >
                      {sc.status ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                    {formatDateShort(sc.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
