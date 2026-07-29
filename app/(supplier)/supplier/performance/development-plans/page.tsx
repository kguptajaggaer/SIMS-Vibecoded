"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, getUser, formatDateShort } from "@/lib/supabase";
import type {
  DevelopmentPlan,
  SegmentationAssessment,
  Scorecard,
  ScorecardKpi,
  ScorecardGoal,
  ScorecardMetric,
  PerformanceReview,
  Concurrence,
  SegmentationQuadrant,
} from "@/lib/types";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  blue: "#004B87",
  blueLight: "#e8f0f8",
  blueMid: "#c8d9ec",
  green: "#16a34a",
  greenLight: "#dcfce7",
  orange: "#ea580c",
  orangeLight: "#ffedd5",
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

// ─── Step definitions ─────────────────────────────────────────────────────────
type StepId = "1" | "1.1" | "2" | "3" | "3.1" | "3.2" | "3.3" | "4" | "4.1" | "4.2" | "5" | "5.1" | "5.2" | "5.3" | "6";

interface StepDef { id: StepId; label: string; parent?: StepId; }

const STEPS: StepDef[] = [
  { id: "1",   label: "Segmentation Assessment" },
  { id: "1.1", label: "Segmentation Graph",    parent: "1" },
  { id: "2",   label: "Strategy Guidance" },
  { id: "3",   label: "Scorecard Setup" },
  { id: "3.1", label: "KPI Weightings",        parent: "3" },
  { id: "3.2", label: "Goals & Metrics",       parent: "3" },
  { id: "3.3", label: "Concurrence",           parent: "3" },
  { id: "4",   label: "Populate Scorecard" },
  { id: "4.1", label: "Score Summary",         parent: "4" },
  { id: "4.2", label: "Concurrence",           parent: "4" },
  { id: "5",   label: "Performance Review" },
  { id: "5.1", label: "Gap Analysis",          parent: "5" },
  { id: "5.2", label: "Summary Action Plan",   parent: "5" },
  { id: "5.3", label: "Concurrence",           parent: "5" },
  { id: "6",   label: "Continuous Improvement" },
];

// ─── Strategy guidance ────────────────────────────────────────────────────────
const STRATEGY_GUIDANCE: Record<string, { heading: string; body: string }> = {
  strategic: {
    heading: "Strategic Supplier — Partner for Growth",
    body: `This supplier is both strategically critical and demonstrates high performance. Invest in a deep partnership model: joint business planning, executive sponsorship, innovation roadmaps, and co-development initiatives. Protect this relationship with long-term agreements, preferred-supplier status, and collaborative risk management.`,
  },
  critical: {
    heading: "Critical Supplier — Urgent Development Required",
    body: `This supplier carries high strategic importance but shows performance gaps. Immediate action is required to close performance shortfalls before they disrupt operations. Implement a formal Corrective Action Plan with clear milestones, assign executive ownership on both sides, and consider dual-sourcing to reduce exposure.`,
  },
  support: {
    heading: "Support Supplier — Leverage & Optimise",
    body: `This supplier performs well but is not strategically differentiated. Focus on cost efficiency, process standardisation, and contract consolidation. Maintain the relationship through regular performance reviews and ensure the supplier meets baseline compliance requirements.`,
  },
  leading: {
    heading: "Leading Supplier — Manage Efficiently",
    body: `This supplier currently shows modest strategic value and moderate performance. Monitor contract compliance and spend, and look for ways to rationalise the supply base if appropriate. The development plan should establish clear baseline KPIs and annual review cadence to track trajectory.`,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function quadrantFromScores(x: number, y: number): string {
  if (x >= 2.5 && y >= 2.5) return "strategic";
  if (x >= 2.5 && y < 2.5)  return "critical";
  if (x < 2.5  && y >= 2.5) return "support";
  return "leading";
}

const QUADRANT_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  strategic: { bg: "#dbeafe", color: "#1d4ed8", label: "Strategic" },
  critical:  { bg: C.redLight,  color: C.red,  label: "Critical"  },
  support:   { bg: C.greenLight, color: C.green, label: "Support"  },
  leading:   { bg: "#fef9c3",  color: "#ca8a04", label: "Leading"  },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: C.gray100,  color: C.gray500 },
  active:    { bg: C.blueLight, color: C.blue },
  completed: { bg: C.greenLight, color: C.green },
  archived:  { bg: C.gray100,  color: C.gray400 },
};

function fmtFrequency(f: string) {
  return f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Plan detail data ─────────────────────────────────────────────────────────
interface PlanDetail {
  plan: DevelopmentPlan;
  assessment: SegmentationAssessment | null;
  scorecard: Scorecard | null;
  kpis: ScorecardKpi[];
  goals: Record<string, ScorecardGoal[]>;
  metrics: Record<string, ScorecardMetric[]>;
  review: PerformanceReview | null;
  concurrences: Concurrence[];
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: C.gray900, letterSpacing: "-0.01em" }}>{children}</h2>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 20px", fontSize: "14px", color: C.gray500 }}>{children}</p>;
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ backgroundColor: C.white, border: `1px solid ${C.gray200}`, borderRadius: "8px", padding: "20px 24px", ...style }}>{children}</div>;
}
function Alert({ type, children }: { type: "error" | "info"; children: React.ReactNode }) {
  const colors = { error: { bg: C.redLight, border: C.red, text: C.red }, info: { bg: C.blueLight, border: C.blue, text: C.blue } };
  const { bg, border, text } = colors[type];
  return <div style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: "6px", padding: "12px 16px", color: text, fontSize: "14px", marginBottom: "16px" }}>{children}</div>;
}
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: C.gray400, fontSize: "14px", gap: "8px" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      Loading…
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: C.gray500, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: 600, color: C.gray900, textTransform: "capitalize" }}>{value || "—"}</div>
    </div>
  );
}
function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginTop: "8px", height: "6px", backgroundColor: C.gray200, borderRadius: "3px", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "3px" }} />
    </div>
  );
}

// ─── Segmentation graph (read-only) ───────────────────────────────────────────
function SegmentationGraph({ assessment }: { assessment: SegmentationAssessment }) {
  const scoreX = assessment.score_x ?? 0;
  const scoreY = assessment.score_y ?? 0;
  const quadrant = assessment.quadrant ?? quadrantFromScores(scoreX, scoreY);
  const SIZE = 400, PADDING = 48, PLOT = SIZE - PADDING * 2, MID = PADDING + PLOT / 2;
  const toX = (s: number) => PADDING + ((s - 1) / 3) * PLOT;
  const toY = (s: number) => PADDING + PLOT - ((s - 1) / 3) * PLOT;
  const dotX = toX(scoreX), dotY = toY(scoreY);
  const qColors: Record<string, string> = { strategic: "#dbeafe", critical: "#fee2e2", support: "#dcfce7", leading: "#fef9c3" };

  return (
    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ border: `1px solid ${C.gray200}`, borderRadius: "8px", backgroundColor: C.white, maxWidth: "100%" }}>
        <rect x={PADDING} y={PADDING} width={PLOT/2} height={PLOT/2} fill="#dcfce7" opacity="0.7"/>
        <rect x={MID} y={PADDING} width={PLOT/2} height={PLOT/2} fill="#dbeafe" opacity="0.7"/>
        <rect x={PADDING} y={MID} width={PLOT/2} height={PLOT/2} fill="#fef9c3" opacity="0.7"/>
        <rect x={MID} y={MID} width={PLOT/2} height={PLOT/2} fill="#fee2e2" opacity="0.7"/>
        <line x1={MID} y1={PADDING} x2={MID} y2={PADDING+PLOT} stroke={C.gray300} strokeWidth="1.5" strokeDasharray="4,4"/>
        <line x1={PADDING} y1={MID} x2={PADDING+PLOT} y2={MID} stroke={C.gray300} strokeWidth="1.5" strokeDasharray="4,4"/>
        <rect x={PADDING} y={PADDING} width={PLOT} height={PLOT} fill="none" stroke={C.gray300} strokeWidth="1.5"/>
        <text x={PADDING+PLOT/4} y={PADDING+PLOT/4} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#16a34a" opacity="0.85">Support</text>
        <text x={PADDING+(3*PLOT)/4} y={PADDING+PLOT/4} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#1d4ed8" opacity="0.85">Strategic</text>
        <text x={PADDING+PLOT/4} y={PADDING+(3*PLOT)/4} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#ca8a04" opacity="0.85">Leading</text>
        <text x={PADDING+(3*PLOT)/4} y={PADDING+(3*PLOT)/4} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#dc2626" opacity="0.85">Critical</text>
        <text x={PADDING+PLOT/2} y={SIZE-10} textAnchor="middle" fontSize="11" fill={C.gray500}>Supply Risk / Strategic Importance →</text>
        <text x={12} y={PADDING+PLOT/2} textAnchor="middle" fontSize="11" fill={C.gray500} transform={`rotate(-90,12,${PADDING+PLOT/2})`}>Performance →</text>
        <circle cx={dotX} cy={dotY} r={13} fill={qColors[quadrant]??C.blueLight} stroke={C.blue} strokeWidth="2.5" opacity="0.9"/>
        <circle cx={dotX} cy={dotY} r={6} fill={C.blue}/>
        <text x={dotX+16} y={dotY-10} fontSize="10" fontWeight="700" fill={C.blue}>({scoreX.toFixed(2)},{scoreY.toFixed(2)})</text>
      </svg>
      <div style={{ flex: 1, minWidth: "200px" }}>
        <Card style={{ borderLeft: `4px solid ${C.blue}`, marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", color: C.gray500, marginBottom: "2px" }}>SUPPLIER POSITION</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: C.blue, textTransform: "capitalize" }}>{QUADRANT_BADGE[quadrant]?.label ?? quadrant}</div>
        </Card>
        <Card style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "12px", color: C.gray500, marginBottom: "2px" }}>X Score (Supply Risk)</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: C.gray900 }}>{scoreX.toFixed(2)} / 4.00</div>
          <ScoreBar value={scoreX} max={4} color={C.blue}/>
        </Card>
        <Card>
          <div style={{ fontSize: "12px", color: C.gray500, marginBottom: "2px" }}>Y Score (Performance)</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: C.gray900 }}>{scoreY.toFixed(2)} / 4.00</div>
          <ScoreBar value={scoreY} max={4} color={C.green}/>
        </Card>
      </div>
    </div>
  );
}

// ─── Step panels (read-only) ──────────────────────────────────────────────────

function StepAssessment({ assessment }: { assessment: SegmentationAssessment | null }) {
  if (!assessment) return <Alert type="info">No segmentation assessment has been completed yet.</Alert>;
  const answers = assessment.answers ?? {};
  const answerCount = Object.keys(answers).length;
  return (
    <div>
      <SectionTitle>Segmentation Assessment</SectionTitle>
      <SubTitle>Read-only view of the completed segmentation assessment.</SubTitle>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <InfoRow label="Questions Answered" value={String(answerCount)}/>
          <InfoRow label="Completed" value={assessment.completed_at ? formatDateShort(assessment.completed_at) : "—"}/>
          {assessment.score_x != null && <InfoRow label="X Score (Supply Risk)" value={assessment.score_x.toFixed(2)}/>}
          {assessment.score_y != null && <InfoRow label="Y Score (Performance)" value={assessment.score_y.toFixed(2)}/>}
          {assessment.quadrant && <InfoRow label="Quadrant" value={QUADRANT_BADGE[assessment.quadrant]?.label ?? assessment.quadrant}/>}
        </div>
        <Alert type="info">The assessment has been completed by your account manager. Navigate to the Segmentation Graph step to view the result.</Alert>
      </Card>
    </div>
  );
}

function StepGraph({ assessment }: { assessment: SegmentationAssessment | null }) {
  if (!assessment?.score_x || !assessment?.score_y) {
    return (
      <div>
        <SectionTitle>Segmentation Graph</SectionTitle>
        <SubTitle>Complete the Segmentation Assessment first to see the graph.</SubTitle>
        <Alert type="info">No assessment scores available yet.</Alert>
      </div>
    );
  }
  return (
    <div>
      <SectionTitle>Segmentation Graph</SectionTitle>
      <SubTitle>2×2 quadrant matrix showing your strategic segmentation position.</SubTitle>
      <SegmentationGraph assessment={assessment}/>
    </div>
  );
}

function StepStrategy({ assessment }: { assessment: SegmentationAssessment | null }) {
  if (!assessment?.quadrant) {
    return (
      <div>
        <SectionTitle>Strategy Guidance</SectionTitle>
        <Alert type="info">No segmentation quadrant determined yet.</Alert>
      </div>
    );
  }
  const q = assessment.quadrant;
  const g = STRATEGY_GUIDANCE[q];
  return (
    <div>
      <SectionTitle>Strategy Guidance</SectionTitle>
      <SubTitle>Strategic approach recommended based on your segmentation result.</SubTitle>
      <Card style={{ borderLeft: `5px solid ${C.blue}`, backgroundColor: C.blueLight }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
          <span style={{ padding: "3px 10px", backgroundColor: C.blue, color: C.white, borderRadius: "4px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Active Quadrant</span>
          <span style={{ padding: "3px 10px", border: `1px solid ${C.blue}`, color: C.blue, borderRadius: "4px", fontSize: "11px", fontWeight: 700, textTransform: "capitalize" }}>{q}</span>
        </div>
        <h3 style={{ margin: "0 0 10px", fontSize: "16px", fontWeight: 700, color: C.blue }}>{g.heading}</h3>
        <p style={{ margin: 0, fontSize: "14px", color: C.gray700, lineHeight: "1.7" }}>{g.body}</p>
      </Card>
    </div>
  );
}

function StepScorecardOverview({ scorecard }: { scorecard: Scorecard | null }) {
  return (
    <div>
      <SectionTitle>Scorecard Setup</SectionTitle>
      <SubTitle>Overview of the scorecard configured for this development plan.</SubTitle>
      {scorecard ? (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <InfoRow label="Scorecard Name" value={scorecard.name}/>
            <InfoRow label="Status" value={scorecard.status}/>
            <InfoRow label="Period Start" value={scorecard.period_start ?? "—"}/>
            <InfoRow label="Period End" value={scorecard.period_end ?? "—"}/>
            <InfoRow label="Review Type" value={fmtFrequency(scorecard.review_type)}/>
            <InfoRow label="Overall Score" value={scorecard.overall_score != null ? String(scorecard.overall_score) : "—"}/>
          </div>
        </Card>
      ) : (
        <Alert type="info">No scorecard has been created yet.</Alert>
      )}
    </div>
  );
}

function StepKpiWeightings({ kpis }: { kpis: ScorecardKpi[] }) {
  const total = kpis.reduce((s, k) => s + Number(k.weight_pct), 0);
  return (
    <div>
      <SectionTitle>KPI Weightings</SectionTitle>
      <SubTitle>Key Performance Indicators and their assigned weights.</SubTitle>
      {kpis.length === 0 ? (
        <Alert type="info">No KPIs have been defined yet.</Alert>
      ) : (
        <>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
              <span style={{ color: C.gray500 }}>Total Weight Allocated</span>
              <span style={{ fontWeight: 700, color: total === 100 ? C.green : C.orange }}>{total.toFixed(1)}% / 100%</span>
            </div>
            <div style={{ height: "6px", backgroundColor: C.gray200, borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(total, 100)}%`, height: "100%", backgroundColor: total === 100 ? C.green : C.blue, borderRadius: "3px" }}/>
            </div>
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>#</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>KPI Name</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Description</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Weight %</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi, i) => (
                  <tr key={kpi.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: "10px 16px", color: C.gray400 }}>{i + 1}</td>
                    <td style={{ padding: "10px 16px", fontWeight: 600, color: C.gray900 }}>{kpi.name}</td>
                    <td style={{ padding: "10px 16px", color: C.gray500 }}>{kpi.description ?? "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: C.blue }}>{Number(kpi.weight_pct).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function StepGoalsMetrics({ kpis, goals, metrics }: { kpis: ScorecardKpi[]; goals: Record<string, ScorecardGoal[]>; metrics: Record<string, ScorecardMetric[]> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <SectionTitle>Goals & Metrics</SectionTitle>
      <SubTitle>Goals and sub-metrics defined for each KPI.</SubTitle>
      {kpis.length === 0 ? (
        <Alert type="info">No KPIs or goals have been defined yet.</Alert>
      ) : (
        kpis.map((kpi) => (
          <Card key={kpi.id} style={{ marginBottom: "12px", padding: "16px 20px" }}>
            <button onClick={() => setExpanded(expanded === kpi.id ? null : kpi.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: C.gray900 }}>{kpi.name}</span>
                <span style={{ padding: "2px 8px", backgroundColor: C.blueLight, color: C.blue, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{Number(kpi.weight_pct).toFixed(1)}%</span>
                <span style={{ fontSize: "13px", color: C.gray400 }}>{(goals[kpi.id] ?? []).length} goal(s)</span>
              </div>
              <span style={{ fontSize: "18px", color: C.gray400, transform: expanded === kpi.id ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
            </button>
            {expanded === kpi.id && (
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${C.gray200}` }}>
                {(goals[kpi.id] ?? []).length === 0 ? (
                  <div style={{ fontSize: "13px", color: C.gray400, fontStyle: "italic" }}>No goals defined.</div>
                ) : (goals[kpi.id] ?? []).map((goal) => (
                  <div key={goal.id} style={{ marginBottom: "14px", paddingLeft: "14px", borderLeft: `3px solid ${C.blue}` }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: C.gray900, marginBottom: "6px" }}>{goal.goal_text}</div>
                    {(metrics[goal.id] ?? []).length === 0 ? (
                      <div style={{ fontSize: "12px", color: C.gray400, fontStyle: "italic" }}>No metrics defined.</div>
                    ) : (metrics[goal.id] ?? []).map((m) => (
                      <div key={m.id} style={{ padding: "5px 10px", backgroundColor: C.gray50, borderRadius: "4px", marginBottom: "4px", fontSize: "13px", color: C.gray700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: C.gray400 }}>◦</span>
                        <span style={{ flex: 1 }}>{m.metric_name}</span>
                        {m.target && <span style={{ fontSize: "11px", color: C.gray500 }}>Target: {m.target}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function StepConcurrenceReadOnly({ concurrences, step }: { concurrences: Concurrence[]; step: string }) {
  const filtered = concurrences.filter((c) => c.step === step);
  return (
    <div>
      <SectionTitle>Concurrence</SectionTitle>
      <SubTitle>Comments and approvals recorded for this step.</SubTitle>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: C.gray400, fontSize: "14px", border: `2px dashed ${C.gray200}`, borderRadius: "8px" }}>
          No concurrence comments recorded for this step.
        </div>
      ) : (
        filtered.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: C.blue, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>
              U
            </div>
            <div style={{ flex: 1, backgroundColor: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: "8px", padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: C.gray900 }}>Team Member</span>
                <span style={{ fontSize: "11px", color: C.gray400 }}>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: C.gray700, lineHeight: "1.5" }}>{c.comment}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StepPopulateScorecard({ kpis, goals, metrics }: { kpis: ScorecardKpi[]; goals: Record<string, ScorecardGoal[]>; metrics: Record<string, ScorecardMetric[]> }) {
  return (
    <div>
      <SectionTitle>Populate Scorecard</SectionTitle>
      <SubTitle>Actual values and scores entered for each metric.</SubTitle>
      {kpis.length === 0 ? (
        <Alert type="info">No KPIs defined.</Alert>
      ) : kpis.map((kpi) => (
        <Card key={kpi.id} style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: C.gray900 }}>{kpi.name}</h3>
            <span style={{ padding: "2px 8px", backgroundColor: C.blueLight, color: C.blue, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{Number(kpi.weight_pct).toFixed(1)}%</span>
          </div>
          {(goals[kpi.id] ?? []).length === 0 ? (
            <div style={{ fontSize: "13px", color: C.gray400, fontStyle: "italic" }}>No goals defined.</div>
          ) : (goals[kpi.id] ?? []).map((goal) => (
            <div key={goal.id} style={{ marginBottom: "14px", paddingLeft: "14px", borderLeft: `3px solid ${C.blue}` }}>
              <div style={{ fontWeight: 600, fontSize: "14px", color: C.gray700, marginBottom: "8px" }}>{goal.goal_text}</div>
              {(metrics[goal.id] ?? []).map((m) => (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr", gap: "8px", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.gray100}` }}>
                  <span style={{ fontSize: "13px", color: C.gray900 }}>{m.metric_name}</span>
                  <input readOnly value={m.actual ?? ""} placeholder="—" style={{ padding: "6px 8px", border: `1px solid ${C.gray200}`, borderRadius: "4px", fontSize: "13px", backgroundColor: C.gray50, color: C.gray700, cursor: "default" }}/>
                  <input readOnly value={m.score != null ? String(m.score) : ""} placeholder="—" style={{ padding: "6px 8px", border: `1px solid ${C.gray200}`, borderRadius: "4px", fontSize: "13px", backgroundColor: C.gray50, color: C.gray700, cursor: "default" }}/>
                  <input readOnly value={m.notes ?? ""} placeholder="—" style={{ padding: "6px 8px", border: `1px solid ${C.gray200}`, borderRadius: "4px", fontSize: "13px", backgroundColor: C.gray50, color: C.gray700, cursor: "default" }}/>
                </div>
              ))}
              {(metrics[goal.id] ?? []).length === 0 && <div style={{ fontSize: "13px", color: C.gray400, fontStyle: "italic" }}>No metrics.</div>}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function StepScoreSummary({ scorecard, kpis, goals, metrics }: { scorecard: Scorecard | null; kpis: ScorecardKpi[]; goals: Record<string, ScorecardGoal[]>; metrics: Record<string, ScorecardMetric[]> }) {
  if (!scorecard) return <div><SectionTitle>Score Summary</SectionTitle><Alert type="info">No scorecard found.</Alert></div>;
  let overall = 0;
  const rows: { name: string; weight: number; score: number | null }[] = [];
  for (const kpi of kpis) {
    const scores: number[] = [];
    for (const g of goals[kpi.id] ?? []) {
      for (const m of metrics[g.id] ?? []) {
        if (m.score != null) scores.push(Number(m.score));
      }
    }
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    rows.push({ name: kpi.name, weight: Number(kpi.weight_pct), score: avg });
    if (avg != null) overall += (avg * Number(kpi.weight_pct)) / 100;
  }
  return (
    <div>
      <SectionTitle>Score Summary</SectionTitle>
      <SubTitle>Weighted scorecard summary.</SubTitle>
      <Card style={{ textAlign: "center", marginBottom: "20px", background: `linear-gradient(135deg, ${C.blue} 0%, #0369a1 100%)`, color: C.white }}>
        <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "4px" }}>OVERALL WEIGHTED SCORE</div>
        <div style={{ fontSize: "52px", fontWeight: 900, lineHeight: 1 }}>{overall.toFixed(1)}</div>
        <div style={{ fontSize: "13px", opacity: 0.7, marginTop: "4px" }}>/ 100</div>
      </Card>
      <div style={{ display: "grid", gap: "10px" }}>
        {rows.map((r) => (
          <Card key={r.name} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 18px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: C.gray900 }}>{r.name}</div>
              <div style={{ fontSize: "12px", color: C.gray500 }}>Weight: {r.weight.toFixed(1)}%</div>
            </div>
            <div style={{ minWidth: "140px" }}>
              <ScoreBar value={r.score ?? 0} max={100} color={r.score == null ? C.gray300 : r.score >= 80 ? C.green : r.score >= 60 ? C.orange : C.red}/>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: r.score == null ? C.gray400 : r.score >= 80 ? C.green : r.score >= 60 ? C.orange : C.red, minWidth: "52px", textAlign: "right" }}>
              {r.score != null ? r.score.toFixed(1) : "—"}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StepReviewOverview({ review }: { review: PerformanceReview | null }) {
  return (
    <div>
      <SectionTitle>Performance Review</SectionTitle>
      <SubTitle>Overview of the formal performance review.</SubTitle>
      {review ? (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <InfoRow label="Status" value={review.status}/>
            <InfoRow label="Review Date" value={review.review_date ? formatDateShort(review.review_date) : "Not set"}/>
          </div>
          {review.overall_comments && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "12px", color: C.gray500, marginBottom: "4px" }}>Overall Comments</div>
              <p style={{ margin: 0, fontSize: "14px", color: C.gray700, lineHeight: "1.6" }}>{review.overall_comments}</p>
            </div>
          )}
        </Card>
      ) : (
        <Alert type="info">No performance review has been initiated yet.</Alert>
      )}
    </div>
  );
}

function StepGapAnalysis({ review }: { review: PerformanceReview | null }) {
  return (
    <div>
      <SectionTitle>Gap Analysis</SectionTitle>
      <SubTitle>Documented performance gaps between expected and actual results.</SubTitle>
      {!review ? (
        <Alert type="info">No performance review initiated yet.</Alert>
      ) : (
        <Card>
          <div style={{ fontSize: "13px", fontWeight: 600, color: C.gray700, marginBottom: "8px" }}>Gap Analysis</div>
          <div style={{ padding: "12px", border: `1px solid ${C.gray200}`, borderRadius: "6px", backgroundColor: C.gray50, minHeight: "120px", fontSize: "14px", color: C.gray700, lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
            {review.gap_analysis || <span style={{ color: C.gray400, fontStyle: "italic" }}>No gap analysis recorded.</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

function StepActionPlan({ review }: { review: PerformanceReview | null }) {
  return (
    <div>
      <SectionTitle>Summary Action Plan</SectionTitle>
      <SubTitle>Corrective and improvement actions to address identified gaps.</SubTitle>
      {!review ? (
        <Alert type="info">No performance review initiated yet.</Alert>
      ) : (
        <>
          <Card style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: C.gray700, marginBottom: "8px" }}>Action Plan</div>
            <div style={{ padding: "12px", border: `1px solid ${C.gray200}`, borderRadius: "6px", backgroundColor: C.gray50, minHeight: "100px", fontSize: "14px", color: C.gray700, lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
              {review.summary_action_plan || <span style={{ color: C.gray400, fontStyle: "italic" }}>No action plan recorded.</span>}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: "13px", fontWeight: 600, color: C.gray700, marginBottom: "8px" }}>Overall Comments</div>
            <div style={{ padding: "12px", border: `1px solid ${C.gray200}`, borderRadius: "6px", backgroundColor: C.gray50, minHeight: "60px", fontSize: "14px", color: C.gray700, lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
              {review.overall_comments || <span style={{ color: C.gray400, fontStyle: "italic" }}>No comments recorded.</span>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StepContinuousImprovement({ plan }: { plan: DevelopmentPlan }) {
  return (
    <div>
      <SectionTitle>Continuous Improvement</SectionTitle>
      <SubTitle>Ongoing improvement tracking for this development plan.</SubTitle>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <InfoRow label="Plan Name" value={plan.name}/>
          <InfoRow label="Status" value={plan.status}/>
          <InfoRow label="Review Frequency" value={fmtFrequency(plan.review_frequency)}/>
          {plan.segmentation_quadrant && <InfoRow label="Quadrant" value={QUADRANT_BADGE[plan.segmentation_quadrant]?.label ?? plan.segmentation_quadrant}/>}
          <InfoRow label="Created" value={formatDateShort(plan.created_at)}/>
          <InfoRow label="Last Updated" value={formatDateShort(plan.updated_at)}/>
        </div>
        <Alert type="info" style={{ marginTop: "16px" }}>
          Continuous improvement actions are tracked through ongoing scorecard cycles and performance reviews. Contact your account manager to discuss improvement initiatives.
        </Alert>
      </Card>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function PlanDetailPanel({ detail, onBack }: { detail: PlanDetail; onBack: () => void }) {
  const [activeStep, setActiveStep] = useState<StepId>("1");
  const { plan, assessment, scorecard, kpis, goals, metrics, review, concurrences } = detail;

  function renderStep() {
    switch (activeStep) {
      case "1":   return <StepAssessment assessment={assessment}/>;
      case "1.1": return <StepGraph assessment={assessment}/>;
      case "2":   return <StepStrategy assessment={assessment}/>;
      case "3":   return <StepScorecardOverview scorecard={scorecard}/>;
      case "3.1": return <StepKpiWeightings kpis={kpis}/>;
      case "3.2": return <StepGoalsMetrics kpis={kpis} goals={goals} metrics={metrics}/>;
      case "3.3": return <StepConcurrenceReadOnly concurrences={concurrences} step="3.3"/>;
      case "4":   return <StepPopulateScorecard kpis={kpis} goals={goals} metrics={metrics}/>;
      case "4.1": return <StepScoreSummary scorecard={scorecard} kpis={kpis} goals={goals} metrics={metrics}/>;
      case "4.2": return <StepConcurrenceReadOnly concurrences={concurrences} step="4.2"/>;
      case "5":   return <StepReviewOverview review={review}/>;
      case "5.1": return <StepGapAnalysis review={review}/>;
      case "5.2": return <StepActionPlan review={review}/>;
      case "5.3": return <StepConcurrenceReadOnly concurrences={concurrences} step="5.3"/>;
      case "6":   return <StepContinuousImprovement plan={plan}/>;
      default:    return null;
    }
  }

  const qBadge = plan.segmentation_quadrant ? QUADRANT_BADGE[plan.segmentation_quadrant] : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", border: `1px solid ${C.gray300}`, borderRadius: "6px", background: C.white, color: C.gray700, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          ← Back to Plans
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: C.gray900 }}>{plan.name}</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: C.gray500 }}>{fmtFrequency(plan.review_frequency)}</span>
            {qBadge && <span style={{ padding: "2px 8px", backgroundColor: qBadge.bg, color: qBadge.color, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{qBadge.label}</span>}
          </div>
        </div>
        <div style={{ padding: "3px 10px", backgroundColor: STATUS_BADGE[plan.status]?.bg ?? C.gray100, color: STATUS_BADGE[plan.status]?.color ?? C.gray500, borderRadius: "4px", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" }}>
          {plan.status}
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* Step sidebar */}
        <div style={{ width: "200px", flexShrink: 0, backgroundColor: C.white, border: `1px solid ${C.gray200}`, borderRadius: "8px", overflow: "hidden" }}>
          {STEPS.map((s) => {
            const isParent = !s.parent;
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: s.parent ? "7px 16px 7px 28px" : "9px 16px",
                  fontSize: s.parent ? "12px" : "13px",
                  fontWeight: isActive ? 700 : (isParent ? 600 : 400),
                  color: isActive ? C.blue : (isParent ? C.gray900 : C.gray600 ?? C.gray500),
                  backgroundColor: isActive ? C.blueLight : "transparent",
                  borderLeft: isActive ? `3px solid ${C.blue}` : "3px solid transparent",
                  border: "none", borderLeft: isActive ? `3px solid ${C.blue}` : "3px solid transparent",
                  borderBottom: `1px solid ${C.gray100}`,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "10px", color: isActive ? C.blue : C.gray400, marginRight: "6px" }}>{s.id}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SupplierDevelopmentPlansPage() {
  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingDetail, setViewingDetail] = useState<PlanDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const user = getUser();
  const supplierId = user?.supplier_id;

  const loadPlans = useCallback(async () => {
    if (!supplierId) { setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("development_plans")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    if (err) setError("Failed to load development plans.");
    else setPlans((data as DevelopmentPlan[]) ?? []);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  async function handleView(plan: DevelopmentPlan) {
    setLoadingDetail(true);
    try {
      // Assessment
      const { data: aData } = await supabase.from("segmentation_assessments").select("*").eq("development_plan_id", plan.id).order("created_at", { ascending: false }).limit(1).single();
      const assessment = (aData as SegmentationAssessment) ?? null;

      // Scorecard (latest)
      const { data: scData } = await supabase.from("scorecards").select("*").eq("development_plan_id", plan.id).order("created_at", { ascending: false }).limit(1).single();
      const scorecard = (scData as Scorecard) ?? null;

      let kpis: ScorecardKpi[] = [];
      const goalMap: Record<string, ScorecardGoal[]> = {};
      const metricMap: Record<string, ScorecardMetric[]> = {};
      let review: PerformanceReview | null = null;

      if (scorecard) {
        const { data: kpiData } = await supabase.from("scorecard_kpis").select("*").eq("scorecard_id", scorecard.id).order("sort_order");
        kpis = (kpiData as ScorecardKpi[]) ?? [];
        for (const kpi of kpis) {
          const { data: gData } = await supabase.from("scorecard_goals").select("*").eq("kpi_id", kpi.id).order("sort_order");
          goalMap[kpi.id] = (gData as ScorecardGoal[]) ?? [];
          for (const g of goalMap[kpi.id]) {
            const { data: mData } = await supabase.from("scorecard_metrics").select("*").eq("goal_id", g.id).order("sort_order");
            metricMap[g.id] = (mData as ScorecardMetric[]) ?? [];
          }
        }
        const { data: revData } = await supabase.from("performance_reviews").select("*").eq("scorecard_id", scorecard.id).order("created_at", { ascending: false }).limit(1).single();
        review = (revData as PerformanceReview) ?? null;
      }

      // Concurrences for this plan + scorecard
      const objectIds = [plan.id, ...(scorecard ? [scorecard.id] : [])];
      const { data: concData } = await supabase.from("concurrences").select("*").in("object_id", objectIds).order("created_at", { ascending: true });
      const concurrences = (concData as Concurrence[]) ?? [];

      setViewingDetail({ plan, assessment, scorecard, kpis, goals: goalMap, metrics: metricMap, review, concurrences });
    } catch {
      setError("Failed to load plan details.");
    }
    setLoadingDetail(false);
  }

  if (loading) return <Spinner/>;

  if (viewingDetail) {
    return <PlanDetailPanel detail={viewingDetail} onBack={() => setViewingDetail(null)}/>;
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: C.gray900 }}>Development Plans</h1>
        <p style={{ margin: 0, fontSize: "14px", color: C.gray500 }}>View your supplier development plans and associated scorecards.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {loadingDetail && <Alert type="info">Loading plan details…</Alert>}

      {!supplierId && (
        <Alert type="error">No supplier account linked. Please contact your administrator.</Alert>
      )}

      {plans.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "60px 24px", border: `2px dashed ${C.gray200}`, borderRadius: "8px", color: C.gray400 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: C.gray500, marginBottom: "4px" }}>No development plans found</div>
          <div style={{ fontSize: "13px" }}>Contact your account manager to set up a development plan.</div>
        </div>
      )}

      {plans.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Plan Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Frequency</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Quadrant</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Created</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const qb = plan.segmentation_quadrant ? QUADRANT_BADGE[plan.segmentation_quadrant] : null;
                const sb = STATUS_BADGE[plan.status] ?? { bg: C.gray100, color: C.gray500 };
                return (
                  <tr key={plan.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: C.gray900 }}>{plan.name}</td>
                    <td style={{ padding: "12px 16px", color: C.gray700 }}>{fmtFrequency(plan.review_frequency)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {qb ? (
                        <span style={{ padding: "3px 8px", backgroundColor: qb.bg, color: qb.color, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{qb.label}</span>
                      ) : (
                        <span style={{ color: C.gray400, fontSize: "13px" }}>Not assessed</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 8px", backgroundColor: sb.bg, color: sb.color, borderRadius: "4px", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" }}>{plan.status}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: C.gray500, fontSize: "13px" }}>{formatDateShort(plan.created_at)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => handleView(plan)}
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
    </div>
  );
}
