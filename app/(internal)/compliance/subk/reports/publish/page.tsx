"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type ReportRow = {
  id: string
  contract_number: string
  supplier_name: string
  spend_period: string
  total_spend: number
  status: string
  selected: boolean
  published: boolean
}

export default function PublishSubkReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [filter, setFilter] = useState<"pending" | "published">("pending")

  useEffect(() => {
    loadReports()
  }, [filter])

  async function loadReports() {
    setLoading(true)
    const { data } = await supabase
      .from("contract_cycles")
      .select(`
        id, status, spend_period, total_spend,
        contracts!inner(contract_number, vendor_name)
      `)
      .in("status", filter === "pending" ? ["close_for_report"] : ["closed"])
      .order("id", { ascending: false })

    setRows(
      (data ?? []).map((r: any) => ({
        id: r.id,
        contract_number: r.contracts?.contract_number ?? "—",
        supplier_name: r.contracts?.vendor_name ?? "—",
        spend_period: r.spend_period ?? "—",
        total_spend: r.total_spend ?? 0,
        status: r.status,
        selected: false,
        published: r.status === "closed",
      })),
    )
    setLoading(false)
  }

  function toggleAll(checked: boolean) {
    setRows(prev => prev.map(r => ({ ...r, selected: checked })))
  }

  function toggleRow(id: string) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r)))
  }

  const selected = rows.filter(r => r.selected)

  async function publishSelected() {
    if (!selected.length) {
      setMsg({ type: "error", text: "Please select at least one report to publish." })
      return
    }
    setPublishing(true)
    const ids = selected.map(r => r.id)
    const { error } = await supabase
      .from("contract_cycles")
      .update({ status: "closed" })
      .in("id", ids)

    if (error) {
      setMsg({ type: "error", text: error.message })
    } else {
      setMsg({
        type: "success",
        text: `${selected.length} SubK report${selected.length !== 1 ? "s" : ""} published successfully. Status changed to Closed.`,
      })
      loadReports()
    }
    setPublishing(false)
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/compliance/subk/reports" style={{ color: "#004B87", fontSize: 13, textDecoration: "none" }}>
              SubK Reports
            </Link>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>/</span>
            <span style={{ color: "#6b7280", fontSize: 13 }}>Publish</span>
          </div>
          <h1 className="page-title">Publish SubK Reports</h1>
          <p className="page-subtitle">
            Finalize and publish SubK contract reports. Publishing changes the contract status from
            "Close for Report" to "Closed".
          </p>
        </div>
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

      {/* Warning */}
      <div
        style={{
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 5,
          fontSize: 12,
          backgroundColor: "#fffbeb",
          color: "#92400e",
          border: "1px solid #fde68a",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span>⚠️</span>
        <div>
          <strong>This action is irreversible.</strong> Once published, SubK reports are marked as "Closed"
          and cannot be re-opened for editing. Ensure all data is accurate before publishing.
        </div>
      </div>

      {/* Tabs + Actions */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {(["pending", "published"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: "5px 14px",
                borderRadius: 4,
                border: "1px solid",
                borderColor: filter === t ? "#004B87" : "#e5e7eb",
                backgroundColor: filter === t ? "#004B87" : "white",
                color: filter === t ? "white" : "#374151",
                fontSize: 12,
                fontWeight: filter === t ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "pending" ? "Pending Publication" : "Published"}
            </button>
          ))}
        </div>

        {filter === "pending" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {selected.length} selected of {rows.length}
            </span>
            <button
              onClick={publishSelected}
              disabled={publishing || !selected.length}
              style={{
                padding: "7px 18px",
                backgroundColor: selected.length ? "#004B87" : "#93c5fd",
                color: "white",
                border: "none",
                borderRadius: 5,
                fontSize: 13,
                fontWeight: 600,
                cursor: selected.length ? "pointer" : "not-allowed",
              }}
            >
              📢 Publish Selected
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          overflow: "auto",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", fontSize: 13 }}>
            Loading reports…
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {filter === "pending" && (
                  <th style={{ padding: "10px 14px", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every(r => r.selected)}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                )}
                {["Contract #", "Supplier Name", "Spend Period", "Total Spend", "Status"].map(h => (
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
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: "1px solid #f0f2f5",
                    backgroundColor: row.selected ? "#eff6ff" : i % 2 === 0 ? "white" : "#fafbfc",
                  }}
                >
                  {filter === "pending" && (
                    <td style={{ padding: "10px 14px" }}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                  )}
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#004B87" }}>
                    {row.contract_number}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.supplier_name}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.spend_period}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    ${(row.total_spend ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        backgroundColor: row.published ? "#dcfce7" : "#fef3c7",
                        color: row.published ? "#166534" : "#92400e",
                      }}
                    >
                      {row.published ? "Published / Closed" : "Close for Report"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", fontSize: 13 }}>
            {filter === "pending"
              ? "No reports pending publication."
              : "No published reports found."}
          </div>
        )}
      </div>
    </div>
  )
}
