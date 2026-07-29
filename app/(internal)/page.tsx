"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { supabase, getUser } from "@/lib/supabase"
import type { User } from "@/lib/types"

// ─── Count helpers ───────────────────────────────────────────────────────────

function countByKey(rows: Record<string, unknown>[], key: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const v = String(row[key] ?? "unknown")
    counts[v] = (counts[v] ?? 0) + 1
  }
  return counts
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubkCounts {
  new_contract: number
  open_for_reporting: number
  ready_for_co_review: number
  ready_for_portfolio_review: number
  ready_for_diversity_review: number
  data_available_export: number
  total_portfolio_approval: number
  close_for_report: number
  closed: number
  pending_next_period: number
}

interface EppCounts {
  new_contract: number
  open_for_reporting: number
  ready_for_co_review: number
  ready_for_epp_admin_review: number
  close_for_report: number
  closed: number
  pending_next_period: number
  finalized: number
}

interface ScorecardCounts {
  development_plans: number
  scorecards: number
  performance_reviews: number
}

interface SupplierOverview {
  total: number
  diverse: number
}

const ZERO_SUBK: SubkCounts = {
  new_contract: 0, open_for_reporting: 0, ready_for_co_review: 0,
  ready_for_portfolio_review: 0, ready_for_diversity_review: 0,
  data_available_export: 0, total_portfolio_approval: 0,
  close_for_report: 0, closed: 0, pending_next_period: 0,
}

const ZERO_EPP: EppCounts = {
  new_contract: 0, open_for_reporting: 0, ready_for_co_review: 0,
  ready_for_epp_admin_review: 0, close_for_report: 0,
  closed: 0, pending_next_period: 0, finalized: 0,
}

// ─── UI Atoms ────────────────────────────────────────────────────────────────

function StatBox({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", flex: "1 1 100px", minWidth: 80 }}>
      <div
        style={{
          background: "white",
          border: "1px solid #d1d9e6",
          borderRadius: 4,
          padding: "10px 8px",
          textAlign: "center",
          cursor: "pointer",
          transition: "box-shadow 0.15s, border-color 0.15s",
          height: "100%",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,75,135,0.15)"
          e.currentTarget.style.borderColor = "#004B87"
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = "none"
          e.currentTarget.style.borderColor = "#d1d9e6"
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: "#004B87", lineHeight: 1.1 }}>{count}</div>
        <div style={{ fontSize: 11, color: "#5a6a7e", marginTop: 4, lineHeight: 1.3 }}>{label}</div>
      </div>
    </Link>
  )
}

function StatRow({ boxes }: { boxes: { count: number; label: string; href: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      {boxes.map(b => (
        <StatBox key={b.label} count={b.count} label={b.label} href={b.href} />
      ))}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      background: "#004B87",
      color: "white",
      padding: "7px 12px",
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: "0.02em",
    }}>
      {title}
    </div>
  )
}

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16, border: "1px solid #c5d0de", borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader title={title} />
      <div style={{ background: "#eef2f7", padding: "10px 10px 4px" }}>
        {children}
      </div>
    </div>
  )
}

function RightStatBox({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "white",
          border: "1px solid #d1d9e6",
          borderRadius: 4,
          padding: "8px 12px",
          marginBottom: 6,
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#004B87")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#d1d9e6")}
      >
        <span style={{ fontSize: 12, color: "#1a2b3c" }}>{label}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#004B87", minWidth: 36, textAlign: "right" }}>{count}</span>
      </div>
    </Link>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InternalDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [subkAll, setSubkAll] = useState<SubkCounts>(ZERO_SUBK)
  const [subkMine, setSubkMine] = useState<SubkCounts>(ZERO_SUBK)
  const [epp, setEpp] = useState<EppCounts>(ZERO_EPP)
  const [ibp, setIbp] = useState<ScorecardCounts>({ development_plans: 0, scorecards: 0, performance_reviews: 0 })
  const [pm, setPm] = useState<ScorecardCounts>({ development_plans: 0, scorecards: 0, performance_reviews: 0 })
  const [cmc, setCmc] = useState<ScorecardCounts>({ development_plans: 0, scorecards: 0, performance_reviews: 0 })
  const [sr, setSr] = useState<ScorecardCounts>({ development_plans: 0, scorecards: 0, performance_reviews: 0 })
  const [suppliers, setSuppliers] = useState<SupplierOverview>({ total: 0, diverse: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUser()
    setUser(u)
    loadDashboard(u)
  }, [])

  async function loadDashboard(u: User | null) {
    setLoading(true)
    await Promise.all([
      fetchSubkCounts(u),
      fetchEppCounts(),
      fetchScorecardCounts(),
      fetchSupplierCounts(),
    ])
    setLoading(false)
  }

  async function fetchSubkCounts(u: User | null) {
    // All contract cycles
    const { data: allRows } = await supabase
      .from("contract_cycles")
      .select("status")

    const c = countByKey((allRows ?? []) as Record<string, unknown>[], "status")
    const totalAll = (allRows ?? []).length
    setSubkAll({
      new_contract: c.new_contract ?? 0,
      open_for_reporting: c.open_for_reporting ?? 0,
      ready_for_co_review: c.ready_for_co_review ?? 0,
      ready_for_portfolio_review: c.ready_for_portfolio_review ?? 0,
      ready_for_diversity_review: c.ready_for_diversity_review ?? 0,
      data_available_export: c.data_available_export ?? 0,
      total_portfolio_approval: totalAll,
      close_for_report: c.close_for_report ?? 0,
      closed: c.closed ?? 0,
      pending_next_period: c.pending_next_period ?? 0,
    })

    // My contract cycles — filtered by contract_officer_email
    if (u?.email) {
      const { data: myRows } = await supabase
        .from("contract_cycles")
        .select("status, contracts!inner(contract_officer_email)")
        .eq("contracts.contract_officer_email", u.email)

      const mc = countByKey((myRows ?? []) as Record<string, unknown>[], "status")
      const totalMine = (myRows ?? []).length
      setSubkMine({
        new_contract: mc.new_contract ?? 0,
        open_for_reporting: mc.open_for_reporting ?? 0,
        ready_for_co_review: mc.ready_for_co_review ?? 0,
        ready_for_portfolio_review: mc.ready_for_portfolio_review ?? 0,
        ready_for_diversity_review: mc.ready_for_diversity_review ?? 0,
        data_available_export: mc.data_available_export ?? 0,
        total_portfolio_approval: totalMine,
        close_for_report: mc.close_for_report ?? 0,
        closed: mc.closed ?? 0,
        pending_next_period: mc.pending_next_period ?? 0,
      })
    }
  }

  async function fetchEppCounts() {
    const { data } = await supabase
      .from("epp_contract_cycles")
      .select("epp_status")

    const c = countByKey((data ?? []) as Record<string, unknown>[], "epp_status")
    setEpp({
      new_contract: c.new_contract ?? 0,
      open_for_reporting: c.open_for_reporting ?? 0,
      ready_for_co_review: c.ready_for_co_review ?? 0,
      ready_for_epp_admin_review: c.ready_for_epp_admin_review ?? 0,
      close_for_report: c.close_for_report ?? 0,
      closed: c.closed ?? 0,
      pending_next_period: c.pending_next_period ?? 0,
      finalized: c.finalized ?? 0,
    })
  }

  async function fetchScorecardCounts() {
    const [plansRes, scorecardsRes, reviewsRes] = await Promise.all([
      supabase.from("development_plans").select("id", { count: "exact", head: true }),
      supabase.from("scorecards").select("id", { count: "exact", head: true }),
      supabase.from("performance_reviews").select("id", { count: "exact", head: true }),
    ])
    const counts: ScorecardCounts = {
      development_plans: plansRes.count ?? 0,
      scorecards: scorecardsRes.count ?? 0,
      performance_reviews: reviewsRes.count ?? 0,
    }
    setIbp(counts)
    setPm(counts)
    setCmc(counts)
    setSr(counts)
  }

  async function fetchSupplierCounts() {
    const [totalRes, diverseRes] = await Promise.all([
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_diverse", true),
    ])
    setSuppliers({ total: totalRes.count ?? 0, diverse: diverseRes.count ?? 0 })
  }

  const SK = "/compliance/subk/contracts?status="
  const EP = "/compliance/epp/contracts?status="
  const SP = "/supplier-performance/suppliers"

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">SIMS Home</h1>
          <p className="page-subtitle">
            Welcome{user ? `, ${user.name}` : ""}. Reporting Period: 2025 MDFY
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0", fontSize: 14 }}>
          Loading dashboard data…
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div>

            {/* SubK Data and Reporting */}
            <DashboardSection title="SubK Data and Reporting (2025 MDFY)">
              <StatRow boxes={[
                { count: subkAll.new_contract,              label: "New Contract",               href: `${SK}new_contract` },
                { count: subkAll.open_for_reporting,        label: "Open for Reporting",         href: `${SK}open_for_reporting` },
                { count: subkAll.ready_for_co_review,       label: "Ready for CO Review",        href: `${SK}ready_for_co_review` },
                { count: subkAll.ready_for_portfolio_review,label: "Ready for Portfolio Review", href: `${SK}ready_for_portfolio_review` },
              ]} />
              <StatRow boxes={[
                { count: subkAll.ready_for_diversity_review, label: "Ready for Diversity Review",    href: `${SK}ready_for_diversity_review` },
                { count: subkAll.data_available_export,      label: "Data Available for Export",     href: `${SK}data_available_export` },
                { count: subkAll.total_portfolio_approval,   label: "Total Portfolio Approval List", href: "/compliance/subk/contracts" },
              ]} />
              <StatRow boxes={[
                { count: subkAll.close_for_report,    label: "Close for Report",       href: `${SK}close_for_report` },
                { count: subkAll.closed,              label: "Closed Contract",         href: `${SK}closed` },
                { count: subkAll.pending_next_period, label: "Pending for Next Period", href: `${SK}pending_next_period` },
              ]} />
            </DashboardSection>

            {/* My SubK Task List */}
            <DashboardSection title="My SubK Task List (2025 MDFY)">
              <StatRow boxes={[
                { count: subkMine.new_contract,              label: "New Contract",               href: `${SK}new_contract` },
                { count: subkMine.open_for_reporting,        label: "Open for Reporting",         href: `${SK}open_for_reporting` },
                { count: subkMine.ready_for_co_review,       label: "Ready for CO Review",        href: `${SK}ready_for_co_review` },
                { count: subkMine.ready_for_portfolio_review,label: "Ready for Portfolio Review", href: `${SK}ready_for_portfolio_review` },
              ]} />
              <StatRow boxes={[
                { count: subkMine.ready_for_diversity_review, label: "Ready for Diversity Review",    href: `${SK}ready_for_diversity_review` },
                { count: subkMine.data_available_export,      label: "Data Available for Export",     href: `${SK}data_available_export` },
                { count: subkMine.total_portfolio_approval,   label: "Total Portfolio Approval List", href: "/compliance/subk/contracts" },
              ]} />
              <StatRow boxes={[
                { count: subkMine.close_for_report,    label: "Close for Report",       href: `${SK}close_for_report` },
                { count: subkMine.closed,              label: "Closed Contract",         href: `${SK}closed` },
                { count: subkMine.pending_next_period, label: "Pending for Next Period", href: `${SK}pending_next_period` },
              ]} />
            </DashboardSection>

            {/* EPP Data and Reporting */}
            <DashboardSection title="EPP Data and Reporting (2025 MDFY)">
              <StatRow boxes={[
                { count: epp.new_contract,             label: "New Contract",              href: `${EP}new_contract` },
                { count: epp.open_for_reporting,       label: "Open for Reporting",        href: `${EP}open_for_reporting` },
                { count: epp.ready_for_co_review,      label: "Ready for CO Review",       href: `${EP}ready_for_co_review` },
                { count: epp.ready_for_epp_admin_review, label: "Ready for EPP Admin Review", href: `${EP}ready_for_epp_admin_review` },
              ]} />
              <StatRow boxes={[
                { count: epp.close_for_report,    label: "Close for Report",             href: `${EP}close_for_report` },
                { count: epp.closed,              label: "Closed Contract",               href: `${EP}closed` },
                { count: epp.pending_next_period, label: "Pending for Next Period",       href: `${EP}pending_next_period` },
                { count: epp.finalized,           label: "Reports Finalized by EPP Admin", href: `${EP}finalized` },
              ]} />
            </DashboardSection>

          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div>

            {/* IBP Scorecard Task List */}
            <DashboardSection title="IBP Scorecard Task List">
              <RightStatBox count={ibp.development_plans}  label="Development Plans"   href={`${SP}?view=development_plans`} />
              <RightStatBox count={ibp.scorecards}         label="Scorecards"           href={`${SP}?view=scorecards`} />
              <RightStatBox count={ibp.performance_reviews}label="Performance Reviews"  href={`${SP}?view=performance_reviews`} />
            </DashboardSection>

            {/* Portfolio Manager Scorecard Task List */}
            <DashboardSection title="Portfolio Manager Scorecard Task List">
              <RightStatBox count={pm.development_plans}  label="Development Plans"   href={`${SP}?view=development_plans&role=portfolio_manager`} />
              <RightStatBox count={pm.scorecards}         label="Scorecards"           href={`${SP}?view=scorecards&role=portfolio_manager`} />
              <RightStatBox count={pm.performance_reviews}label="Performance Reviews"  href={`${SP}?view=performance_reviews&role=portfolio_manager`} />
            </DashboardSection>

            {/* CMC Manager Scorecard Task List */}
            <DashboardSection title="CMC Manager Scorecard Task List">
              <RightStatBox count={cmc.development_plans}  label="Development Plans"   href={`${SP}?view=development_plans&role=cmc_manager`} />
              <RightStatBox count={cmc.scorecards}         label="Scorecards"           href={`${SP}?view=scorecards&role=cmc_manager`} />
              <RightStatBox count={cmc.performance_reviews}label="Performance Reviews"  href={`${SP}?view=performance_reviews&role=cmc_manager`} />
            </DashboardSection>

            {/* SR Manager Scorecard Task List */}
            <DashboardSection title="SR Manager Scorecard Task List">
              <RightStatBox count={sr.development_plans}  label="Development Plans"   href={`${SP}?view=development_plans&role=sr_manager`} />
              <RightStatBox count={sr.scorecards}         label="Scorecards"           href={`${SP}?view=scorecards&role=sr_manager`} />
              <RightStatBox count={sr.performance_reviews}label="Performance Reviews"  href={`${SP}?view=performance_reviews&role=sr_manager`} />
            </DashboardSection>

            {/* Supplier Overview */}
            <DashboardSection title="Supplier Overview">
              <RightStatBox count={suppliers.total}  label="Total Suppliers"         href="/suppliers" />
              <RightStatBox count={suppliers.diverse}label="Total Diverse Suppliers" href="/suppliers?diverse=true" />
            </DashboardSection>

            {/* User Guides & Help Links */}
            <div style={{ marginBottom: 16, border: "1px solid #c5d0de", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ background: "#004B87", color: "white", padding: "7px 12px", fontWeight: 700, fontSize: 12, letterSpacing: "0.02em" }}>
                User Guides &amp; Help Links
              </div>
              <div style={{ background: "#eef2f7", padding: "8px 10px" }}>
                {[
                  { label: "SCRMS User Guide", href: "/help" },
                  { label: "Supplier User Guide", href: "/help" },
                  { label: "SubK Reporting Tips", href: "/help" },
                  { label: "EPP Supplier User Guide", href: "/help" },
                  { label: "Policy 603 – Small Business Subcontracting", href: "/help" },
                  { label: "Policy 604 – Diverse Business Participation", href: "/help" },
                ].map(link => (
                  <Link
                    key={link.label}
                    href={link.href}
                    style={{
                      display: "block",
                      padding: "5px 8px",
                      marginBottom: 3,
                      background: "white",
                      border: "1px solid #d1d9e6",
                      borderRadius: 3,
                      fontSize: 12,
                      color: "#004B87",
                      textDecoration: "none",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                  >
                    📄 {link.label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
