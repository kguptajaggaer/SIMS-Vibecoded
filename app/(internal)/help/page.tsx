"use client"

import Link from "next/link"

const guides = [
  {
    category: "User Guides",
    items: [
      {
        title: "SCRMS User Guide",
        description: "Complete guide for using the SCRMS (Supplier Compliance Reporting Management System) module.",
        icon: "📘",
        href: "#",
      },
      {
        title: "Supplier User Guide",
        description: "Step-by-step instructions for supplier portal users to enter spend data and EPP information.",
        icon: "📗",
        href: "#",
      },
      {
        title: "SubK Reporting Tips",
        description: "Best practices and tips for accurate SubK subcontractor reporting.",
        icon: "📙",
        href: "#",
      },
      {
        title: "EPP Supplier User Guide",
        description: "Guide for suppliers on how to complete EPP (Environmentally Preferred Products) data entry.",
        icon: "📕",
        href: "#",
      },
    ],
  },
  {
    category: "Policy Information Links",
    items: [
      {
        title: "3-1: Small, Minority-, and Woman-owned Business Subcontracting Requirements (Policy 603)",
        description: "USPS Policy 603 – Requirements for subcontracting with small, minority-owned, and woman-owned businesses.",
        icon: "⚖️",
        href: "#",
      },
      {
        title: "3-2: Participation of Small, Minority-, and Woman-owned Businesses (Policy 604)",
        description: "USPS Policy 604 – Guidelines for the participation of diverse businesses in USPS contracts.",
        icon: "⚖️",
        href: "#",
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">User Guides &amp; Help Links</h1>
          <p className="page-subtitle">
            Reference materials, policy documents, and guides for SIMS users.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {guides.map(section => (
          <div
            key={section.category}
            style={{
              border: "1px solid #c5d0de",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {/* Section header */}
            <div
              style={{
                backgroundColor: "#004B87",
                color: "white",
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.03em",
              }}
            >
              {section.category}
            </div>

            {/* Items */}
            <div style={{ backgroundColor: "white" }}>
              {section.items.map((item, idx) => (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "14px 20px",
                    borderBottom:
                      idx < section.items.length - 1
                        ? "1px solid #f0f2f5"
                        : "none",
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <a
                      href={item.href}
                      style={{
                        color: "#004B87",
                        fontWeight: 600,
                        fontSize: 14,
                        textDecoration: "none",
                      }}
                      onMouseEnter={e =>
                        ((e.target as HTMLAnchorElement).style.textDecoration = "underline")
                      }
                      onMouseLeave={e =>
                        ((e.target as HTMLAnchorElement).style.textDecoration = "none")
                      }
                    >
                      {item.title}
                    </a>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5a6a7e" }}>
                      {item.description}
                    </p>
                  </div>
                  <a
                    href={item.href}
                    style={{
                      padding: "5px 12px",
                      backgroundColor: "#004B87",
                      color: "white",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: "none",
                      flexShrink: 0,
                      alignSelf: "center",
                    }}
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div
        style={{
          marginTop: 24,
          backgroundColor: "#eef5ff",
          border: "1px solid #b8d0ef",
          borderRadius: 6,
          padding: "16px 20px",
        }}
      >
        <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#004B87", fontWeight: 700 }}>
          Quick Links
        </h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "SubK Contracts", href: "/compliance/subk/contracts" },
            { label: "EPP Contracts", href: "/compliance/epp/contracts" },
            { label: "SubK Reports", href: "/compliance/subk/reports" },
            { label: "EPP Reports", href: "/compliance/epp/reports" },
            { label: "Supplier Performance", href: "/supplier-performance/suppliers" },
            { label: "Admin Settings", href: "/administrator" },
          ].map(link => (
            <Link
              key={link.label}
              href={link.href}
              style={{
                padding: "5px 12px",
                backgroundColor: "white",
                border: "1px solid #b8d0ef",
                borderRadius: 4,
                color: "#004B87",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
