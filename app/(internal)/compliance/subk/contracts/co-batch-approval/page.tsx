"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase, getUser } from "@/lib/supabase"
import type { User } from "@/lib/types"

type ContractRow = {
  id: string
  contract_number: string
  supplier_name: string
  contract_officer: string
  spend_period: string
  total_spend: number
  selected: boolean
  notes: string
}

export default function SubkCOBatchApprovalPage() {
  const [user, setUser] = useState<User | null>(null)
  const [rows, setRows] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    setUser(getUser())
    loadContracts()
  }, [])

  async function loadContracts() {
    setLoading(true)
    const { data } = await supabase
      .from("contract_cycles")
      .select(`
        id, status, spend_period, total_spend,
        contracts!inner(contract_number, vendor_name, contract_officer)
      `)
      .eq("status", "ready_for_co_review")
      .order("id", { ascending: false })

    const mapped: ContractRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      contract_number: r.contracts?.contract_number ?? "—",
      supplier_name: r.contracts?.vendor_name ?? "—",
      contract_officer: r.contracts?.contract_officer ?? "—",
      spend_period: r.spend_period ?? "—",
      total_spend: r.total_spend ?? 0,
      selected: false,
      notes: "",
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

  async function batchApprove() {
    if (!selected.length) {
      setMsg({ type: "error", text: "Please select at least one contract." })
      return
    }
    setProcessing(true)
    const ids = selected.map(r => r.id)
    const { error } = await supabase
      .from("contract_cycles")
      .update({ status: "ready_for_portfolio_review" })
      .in("id", ids)

    if (error) {
      setMsg({ type: "error", text: error.message })
    } else {
      setMsg({
        type: "success",
        text: `${selected.length} contract${selected.length !== 1 ? "s" : ""} approved by CO and moved to Portfolio Review.`,
      })
      loadContracts()
    }
    setProcessing(false)
  }

  async function batchReject() {
    if (!selected.length) {
      setMsg({ type: "error", text: "Please select at least one contract." })
      setShowRejectModal(false)
      return
    }
    setProcessing(true)
    const ids = selected.map(r => r.id)
    const { error } = await supabase
      .from("contract_cycles")
      .update({ status: "open_for_reporting", co_rejection_note: rejectNote })
      .in("id", ids)

    setShowRejectModal(false)
    setRejectNote("")
    if (error) {
      setMsg({ type: "error", text: error.message })
    } else {
      setMsg({
        type: "success",
        text: `${selected.length} contract${selected.length !== 1 ? "s" : ""} rejected and returned to supplier.`,
      })
      loadContracts()
    }
    setProcessing(false)
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/compliance/subk/contracts" style={{ color: "#004B87", fontSize: 13, textDecoration: "none" }}>
              SubK Contracts
            </Link>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>/</span>
            <span style={{ color: "#6b7280", fontSize: 13 }}>CO Batch Approval</span>
          </div>
          <h1 className="page-title">SubK Contract CO Batch Approval</h1>
          <p className="page-subtitle">
            Review contracts submitted by suppliers and batch approve or reject as Contract Officer.
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

      {/* Info banner */}
      <div
        style={{
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 5,
          fontSize: 12,
          backgroundColor: "#eff6ff",
          color: "#1e40af",
          border: "1px solid #bfdbfe",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span>ℹ️</span>
        <div>
          <strong>CO Review Queue</strong> — These contracts have been submitted by suppliers and are awaiting
          Contract Officer review. Approving will move them to Portfolio Review. Rejecting will return them to
          the supplier with status "Open for Reporting".
        </div>
      </div>

      {/* Actions bar */}
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2332" }}>
            Ready for CO Review
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: "#dbeafe",
              color: "#1d4ed8",
              padding: "2px 8px",
              borderRadius: 10,
            }}
          >
            {rows.length} contracts
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {selected.length} selected
          </span>
          <button
            onClick={batchApprove}
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
            ✓ CO Approve
          </button>
          <button
            onClick={() => {
              if (!selected.length) {
                setMsg({ type: "error", text: "Select at least one contract to reject." })
                return
              }
              setShowRejectModal(true)
            }}
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
            ✕ CO Reject
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "10px 14px", width: 40 }}>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every(r => r.selected)}
                    onChange={e => toggleAll(e.target.checked)}
                  />
                </th>
                {["Contract #", "Supplier Name", "Contract Officer", "Spend Period", "Total Spend", "Action"].map(h => (
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
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.contract_officer}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.spend_period}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    ${(row.total_spend ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Link
                        href={`/compliance/subk/contracts/${row.id}`}
                        style={{
                          padding: "4px 10px",
                          border: "1px solid #004B87",
                          borderRadius: 4,
                          color: "#004B87",
                          backgroundColor: "white",
                          fontSize: 12,
                          cursor: "pointer",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", fontSize: 13 }}>
            No contracts pending CO review.
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
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
          onClick={() => setShowRejectModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              padding: 28,
              width: 460,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#DA291C" }}>
              Reject {selected.length} Contract{selected.length !== 1 ? "s" : ""}
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
              These contracts will be returned to the supplier with status "Open for Reporting".
            </p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Rejection Reason (optional)
            </label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={4}
              placeholder="Enter reason for rejection..."
              style={{
                width: "100%",
                border: "1px solid #d1d9e6",
                borderRadius: 4,
                padding: "8px 10px",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 5,
                  backgroundColor: "white",
                  color: "#6b7280",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={batchReject}
                disabled={processing}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: 5,
                  backgroundColor: "#DA291C",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
