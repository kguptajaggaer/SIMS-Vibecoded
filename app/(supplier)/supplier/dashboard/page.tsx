"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, getUser, formatDate } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface QuickStats {
  subkOpen: number;
  subkSubmitted: number;
  eppOpen: number;
}

interface RecentContract {
  id: string;
  contract_number: string;
  supplier_name: string;
  contract_type: string;
  expiration_date?: string;
  latestStatus?: string;
}

export default function SupplierDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<QuickStats>({ subkOpen: 0, subkSubmitted: 0, eppOpen: 0 });
  const [recent, setRecent] = useState<RecentContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.supplier_id) loadData(u.supplier_id);
    else setLoading(false);
  }, []);

  async function loadData(supplierId: string) {
    // Load all contracts for this supplier to get IDs for cycle queries
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, contract_number, supplier_name, contract_type, expiration_date")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(10);

    const allContracts = (contracts || []) as RecentContract[];
    const contractIds = allContracts.map((c) => c.id);

    // Build recent list (last 5), enriched with latest cycle status
    const recentRows: RecentContract[] = [];
    for (const c of allContracts.slice(0, 5)) {
      const { data: latestCycle } = await supabase
        .from("contract_cycles")
        .select("status, supplier_status")
        .eq("contract_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      recentRows.push({
        ...c,
        latestStatus: latestCycle?.supplier_status || latestCycle?.status,
      });
    }

    let subkOpen = 0;
    let subkSubmitted = 0;
    let eppOpen = 0;

    if (contractIds.length) {
      // SubK cycle counts
      const { data: cycles } = await supabase
        .from("contract_cycles")
        .select("supplier_status, contract_id")
        .in("contract_id", contractIds);

      for (const cy of cycles || []) {
        if (cy.supplier_status === "enter_spend_data") subkOpen++;
        if (cy.supplier_status === "supplier_reported") subkSubmitted++;
      }

      // EPP open count — cycles belonging to these contracts
      const { data: cycleIds } = await supabase
        .from("contract_cycles")
        .select("id")
        .in("contract_id", contractIds);

      const allCycleIds = (cycleIds || []).map((r: { id: string }) => r.id);

      if (allCycleIds.length) {
        const { data: eppCycles } = await supabase
          .from("epp_contract_cycles")
          .select("epp_status")
          .in("contract_cycle_id", allCycleIds);

        for (const ec of eppCycles || []) {
          if (
            ec.epp_status === "enter_epp_data" ||
            ec.epp_status === "open_for_reporting"
          ) {
            eppOpen++;
          }
        }
      }
    }

    setStats({ subkOpen, subkSubmitted, eppOpen });
    setRecent(recentRows);
    setLoading(false);
  }

  if (!user) return null;

  return (
    <div>
      {/* Welcome */}
      <div
        style={{
          background: "var(--usps-blue)",
          color: "white",
          borderRadius: 8,
          padding: "20px 24px",
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Welcome, {user.name}
        </h1>
        <p style={{ margin: "6px 0 0", opacity: 0.8, fontSize: 14 }}>
          SIMS Supplier Portal — Manage your SubK and EPP reporting
        </p>
      </div>

      {/* Quick Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "SubK Contracts: Open for Reporting",
            value: stats.subkOpen,
            href: "/supplier/subk/spend-data",
            color: "var(--warning)",
          },
          {
            label: "SubK Contracts: Submitted",
            value: stats.subkSubmitted,
            href: "/supplier/subk/reports",
            color: "var(--success)",
          },
          {
            label: "EPP Contracts: Open",
            value: stats.eppOpen,
            href: "/supplier/epp/enter-data",
            color: "var(--warning)",
          },
        ].map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none" }}>
            <div className="stat-widget" style={{ cursor: "pointer" }}>
              <div className="stat-label">{s.label}</div>
              <div
                className="stat-value"
                style={{ color: s.value > 0 ? s.color : "var(--usps-blue)" }}
              >
                {loading ? "…" : s.value}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card">
          <div className="card-header" style={{ background: "#e8f0f8" }}>
            <h2 className="card-title">SubK Reporting</h2>
          </div>
          <div
            className="card-body"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
              Enter your subcontractor spend data for contracts open for
              reporting.
            </p>
            <Link
              href="/supplier/subk/spend-data"
              className="btn btn-primary"
              style={{ alignSelf: "flex-start" }}
            >
              Enter Spend Data →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ background: "#f0fdf4" }}>
            <h2 className="card-title">EPP Reporting</h2>
          </div>
          <div
            className="card-body"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
              Report your Environmentally Preferred Product purchases.
            </p>
            <Link
              href="/supplier/epp/enter-data"
              className="btn btn-success"
              style={{ alignSelf: "flex-start" }}
            >
              Enter EPP Data →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Contracts */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Contracts</h2>
        </div>
        {loading ? (
          <div
            className="card-body"
            style={{ color: "var(--text-muted)", textAlign: "center" }}
          >
            Loading…
          </div>
        ) : recent.length === 0 ? (
          <div
            className="card-body"
            style={{
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "40px 20px",
            }}
          >
            No contracts found. Contact your USPS Contract Officer.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract No</th>
                <th>Supplier Name</th>
                <th>Type</th>
                <th>Expiration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: "var(--usps-blue)" }}>
                    {c.contract_number}
                  </td>
                  <td>{c.supplier_name}</td>
                  <td>
                    <span className="badge badge-blue">
                      {c.contract_type.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.expiration_date ? formatDate(c.expiration_date) : "—"}
                  </td>
                  <td>
                    {c.latestStatus ? (
                      <span
                        className={`badge ${
                          c.latestStatus === "supplier_reported"
                            ? "badge-green"
                            : c.latestStatus === "enter_spend_data"
                            ? "badge-yellow"
                            : "badge-gray"
                        }`}
                      >
                        {c.latestStatus.replace(/_/g, " ")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
