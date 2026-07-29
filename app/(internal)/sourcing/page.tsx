"use client"

import Link from "next/link"

export default function SourcingPage() {
  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Sourcing</h1>
          <p className="page-subtitle">
            Sourcing management module — manage contracts, vendor selection, and procurement activities.
          </p>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "40px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#1a2332" }}>
          Sourcing Module
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 440, margin: "0 auto 24px" }}>
          The Sourcing module integrates with USPS procurement systems to provide contract sourcing
          and vendor management capabilities.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/compliance/subk/contracts"
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
            View SubK Contracts
          </Link>
          <Link
            href="/compliance/epp/contracts"
            style={{
              padding: "8px 20px",
              backgroundColor: "white",
              color: "#004B87",
              border: "1px solid #004B87",
              borderRadius: 5,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View EPP Contracts
          </Link>
        </div>
      </div>
    </div>
  )
}
