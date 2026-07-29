"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase, getUser } from "@/lib/supabase"
import type { User } from "@/lib/types"

type ContractRow = {
  id: string
  contract_number: string
  supplier_name: string
  epp_status: string
  spend_period: string
  total_epp_spend: number
  selected: boolean
}

export default function EppBatchApprovalPage() {
  const [user, setUser] = useState<User | null>(null)
  const [rows, setRows] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState("ready_for_epp_admin_review")

  useEffect(() => {
    setUser(getUser())
    loadContracts()
  }, [statusFilter])

  async function loadContracts() {
    setLoading(true)
    const { data } = await supabase
      .from("epp_contract_cycles")
      .select(`
        id, epp_status, spend_period, total_epp_spend,
        contracts!inner(contract_number, vendor_name)
      `)
      .eq("epp_status", statusFilter)
      .order("id", { ascending: false })

    const mapped: ContractRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      contract_number: r.contracts?.contract_number ?? "—",
      supplier_name: r.contracts?.vendor_name ?? "—",
      epp_status: r.epp_status,
      spend_period: r.spend_period ?? "—",
      total_epp_spend: r.total_epp_spend ?? 0,
      selected: false,
    }))
    setRows(mapped)
    setLoading(false)
  }

  function toggleAll(checked: boolean) {
    setRows(prev => prev.map(r => ({ ...r, selected: checked })))
  }

  function toggleRow(id: string) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r)))
  }

  const selected = rows.filter(r => r.selected)

  async function batchAction(action: "approve" | "reject") {
    if (!selected.length) {
      setMsg({ type: "error", text: "Please select at least one contract." })
      return
    }
    setProcessing(true)

    const nextStatus =
      action === "approve"
        ? statusFilter === "ready_for_epp_admin_review"
          ? "close_for_report"
          : "ready_for_epp_admin_review"
        : "open_for_reporting"

    const ids = selected.map(r => r.id)
    const { error } = await supabase
      .from("epp_contract_cycles")
      .update({ epp_status: nextStatus })
      .in("id", ids)

    if (error) {
      setMsg({ type: "error", text: error.message })
    } else {
      setMsg({
        type: "success",
        text: `${selected.length} EPP contract${selected.length !== 1 ? "s" : ""} ${action === "approve" ? "approved" : "rejected"} successfully.`,
      })
      loadContracts()
    }
    setProcessing(false)
  }

  const STATUS_OPTS = [
    { value: "ready_for_epp_admin_review", label: "Ready for EPP Admin Review" },
    { value: "ready_for_co_review", label: "Ready for CO Review" },
  ]

  const statusColors: Record<string, { bg: string; color: string }> = {
    ready_for_epp_admin_review: { bg: "#fef3c7", color: "#92400e" },
    ready_for_co_review: { bg: "#dbeafe", color: "#1d4ed8" },
    open_for_reporting: { bg: "#dcfce7", color: "#166534" },
    close_for_report: { bg: "#f3f4f6", color: "#374151" },
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/compliance/epp/contracts" style={{ color: "#004B87", fontSize: 13, textDecoration: "none" }}>
              EPP Contracts
            </Link>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>/</span>
            <span style={{ color: "#6b7280", fontSize: 13 }}>Batch Approval</span>
          </div>
          <h1 className="page-title">EPP Contract Batch Approval</h1>
          <p className="page-subtitle">
            Review and batch approve EPP contracts for Environmentally Preferred Products compliance.
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

      {/* Filters + Actions */}
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
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginRight: 8 }}>
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              border: "1px solid #d1d9e6",
              borderRadius: 4,
              padding: "5px 10px",
              fontSize: 13,
              outline: "none",
            }}
          >
            {STATUS_OPTS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {selected.length} selected of {rows.length}
          </span>
          <button
            onClick={() => batchAction("approve")}
            disabled={processing || !selected.length}
            style={{
              padding: "7px 16px",
              backgroundColor: selected.length ? "#16a34a" : "#d1fae5",
              color: selected.length ? "white" : "#9ca3af",
              border: "none",
              borderRadius: 5,
              fontSize: 13,
              fontWeight: 600,
              cursor: selected.length ? "pointer" : "not-allowed",
            }}
          >
            ✓ EPP Approve
          </button>
          <button
            onClick={() => batchAction("reject")}
            disabled={processing || !selected.length}
            style={{
              padding: "7px 16px",
              backgroundColor: selected.length ? "#DA291C" : "#fee2e2",
              color: selected.length ? "white" : "#9ca3af",
              border: "none",
              borderRadius: 5,
              fontSize: 13,
              fontWeight: 600,
              cursor: selected.length ? "pointer" : "not-allowed",
            }}
          >
            ✕ EPP Reject
          </button>
        </div>
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
            Loading contracts…
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "10px 14px", width: 40 }}>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every(r => r.selected)}
                    onChange={e => toggleAll(e.target.checked)}
                  />
                </th>
                {["Contract #", "Supplier Name", "Spend Period", "EPP Total Spend", "Status", "Action"].map(h => (
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
              {rows.map((row, i) => {
                const sColors = statusColors[row.epp_status] ?? { bg: "#f3f4f6", color: "#374151" }
                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #f0f2f5",
                      backgroundColor: row.selected ? "#ecfdf5" : i % 2 === 0 ? "white" : "#fafbfc",
                    }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#004B87" }}>
                      {row.contract_number}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.supplier_name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.spend_period}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>
                      ${(row.total_epp_spend ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 10,
                          backgroundColor: sColors.bg,
                          color: sColors.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.epp_status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Link
                        href={`/compliance/epp/contracts/${row.id}`}
                        style={{
                          padding: "4px 10px",
                          border: "1px solid #004B87",
                          borderRadius: 4,
                          color: "#004B87",
                          backgroundColor: "white",
                          fontSize: 12,
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", fontSize: 13 }}>
            No EPP contracts found with status "{statusFilter.replace(/_/g, " ")}".
          </div>
        )}
      </div>
    </div>
  )
}
