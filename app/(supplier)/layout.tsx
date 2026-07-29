"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

interface SimsUser {
  user_type: string;
  supplier_name?: string;
  [key: string]: unknown;
}

interface NavItem {
  label: string;
  href: string;
  readOnly?: boolean;
}

interface NavSection {
  icon: string;
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    icon: "📋",
    title: "SUBK MENU",
    items: [
      { label: "SubK Diverse Suppliers", href: "/supplier/subk/diverse-suppliers" },
      { label: "Enter Spend Data", href: "/supplier/subk/spend-data" },
      { label: "SubK Report Summary", href: "/supplier/subk/reports" },
    ],
  },
  {
    icon: "🌿",
    title: "EPP MENU",
    items: [
      { label: "Enter EPP Data", href: "/supplier/epp/enter-data" },
      { label: "EPP Report Summary", href: "/supplier/epp/reports" },
      { label: "Add SubK Contracts to EPP", href: "/supplier/epp/add-subk" },
    ],
  },
  {
    icon: "📊",
    title: "SUPPLIER PERFORMANCE",
    items: [
      { label: "Development Plan", href: "/supplier/performance/development-plans", readOnly: true },
      { label: "Scorecard", href: "/supplier/performance/scorecards", readOnly: true },
      { label: "Performance Review", href: "/supplier/performance/reviews", readOnly: true },
    ],
  },
];

const STANDALONE_ITEMS = [
  { icon: "👥", label: "ADDITIONAL CONTACTS", href: "/supplier/contacts" },
  { icon: "📝", label: "EXTENDED PROFILE", href: "/supplier/profile" },
  { icon: "🔑", label: "CHANGE PASSWORD", href: "/supplier/change-password" },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [supplierName, setSupplierName] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sims_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    let user: SimsUser;
    try {
      user = JSON.parse(raw) as SimsUser;
    } catch {
      router.replace("/login");
      return;
    }
    if (user.user_type !== "supplier") {
      router.replace("/login");
      return;
    }
    setSupplierName(user.supplier_name ?? "");
    setReady(true);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("sims_user");
    router.replace("/login");
  }

  if (!ready) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          minWidth: 240,
          backgroundColor: "#004B87",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          overflowY: "auto",
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "24px 20px 8px",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 4,
            color: "#ffffff",
            flexShrink: 0,
          }}
        >
          SIMS
        </div>

        {/* Supplier name */}
        {supplierName && (
          <div
            style={{
              padding: "4px 20px 16px",
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
              borderBottom: "1px solid rgba(255,255,255,0.15)",
              wordBreak: "break-word",
              flexShrink: 0,
            }}
          >
            {supplierName}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, paddingBottom: 16 }}>
          {/* WELCOME header */}
          <div
            style={{
              padding: "16px 20px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase",
            }}
          >
            WELCOME
          </div>

          {/* Sections */}
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 4 }}>
              {/* Section header */}
              <div
                style={{
                  padding: "10px 20px 4px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  color: "rgba(255,255,255,0.6)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  textTransform: "uppercase",
                }}
              >
                <span style={{ fontSize: 13 }}>{section.icon}</span>
                <span>{section.title}</span>
              </div>

              {/* Section items */}
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 16px 7px 36px",
                      fontSize: 13,
                      color: "#ffffff",
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.15)"
                        : "transparent",
                      textDecoration: "none",
                      borderLeft: isActive
                        ? "3px solid #ffffff"
                        : "3px solid transparent",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                          "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                          "transparent";
                    }}
                  >
                    <span style={{ opacity: isActive ? 1 : 0.8 }}>{item.label}</span>
                    {item.readOnly && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.4)",
                          marginLeft: 4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        read-only
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Standalone items */}
          <div
            style={{
              marginTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.15)",
              paddingTop: 8,
            }}
          >
            {STANDALONE_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.15)"
                      : "transparent",
                    textDecoration: "none",
                    borderLeft: isActive
                      ? "3px solid #ffffff"
                      : "3px solid transparent",
                    transition: "background-color 0.15s",
                    opacity: isActive ? 1 : 0.85,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                        "rgba(255,255,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                        "transparent";
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                backgroundColor: "transparent",
                border: "none",
                borderLeft: "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                opacity: 0.85,
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "transparent";
              }}
            >
              <span style={{ fontSize: 15 }}>🚪</span>
              <span>LOGOUT</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          marginLeft: 240,
          padding: 24,
          backgroundColor: "#f1f4f8",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
