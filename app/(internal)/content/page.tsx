"use client"

import { useState } from "react"
import Link from "next/link"

type ContentPage = {
  id: string
  title: string
  slug: string
  type: "internal" | "external"
  status: "active" | "inactive"
  lastModified: string
}

const SAMPLE_PAGES: ContentPage[] = [
  { id: "1", title: "Dashboard Help Text", slug: "dashboard-help", type: "internal", status: "active", lastModified: "2025-01-15" },
  { id: "2", title: "SubK Reporting Instructions", slug: "subk-instructions", type: "internal", status: "active", lastModified: "2025-02-10" },
  { id: "3", title: "EPP Supplier Guide", slug: "epp-guide", type: "external", status: "active", lastModified: "2025-03-01" },
  { id: "4", title: "Policy 603 Summary", slug: "policy-603", type: "external", status: "active", lastModified: "2024-12-20" },
  { id: "5", title: "Supplier Registration FAQ", slug: "registration-faq", type: "internal", status: "inactive", lastModified: "2024-11-05" },
]

export default function ContentPage() {
  const [pages] = useState<ContentPage[]>(SAMPLE_PAGES)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)

  const filtered = pages.filter(
    p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Content Management</h1>
          <p className="page-subtitle">Manage internal pages and external content links shown throughout SIMS.</p>
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
          + Add Content Page
        </button>
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
        }}
      >
        <input
          type="text"
          placeholder="Search pages..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            border: "1px solid #d1d9e6",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 13,
            width: 280,
            outline: "none",
          }}
        />
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {filtered.length} page{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
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
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              {["Title", "Slug", "Type", "Status", "Last Modified", "Actions"].map(h => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#374151",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((page, i) => (
              <tr
                key={page.id}
                style={{
                  borderBottom: "1px solid #f0f2f5",
                  backgroundColor: i % 2 === 0 ? "white" : "#fafbfc",
                }}
              >
                <td style={{ padding: "10px 14px", fontSize: 13, color: "#1a2332", fontWeight: 500 }}>
                  {page.title}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
                  /{page.slug}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: page.type === "internal" ? "#dbeafe" : "#f3e8ff",
                      color: page.type === "internal" ? "#1d4ed8" : "#7c3aed",
                    }}
                  >
                    {page.type}
                  </span>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: page.status === "active" ? "#dcfce7" : "#fee2e2",
                      color: page.status === "active" ? "#166534" : "#991b1b",
                    }}
                  >
                    {page.status}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                  {page.lastModified}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        padding: "4px 10px",
                        border: "1px solid #004B87",
                        borderRadius: 4,
                        color: "#004B87",
                        backgroundColor: "white",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      style={{
                        padding: "4px 10px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        color: "#6b7280",
                        backgroundColor: "white",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", fontSize: 13 }}>
            No pages found.
          </div>
        )}
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
              width: 480,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#1a2332" }}>
              Add Content Page
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Page Title", name: "title", type: "text" },
                { label: "Slug", name: "slug", type: "text" },
                { label: "URL / Path", name: "url", type: "text" },
              ].map(field => (
                <div key={field.name}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    style={{
                      width: "100%",
                      border: "1px solid #d1d9e6",
                      borderRadius: 4,
                      padding: "8px 10px",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Type
                </label>
                <select
                  style={{
                    width: "100%",
                    border: "1px solid #d1d9e6",
                    borderRadius: 4,
                    padding: "8px 10px",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setShowAdd(false)}
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
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: 5,
                  backgroundColor: "#004B87",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
