"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, getUser, formatDateShort } from "@/lib/supabase";
import type {
  DevelopmentPlan,
  Scorecard,
  ScorecardKpi,
  ScorecardGoal,
  ScorecardMetric,
} from "@/lib/types";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  blue: "#004B87",
  blueLight: "#e8f0f8",
  green: "#16a34a",
  greenLight: "#dcfce7",
  orange: "#ea580c",
  red: "#dc2626",
  redLight: "#fee2e2",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray700: "#374151",
  gray900: "#111827",
  white: "#ffffff",
};

// ─── Status badge config ──────────────────────────────────────────────────────
const SCORECARD_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  setup:     { bg: C.gray100,   color: C.gray500, label: "Setup"     },
  active:    { bg: C.blueLight, color: C.blue,    label: "Active"    },
  populated: { bg: "#fef9c3",   color: "#ca8a04", label: "Populated" },
  reviewed:  { bg: "#ede9fe",   color: "#7c3aed", label: "Reviewed"  },
  completed: { bg: C.greenLight, color: C.green,  label: "Completed" },
};

function fmtFrequency(f: string) {
  return f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Extended scorecard row ───────────────────────────────────────────────────
interface ScorecardRow {
  scorecard: Scorecard;
  planName: string;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: C.gray900 }}>{children}</h2>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 20px", fontSize: "14px", color: C.gray500 }}>{children}</p>;
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ backgroundColor: C.white, border: `1px solid ${C.gray200}`, borderRadius: "8px", padding: "20px 24px", ...style }}>{children}</div>;
}
function Alert({ type, children }: { type: "error" | "info"; children: React.ReactNode }) {
  const m = type === "error" ? { bg: C.redLight, border: C.red, text: C.red } : { bg: C.blueLight, border: C.blue, text: C.blue };
  return <div style={{ backgroundColor: m.bg, border: `1px solid ${m.border}`, borderRadius: "6px", padding: "12px 16px", color: m.text, fontSize: "14px", marginBottom: "16px" }}>{children}</div>;
}
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: C.gray400, fontSize: "14px", gap: "8px" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Loading…
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: "6px", backgroundColor: C.gray200, borderRadius: "3px", overflow: "hidden", marginTop: "6px" }}>
      <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: "100%", backgroundColor: color, borderRadius: "3px" }}/>
    </div>
  );
}

// ─── Scorecard detail modal ───────────────────────────────────────────────────
interface ScorecardDetail {
  scorecard: Scorecard;
  planName: string;
  kpis: ScorecardKpi[];
  goals: Record<string, ScorecardGoal[]>;
  metrics: Record<string, ScorecardMetric[]>;
}

function ScorecardDetailModal({ detail, onClose }: { detail: ScorecardDetail; onClose: () => void }) {
  const { scorecard, planName, kpis, goals, metrics } = detail;

  // Calculate overall weighted score
  let overall = 0;
  const kpiRows: { kpi: ScorecardKpi; avgScore: number | null; weightedContrib: number }[] = [];
  for (const kpi of kpis) {
    const scores: number[] = [];
    for (const g of goals[kpi.id] ?? []) {
      for (const m of metrics[g.id] ?? []) {
        if (m.score != null) scores.push(Number(m.score));
      }
    }
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const contrib = avg != null ? (avg * Number(kpi.weight_pct)) / 100 : 0;
    if (avg != null) overall += contrib;
    kpiRows.push({ kpi, avgScore: avg, weightedContrib: contrib });
  }

  const scoreColor = overall >= 80 ? C.green : overall >= 60 ? C.orange : C.red;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 998 }}/>
      {/* Panel */}
      <div style={{ position: "fixed", top: "5%", left: "50%", transform: "translateX(-50%)", width: "92%", maxWidth: "860px", maxHeight: "88vh", background: C.white, borderRadius: "10px", zIndex: 999, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.gray200}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: C.gray900 }}>{scorecard.name}</h2>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: C.gray500 }}>
              Development Plan: {planName}
              {scorecard.period_start && ` · ${formatDateShort(scorecard.period_start)}`}
              {scorecard.period_end && ` – ${formatDateShort(scorecard.period_end)}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: C.gray500, lineHeight: 1 }} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>

          {/* Summary stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
            <div style={{ background: `linear-gradient(135deg, ${C.blue} 0%, #0369a1 100%)`, borderRadius: "8px", padding: "16px 18px", color: C.white, textAlign: "center" }}>
              <div style={{ fontSize: "11px", opacity: 0.8, marginBottom: "4px" }}>OVERALL SCORE</div>
              <div style={{ fontSize: "40px", fontWeight: 900, lineHeight: 1 }}>{kpis.length > 0 ? overall.toFixed(1) : "—"}</div>
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "2px" }}>/ 100</div>
            </div>
            <div style={{ backgroundColor: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: "8px", padding: "16px 18px" }}>
              <div style={{ fontSize: "11px", color: C.gray500, marginBottom: "4px" }}>REVIEW TYPE</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: C.gray900 }}>{fmtFrequency(scorecard.review_type)}</div>
            </div>
            <div style={{ backgroundColor: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: "8px", padding: "16px 18px" }}>
              <div style={{ fontSize: "11px", color: C.gray500, marginBottom: "4px" }}>STATUS</div>
              {(() => {
                const sb = SCORECARD_STATUS[scorecard.status] ?? { bg: C.gray100, color: C.gray500, label: scorecard.status };
                return <span style={{ padding: "4px 10px", backgroundColor: sb.bg, color: sb.color, borderRadius: "4px", fontSize: "14px", fontWeight: 700 }}>{sb.label}</span>;
              })()}
            </div>
          </div>

          {/* KPI table */}
          <SectionTitle>KPI Scores</SectionTitle>
          <SubTitle>Performance scores for each Key Performance Indicator.</SubTitle>

          {kpis.length === 0 ? (
            <Alert type="info">No KPIs have been defined for this scorecard.</Alert>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden", marginBottom: "24px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>KPI</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Weight</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Avg Score</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Contribution</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiRows.map(({ kpi, avgScore, weightedContrib }) => {
                    const sc = avgScore == null ? C.gray300 : avgScore >= 80 ? C.green : avgScore >= 60 ? C.orange : C.red;
                    return (
                      <tr key={kpi.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ fontWeight: 600, color: C.gray900 }}>{kpi.name}</div>
                          {kpi.description && <div style={{ fontSize: "12px", color: C.gray500, marginTop: "2px" }}>{kpi.description}</div>}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: C.gray700 }}>{Number(kpi.weight_pct).toFixed(1)}%</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: avgScore == null ? C.gray400 : sc }}>
                          {avgScore != null ? avgScore.toFixed(1) : "—"}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: C.gray700 }}>
                          {avgScore != null ? `+${weightedContrib.toFixed(1)}` : "—"}
                        </td>
                        <td style={{ padding: "10px 16px", minWidth: "120px" }}>
                          <ScoreBar value={avgScore ?? 0} max={100} color={sc}/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: C.gray50, borderTop: `2px solid ${C.gray200}` }}>
                    <td style={{ padding: "10px 16px", fontWeight: 700, color: C.gray900, fontSize: "13px" }}>OVERALL WEIGHTED SCORE</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: C.gray700 }}>
                      {kpiRows.reduce((s, r) => s + r.kpi.weight_pct, 0).toFixed(1)}%
                    </td>
                    <td colSpan={2} style={{ padding: "10px 16px", textAlign: "right", fontWeight: 900, fontSize: "18px", color: kpis.length > 0 ? scoreColor : C.gray400 }}>
                      {kpis.length > 0 ? overall.toFixed(1) : "—"} / 100
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {kpis.length > 0 && <ScoreBar value={overall} max={100} color={scoreColor}/>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}

          {/* Goals & Metrics breakdown */}
          <SectionTitle>Goals & Metrics Detail</SectionTitle>
          <SubTitle>Individual metric scores for each KPI goal.</SubTitle>
          {kpis.map((kpi) => (
            <Card key={kpi.id} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px", color: C.gray900 }}>{kpi.name}</span>
                <span style={{ padding: "2px 8px", backgroundColor: C.blueLight, color: C.blue, borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>{Number(kpi.weight_pct).toFixed(1)}%</span>
              </div>
              {(goals[kpi.id] ?? []).length === 0 ? (
                <div style={{ fontSize: "13px", color: C.gray400, fontStyle: "italic" }}>No goals defined.</div>
              ) : (goals[kpi.id] ?? []).map((goal) => (
                <div key={goal.id} style={{ marginBottom: "12px", paddingLeft: "12px", borderLeft: `3px solid ${C.blue}` }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: C.gray700, marginBottom: "6px" }}>{goal.goal_text}</div>
                  {(metrics[goal.id] ?? []).length === 0 ? (
                    <div style={{ fontSize: "12px", color: C.gray400, fontStyle: "italic" }}>No metrics.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ backgroundColor: C.gray50 }}>
                          <th style={{ padding: "6px 10px", textAlign: "left", color: C.gray500, fontWeight: 600 }}>Metric</th>
                          <th style={{ padding: "6px 10px", textAlign: "left", color: C.gray500, fontWeight: 600 }}>Actual</th>
                          <th style={{ padding: "6px 10px", textAlign: "right", color: C.gray500, fontWeight: 600 }}>Score</th>
                          <th style={{ padding: "6px 10px", textAlign: "left", color: C.gray500, fontWeight: 600 }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(metrics[goal.id] ?? []).map((m) => {
                          const sc = m.score == null ? C.gray400 : Number(m.score) >= 80 ? C.green : Number(m.score) >= 60 ? C.orange : C.red;
                          return (
                            <tr key={m.id} style={{ borderTop: `1px solid ${C.gray100}` }}>
                              <td style={{ padding: "7px 10px", color: C.gray900 }}>{m.metric_name}</td>
                              <td style={{ padding: "7px 10px", color: C.gray700 }}>{m.actual ?? "—"}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: sc }}>{m.score != null ? Number(m.score).toFixed(1) : "—"}</td>
                              <td style={{ padding: "7px 10px", color: C.gray500 }}>{m.notes ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.gray200}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: `1px solid ${C.gray300}`, borderRadius: "6px", background: C.white, color: C.gray700, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SupplierScorecardsPage() {
  const [rows, setRows] = useState<ScorecardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<ScorecardDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const user = getUser();
  const supplierId = user?.supplier_id;

  const loadScorecards = useCallback(async () => {
    if (!supplierId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Get all development plans for supplier
      const { data: plans, error: pe } = await supabase
        .from("development_plans")
        .select("id, name")
        .eq("supplier_id", supplierId);
      if (pe) throw pe;

      const planMap: Record<string, string> = {};
      for (const p of (plans as { id: string; name: string }[]) ?? []) {
        planMap[p.id] = p.name;
      }

      const planIds = Object.keys(planMap);
      if (planIds.length === 0) { setRows([]); setLoading(false); return; }

      const { data: scs, error: se } = await supabase
        .from("scorecards")
        .select("*")
        .in("development_plan_id", planIds)
        .order("created_at", { ascending: false });
      if (se) throw se;

      const built: ScorecardRow[] = (scs as Scorecard[] ?? []).map((sc) => ({
        scorecard: sc,
        planName: planMap[sc.development_plan_id] ?? "—",
      }));
      setRows(built);
    } catch {
      setError("Failed to load scorecards.");
    }
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { loadScorecards(); }, [loadScorecards]);

  async function handleView(row: ScorecardRow) {
    setLoadingDetail(true);
    try {
      const sc = row.scorecard;
      const { data: kpiData } = await supabase.from("scorecard_kpis").select("*").eq("scorecard_id", sc.id).order("sort_order");
      const kpis = (kpiData as ScorecardKpi[]) ?? [];
      const goalMap: Record<string, ScorecardGoal[]> = {};
      const metricMap: Record<string, ScorecardMetric[]> = {};
      for (const kpi of kpis) {
        const { data: gd } = await supabase.from("scorecard_goals").select("*").eq("kpi_id", kpi.id).order("sort_order");
        goalMap[kpi.id] = (gd as ScorecardGoal[]) ?? [];
        for (const g of goalMap[kpi.id]) {
          const { data: md } = await supabase.from("scorecard_metrics").select("*").eq("goal_id", g.id).order("sort_order");
          metricMap[g.id] = (md as ScorecardMetric[]) ?? [];
        }
      }
      setViewing({ scorecard: sc, planName: row.planName, kpis, goals: goalMap, metrics: metricMap });
    } catch {
      setError("Failed to load scorecard details.");
    }
    setLoadingDetail(false);
  }

  if (loading) return <Spinner/>;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: C.gray900 }}>Scorecards</h1>
        <p style={{ margin: 0, fontSize: "14px", color: C.gray500 }}>Read-only view of scorecards associated with your development plans.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {loadingDetail && <Alert type="info">Loading scorecard details…</Alert>}

      {!supplierId && <Alert type="error">No supplier account linked. Please contact your administrator.</Alert>}

      {rows.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "60px 24px", border: `2px dashed ${C.gray200}`, borderRadius: "8px", color: C.gray400 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: C.gray500, marginBottom: "4px" }}>No scorecards found</div>
          <div style={{ fontSize: "13px" }}>Scorecards are created as part of your development plan. Contact your account manager.</div>
        </div>
      )}

      {rows.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Scorecard Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Development Plan</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Period</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Review Type</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Overall Score</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ scorecard: sc, planName }) => {
                const sb = SCORECARD_STATUS[sc.status] ?? { bg: C.gray100, color: C.gray500, label: sc.status };
                const period =
                  sc.period_start && sc.period_end
                    ? `${formatDateShort(sc.period_start)} – ${formatDateShort(sc.period_end)}`
                    : sc.period_start
                    ? `From ${formatDateShort(sc.period_start)}`
                    : "—";
                const overallColor = sc.overall_score == null ? C.gray400 : sc.overall_score >= 80 ? C.green : sc.overall_score >= 60 ? C.orange : C.red;
                return (
                  <tr key={sc.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: C.gray900 }}>{sc.name}</td>
                    <td style={{ padding: "12px 16px", color: C.gray700, fontSize: "13px" }}>{planName}</td>
                    <td style={{ padding: "12px 16px", color: C.gray500, fontSize: "13px" }}>{period}</td>
                    <td style={{ padding: "12px 16px", color: C.gray700 }}>{fmtFrequency(sc.review_type)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 8px", backgroundColor: sb.bg, color: sb.color, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{sb.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontSize: "16px", color: overallColor }}>
                      {sc.overall_score != null ? sc.overall_score.toFixed(1) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => handleView({ scorecard: sc, planName })}
                        disabled={loadingDetail}
                        style={{ padding: "6px 14px", backgroundColor: C.blue, color: C.white, border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: loadingDetail ? "not-allowed" : "pointer", opacity: loadingDetail ? 0.6 : 1 }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {viewing && (
        <ScorecardDetailModal detail={viewing} onClose={() => setViewing(null)}/>
      )}
    </div>
  );
}
