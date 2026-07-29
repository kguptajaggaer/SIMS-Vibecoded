"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase, formatDateShort } from "@/lib/supabase"
import type { Supplier } from "@/lib/types"

type ContractRow = {
  id: string
  contract_number: string
  contract_type: string
  status: string
  start_date: string | null
  expiration_date: string | null
  contract_officer: string | null
}

export default function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "contracts" | "contacts" | "performance">("overview")

  useEffect(() => {
    loadData()
  }, [supplierId])

  async function loadData() {
    setLoading(true)
    const [{ data: s }, { data: cs }, { data: co }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", supplierId).single(),
      supabase
        .from("contracts")
        .select("id, contract_number, contract_type, start_date, expiration_date, contract_officer, contract_cycles(status)")
        .or(`supplier_apex.eq.${supplierId},vendor_name.ilike.%supplier%`)
        .limit(20),
      supabase
        .from("supplier_contacts")
        .select("*")
        .eq("supplier_id", supplierId),
    ])
    setSupplier(s)
    setContracts((cs ?? []).map((c: any) => ({
      id: c.id,
      contract_number: c.contract_number,
      contract_type: c.contract_type,
      status: c.contract_cycles?.[0]?.status ?? "new_contract",
      start_date: c.start_date,
      expiration_date: c.expiration_date,
      contract_officer: c.contract_officer,
    })))
    setContacts(co ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", fontSize: 14 }}>
        Loading supplier…
      </div>
    )
  }

  if (!supplier) {
    return (
      <div style={{ textAlign: "center", padding: "60px" }}>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Supplier not found.</p>
        <Link href="/suppliers" style={{ color: "#004B87", fontSize: 13 }}>← Back to Suppliers</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <Link href="/suppliers" style={{ color: "#004B87", textDecoration: "none" }}>Suppliers</Link>
        <span style={{ color: "#9ca3af" }}>/</span>
        <span style={{ color: "#6b7280" }}>{supplier.name}</span>
      </div>

      {/* Profile Header */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "20px 24px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#1a2332" }}>
              {supplier.name}
            </h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {supplier.apex_number && (
                <span
                  style={{
                    fontSize: 12,
                    backgroundColor: "#f1f5f9",
                    color: "#374151",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                  }}
                >
                  APEX: {supplier.apex_number}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                  backgroundColor:
                    supplier.status === "active" ? "#dcfce7" :
                    supplier.status === "prospective" ? "#fef3c7" :
                    "#f3f4f6",
                  color:
                    supplier.status === "active" ? "#166534" :
                    supplier.status === "prospective" ? "#92400e" :
                    "#6b7280",
                }}
              >
                {supplier.status}
              </span>
              {supplier.is_diverse && (
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
                  Diverse Supplier
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/suppliers/${supplierId}/edit`}
              style={{
                padding: "7px 14px",
                border: "1px solid #d1d9e6",
                borderRadius: 5,
                color: "#374151",
                backgroundColor: "white",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Edit Profile
            </Link>
            <Link
              href={`/supplier-performance/suppliers/${supplierId}/development-plans`}
              style={{
                padding: "7px 14px",
                border: "none",
                borderRadius: 5,
                backgroundColor: "#004B87",
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Scorecard
            </Link>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          {[
            { label: "Address", value: supplier.address },
            { label: "City", value: supplier.city },
            { label: "State", value: supplier.state },
            { label: "ZIP", value: supplier.zip },
          ]
            .filter(f => f.value)
            .map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 13, color: "#1a2332" }}>{f.value}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {(["overview", "contracts", "contacts", "performance"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "7px 16px",
              borderRadius: 5,
              border: "1px solid",
              borderColor: activeTab === tab ? "#004B87" : "#e5e7eb",
              backgroundColor: activeTab === tab ? "#004B87" : "white",
              color: activeTab === tab ? "white" : "#374151",
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "20px 24px",
          }}
        >
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#1a2332" }}>
            Supplier Overview
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Diversity Classifications
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(supplier.diversity_classifications ?? []).length === 0 && (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>No diversity classifications</span>
                )}
                {(supplier.diversity_classifications ?? []).map(cls => (
                  <span key={cls} style={{ fontSize: 12, backgroundColor: "#dbeafe", color: "#1d4ed8", padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>
                    {cls.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                Contract Summary
              </div>
              <div style={{ fontSize: 13, color: "#374151" }}>
                {contracts.length} contract{contracts.length !== 1 ? "s" : ""} on record
              </div>
            </div>
          </div>
          {supplier.notes && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>Notes</div>
              <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "contracts" && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Contract #", "Type", "Status", "Start", "Expiration", "CO", "Action"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    No contracts found for this supplier.
                  </td>
                </tr>
              ) : (
                contracts.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f0f2f5", backgroundColor: i % 2 === 0 ? "white" : "#fafbfc" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#004B87" }}>{c.contract_number}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>
                      <span style={{ backgroundColor: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                        {c.contract_type?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.status?.replace(/_/g, " ")}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{c.start_date ? formatDateShort(c.start_date) : "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{c.expiration_date ? formatDateShort(c.expiration_date) : "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.contract_officer ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Link href={`/compliance/subk/contracts/${c.id}`} style={{ padding: "4px 10px", border: "1px solid #004B87", borderRadius: 4, color: "#004B87", fontSize: 12, textDecoration: "none" }}>View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "contacts" && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2332" }}>Supplier Contacts</span>
          </div>
          {contacts.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No contacts on file for this supplier.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {["Name", "Title", "Email", "Phone", "Primary"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f0f2f5", backgroundColor: i % 2 === 0 ? "white" : "#fafbfc" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{c.title ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.email ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.phone ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {c.is_primary && <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 10 }}>Primary</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "performance" && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px" }}>
            View the full supplier performance scorecard and development plans.
          </p>
          <Link
            href={`/supplier-performance/suppliers/${supplierId}/development-plans`}
            style={{
              padding: "8px 20px",
              backgroundColor: "#004B87",
              color: "white",
              borderRadius: 5,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open Supplier Performance →
          </Link>
        </div>
      )}
    </div>
  )
}
