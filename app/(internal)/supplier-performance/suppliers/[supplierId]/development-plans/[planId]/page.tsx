"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, getUser } from "@/lib/supabase";
import type {
  DevelopmentPlan,
  Supplier,
  SegmentationAssessment,
  Scorecard,
  ScorecardKpi,
  ScorecardGoal,
  ScorecardMetric,
  PerformanceReview,
  Concurrence,
} from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SegmentationQuestion {
  id: string;
  question_text: string;
  axis: "x" | "y";
  sort_order: number;
  options: Array<{ label: string; value: string; points: number }>;
}

type StepId =
  | "1"
  | "1.1"
  | "2"
  | "3"
  | "3.1"
  | "3.2"
  | "3.3"
  | "4"
  | "4.1"
  | "4.2"
  | "5"
  | "5.1"
  | "5.2"
  | "5.3"
  | "6";

interface StepDef {
  id: StepId;
  label: string;
  parent?: StepId;
}

// ─── Step Definitions ─────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  { id: "1", label: "Segmentation Assessment" },
  { id: "1.1", label: "Segmentation Graph", parent: "1" },
  { id: "2", label: "Strategy Guidance" },
  { id: "3", label: "Development Plan / Scorecard Setup" },
  { id: "3.1", label: "Weightings", parent: "3" },
  { id: "3.2", label: "Goals & Metrics", parent: "3" },
  { id: "3.3", label: "Concurrence", parent: "3" },
  { id: "4", label: "Populate Scorecard" },
  { id: "4.1", label: "Score Summary", parent: "4" },
  { id: "4.2", label: "Concurrence", parent: "4" },
  { id: "5", label: "Performance Review" },
  { id: "5.1", label: "Gap Analysis", parent: "5" },
  { id: "5.2", label: "Summary Action Plan", parent: "5" },
  { id: "5.3", label: "Concurrence", parent: "5" },
  { id: "6", label: "Continuous Improvement" },
];

const STEP_ORDER: StepId[] = STEPS.map((s) => s.id);

function nextStep(current: StepId): StepId | null {
  const idx = STEP_ORDER.indexOf(current);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
}
function prevStep(current: StepId): StepId | null {
  const idx = STEP_ORDER.indexOf(current);
  return idx > 0 ? STEP_ORDER[idx - 1] : null;
}

// ─── Colour tokens ───────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function quadrantFromScores(x: number, y: number): string {
  const midX = 2.5;
  const midY = 2.5;
  if (x >= midX && y >= midY) return "strategic";
  if (x >= midX && y < midY) return "critical";
  if (x < midX && y >= midY) return "support";
  return "leading";
}

function quadrantLabel(q: string): string {
  switch (q) {
    case "strategic":
      return "Strategic";
    case "critical":
      return "Critical";
    case "support":
      return "Support";
    case "leading":
      return "Leading";
    default:
      return "Unknown";
  }
}

const STRATEGY_GUIDANCE: Record<string, { heading: string; body: string }> = {
  strategic: {
    heading: "Strategic Supplier — Partner for Growth",
    body: `This supplier is both strategically critical and demonstrates high performance.
Invest in a deep partnership model: joint business planning, executive sponsorship,
innovation roadmaps, and co-development initiatives. Protect this relationship with
long-term agreements, preferred-supplier status, and collaborative risk management.
Focus the development plan on mutual value creation, technology alignment, and
continuous improvement.`,
  },
  critical: {
    heading: "Critical Supplier — Urgent Development Required",
    body: `This supplier carries high strategic importance but shows performance gaps.
Immediate action is required to close performance shortfalls before they disrupt
operations. Implement a formal Corrective Action Plan with clear milestones, assign
executive ownership on both sides, and consider dual-sourcing to reduce exposure.
The development plan should prioritize performance stabilisation, root-cause analysis,
and short-cycle improvement reviews.`,
  },
  support: {
    heading: "Support Supplier — Leverage & Optimise",
    body: `This supplier performs well but is not strategically differentiated.
Focus on cost efficiency, process standardisation, and contract consolidation.
Maintain the relationship through regular performance reviews and ensure the supplier
meets baseline compliance requirements. The development plan may include benchmarking
against market alternatives and exploring volume consolidation opportunities.`,
  },
  leading: {
    heading: "Leading Supplier — Manage Efficiently",
    body: `This supplier currently shows modest strategic value and moderate performance.
Monitor contract compliance and spend, and look for ways to rationalise the supply base
if appropriate. If the category grows in importance, consider investing in this supplier's
development. The development plan should establish clear baseline KPIs and annual review
cadence to track trajectory.`,
  },
};

// ─── Shared UI ───────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 4px",
        fontSize: "18px",
        fontWeight: "700",
        color: C.gray900,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 24px", fontSize: "14px", color: C.gray500 }}>
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: "8px",
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Alert({
  type,
  children,
  style,
}: {
  type: "error" | "success" | "info";
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const colors = {
    error: { bg: C.redLight, border: C.red, text: C.red },
    success: { bg: C.greenLight, border: C.green, text: C.green },
    info: { bg: C.blueLight, border: C.blue, text: C.blue },
  };
  const { bg, border, text } = colors[type];
  return (
    <div
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: "6px",
        padding: "12px 16px",
        color: text,
        fontSize: "14px",
        marginBottom: "16px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  onClick,
  disabled,
  variant = "primary",
  children,
  type = "button",
  size = "md",
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  children: React.ReactNode;
  type?: "button" | "submit";
  size?: "sm" | "md";
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: disabled ? C.gray300 : C.blue,
      color: C.white,
      border: "none",
    },
    secondary: {
      backgroundColor: C.white,
      color: C.gray700,
      border: `1px solid ${C.gray300}`,
    },
    danger: {
      backgroundColor: disabled ? C.gray300 : C.red,
      color: C.white,
      border: "none",
    },
    ghost: {
      backgroundColor: "transparent",
      color: C.blue,
      border: "none",
    },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: size === "sm" ? "6px 12px" : "8px 16px",
        borderRadius: "6px",
        fontSize: size === "sm" ? "13px" : "14px",
        fontWeight: "600",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "200px",
        color: C.gray400,
        fontSize: "14px",
        gap: "8px",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      Loading…
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Step 1: Segmentation Assessment ─────────────────────────────────────────

function Step1Assessment({
  planId,
  existingAssessment,
  onSaved,
}: {
  planId: string;
  existingAssessment: SegmentationAssessment | null;
  onSaved: (a: SegmentationAssessment) => void;
}) {
  const [questions, setQuestions] = useState<SegmentationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>(
    existingAssessment?.answers ?? {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("segmentation_questions")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error: err }) => {
        if (err) {
          setError("Failed to load questions.");
        } else {
          setQuestions(
            (data ?? []).map((q: SegmentationQuestion & { options: string | SegmentationQuestion["options"] }) => ({
              ...q,
              options:
                typeof q.options === "string"
                  ? JSON.parse(q.options)
                  : q.options,
            }))
          );
        }
        setLoading(false);
      });
  }, []);

  const xQuestions = questions.filter((q) => q.axis === "x");
  const yQuestions = questions.filter((q) => q.axis === "y");

  function calcScores(): { scoreX: number; scoreY: number } {
    let sumX = 0;
    let countX = 0;
    let sumY = 0;
    let countY = 0;

    for (const q of xQuestions) {
      const selectedValue = answers[q.id];
      if (selectedValue) {
        const opt = q.options.find((o) => o.value === selectedValue);
        if (opt) {
          sumX += opt.points;
          countX++;
        }
      }
    }
    for (const q of yQuestions) {
      const selectedValue = answers[q.id];
      if (selectedValue) {
        const opt = q.options.find((o) => o.value === selectedValue);
        if (opt) {
          sumY += opt.points;
          countY++;
        }
      }
    }

    return {
      scoreX: countX > 0 ? sumX / countX : 0,
      scoreY: countY > 0 ? sumY / countY : 0,
    };
  }

  async function handleSave() {
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setError("Please answer all questions before saving.");
      return;
    }

    setSaving(true);
    setError("");
    const { scoreX, scoreY } = calcScores();
    const quadrant = quadrantFromScores(scoreX, scoreY);

    const payload = {
      development_plan_id: planId,
      answers,
      score_x: scoreX,
      score_y: scoreY,
      quadrant,
      completed_at: new Date().toISOString(),
    };

    let result;
    if (existingAssessment) {
      result = await supabase
        .from("segmentation_assessments")
        .update(payload)
        .eq("id", existingAssessment.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("segmentation_assessments")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      setError("Failed to save assessment: " + result.error.message);
    } else {
      // Also update the development plan's quadrant
      await supabase
        .from("development_plans")
        .update({ segmentation_quadrant: quadrant, updated_at: new Date().toISOString() })
        .eq("id", planId);

      onSaved(result.data as SegmentationAssessment);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionTitle>Segmentation Assessment</SectionTitle>
      <SubTitle>
        Answer each question to determine where this supplier falls in the
        strategic segmentation matrix.
      </SubTitle>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">Assessment saved successfully.</Alert>}

      {/* X-axis questions */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: "700",
            color: C.blue,
            marginBottom: "4px",
            borderBottom: `2px solid ${C.blue}`,
            paddingBottom: "6px",
          }}
        >
          Supply Risk / Strategic Importance
        </h3>
        {xQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            selected={answers[q.id] ?? ""}
            onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
          />
        ))}
      </div>

      {/* Y-axis questions */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: "700",
            color: C.blue,
            marginBottom: "4px",
            borderBottom: `2px solid ${C.blue}`,
            paddingBottom: "6px",
          }}
        >
          Supplier Performance / Capability
        </h3>
        {yQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            selected={answers[q.id] ?? ""}
            onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <Btn onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Assessment"}
        </Btn>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  selected,
  onChange,
}: {
  question: SegmentationQuestion;
  selected: string;
  onChange: (val: string) => void;
}) {
  return (
    <Card style={{ marginBottom: "16px" }}>
      <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "600", color: C.gray900 }}>
        {question.question_text}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {question.options.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              border: `2px solid ${selected === opt.value ? C.blue : C.gray200}`,
              borderRadius: "6px",
              cursor: "pointer",
              backgroundColor: selected === opt.value ? C.blueLight : C.white,
              fontSize: "14px",
              color: selected === opt.value ? C.blue : C.gray700,
              fontWeight: selected === opt.value ? "600" : "400",
              transition: "all 0.1s",
            }}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => onChange(opt.value)}
              style={{ display: "none" }}
            />
            {opt.label}
            <span
              style={{
                fontSize: "11px",
                backgroundColor: selected === opt.value ? C.blue : C.gray200,
                color: selected === opt.value ? C.white : C.gray500,
                borderRadius: "99px",
                padding: "2px 6px",
              }}
            >
              {opt.points}pt
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

// ─── Step 1.1: Segmentation Graph ────────────────────────────────────────────

function Step1_1Graph({
  assessment,
}: {
  assessment: SegmentationAssessment | null;
}) {
  if (!assessment?.score_x || !assessment?.score_y) {
    return (
      <div>
        <SectionTitle>Segmentation Graph</SectionTitle>
        <SubTitle>Complete the Segmentation Assessment first to see the graph.</SubTitle>
        <Alert type="info">
          No assessment scores available. Please complete Step 1 to generate the graph.
        </Alert>
      </div>
    );
  }

  const scoreX = assessment.score_x;
  const scoreY = assessment.score_y;
  const quadrant = assessment.quadrant ?? quadrantFromScores(scoreX, scoreY);

  // SVG dimensions
  const SIZE = 440;
  const PADDING = 48;
  const PLOT = SIZE - PADDING * 2;
  const MID = PADDING + PLOT / 2;

  // Map score (1–4) to SVG coordinate
  // score 1 -> left/bottom (PADDING + PLOT), score 4 -> right/top (PADDING)
  const toSvgX = (s: number) => PADDING + ((s - 1) / 3) * PLOT;
  const toSvgY = (s: number) => PADDING + PLOT - ((s - 1) / 3) * PLOT;

  const dotX = toSvgX(scoreX);
  const dotY = toSvgY(scoreY);

  const quadrantColors: Record<string, string> = {
    strategic: "#dbeafe",
    critical: "#fee2e2",
    support: "#dcfce7",
    leading: "#fef9c3",
  };

  return (
    <div>
      <SectionTitle>Segmentation Graph</SectionTitle>
      <SubTitle>
        2x2 quadrant matrix showing this supplier&apos;s segmentation position.
        X-axis: Supply Risk / Strategic Importance. Y-axis: Supplier Performance.
      </SubTitle>

      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* SVG Graph */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{
            border: `1px solid ${C.gray200}`,
            borderRadius: "8px",
            backgroundColor: C.white,
            maxWidth: "100%",
          }}
        >
          {/* Quadrant backgrounds */}
          {/* Top-left: Support (low x, high y) */}
          <rect x={PADDING} y={PADDING} width={PLOT / 2} height={PLOT / 2} fill="#dcfce7" opacity="0.7" />
          {/* Top-right: Strategic (high x, high y) */}
          <rect x={MID} y={PADDING} width={PLOT / 2} height={PLOT / 2} fill="#dbeafe" opacity="0.7" />
          {/* Bottom-left: Leading (low x, low y) */}
          <rect x={PADDING} y={MID} width={PLOT / 2} height={PLOT / 2} fill="#fef9c3" opacity="0.7" />
          {/* Bottom-right: Critical (high x, low y) */}
          <rect x={MID} y={MID} width={PLOT / 2} height={PLOT / 2} fill="#fee2e2" opacity="0.7" />

          {/* Grid lines */}
          <line x1={MID} y1={PADDING} x2={MID} y2={PADDING + PLOT} stroke={C.gray300} strokeWidth="1.5" strokeDasharray="4,4" />
          <line x1={PADDING} y1={MID} x2={PADDING + PLOT} y2={MID} stroke={C.gray300} strokeWidth="1.5" strokeDasharray="4,4" />

          {/* Border */}
          <rect x={PADDING} y={PADDING} width={PLOT} height={PLOT} fill="none" stroke={C.gray300} strokeWidth="1.5" />

          {/* Quadrant Labels */}
          <text x={PADDING + PLOT / 4} y={PADDING + PLOT / 4} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill="#16a34a" opacity="0.85">Support</text>
          <text x={PADDING + (3 * PLOT) / 4} y={PADDING + PLOT / 4} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill="#1d4ed8" opacity="0.85">Strategic</text>
          <text x={PADDING + PLOT / 4} y={PADDING + (3 * PLOT) / 4} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill="#ca8a04" opacity="0.85">Leading</text>
          <text x={PADDING + (3 * PLOT) / 4} y={PADDING + (3 * PLOT) / 4} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill="#dc2626" opacity="0.85">Critical</text>

          {/* Axis labels */}
          <text x={PADDING + PLOT / 2} y={SIZE - 10} textAnchor="middle" fontSize="12" fill={C.gray500}>Supply Risk / Strategic Importance →</text>
          <text x={12} y={PADDING + PLOT / 2} textAnchor="middle" fontSize="12" fill={C.gray500} transform={`rotate(-90, 12, ${PADDING + PLOT / 2})`}>Performance →</text>

          {/* Score tick labels */}
          <text x={PADDING} y={PADDING + PLOT + 14} textAnchor="middle" fontSize="10" fill={C.gray400}>1</text>
          <text x={PADDING + PLOT} y={PADDING + PLOT + 14} textAnchor="middle" fontSize="10" fill={C.gray400}>4</text>
          <text x={PADDING - 14} y={PADDING + PLOT} textAnchor="middle" fontSize="10" fill={C.gray400}>1</text>
          <text x={PADDING - 14} y={PADDING} textAnchor="middle" fontSize="10" fill={C.gray400}>4</text>

          {/* Supplier dot */}
          <circle cx={dotX} cy={dotY} r={14} fill={quadrantColors[quadrant] ?? "#e0e7ff"} stroke={C.blue} strokeWidth="2.5" opacity="0.9" />
          <circle cx={dotX} cy={dotY} r={6} fill={C.blue} />
          <text x={dotX + 18} y={dotY - 10} fontSize="11" fontWeight="700" fill={C.blue}>
            ({scoreX.toFixed(2)}, {scoreY.toFixed(2)})
          </text>
        </svg>

        {/* Info panel */}
        <div style={{ flex: 1, minWidth: "220px" }}>
          <Card
            style={{
              borderLeft: `4px solid ${C.blue}`,
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "12px", color: C.gray500, marginBottom: "4px" }}>
              SUPPLIER POSITION
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: C.blue,
                textTransform: "capitalize",
              }}
            >
              {quadrantLabel(quadrant)}
            </div>
          </Card>

          <Card style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", color: C.gray500, marginBottom: "2px" }}>
              X Score (Supply Risk)
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: C.gray900 }}>
              {scoreX.toFixed(2)} / 4.00
            </div>
            <ScoreBar value={scoreX} max={4} color={C.blue} />
          </Card>

          <Card>
            <div style={{ fontSize: "13px", color: C.gray500, marginBottom: "2px" }}>
              Y Score (Performance)
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: C.gray900 }}>
              {scoreY.toFixed(2)} / 4.00
            </div>
            <ScoreBar value={scoreY} max={4} color={C.green} />
          </Card>

          <div
            style={{
              marginTop: "16px",
              fontSize: "13px",
              color: C.gray500,
              lineHeight: "1.5",
            }}
          >
            <strong>Quadrant legend:</strong>
            <ul style={{ paddingLeft: "16px", margin: "4px 0 0" }}>
              <li style={{ color: "#1d4ed8" }}>Strategic — high risk, high performance</li>
              <li style={{ color: "#dc2626" }}>Critical — high risk, low performance</li>
              <li style={{ color: "#16a34a" }}>Support — low risk, high performance</li>
              <li style={{ color: "#ca8a04" }}>Leading — low risk, low performance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      style={{
        marginTop: "8px",
        height: "6px",
        backgroundColor: C.gray200,
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: "3px",
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

// ─── Step 2: Strategy Guidance ────────────────────────────────────────────────

function Step2Strategy({
  assessment,
}: {
  assessment: SegmentationAssessment | null;
}) {
  if (!assessment?.quadrant) {
    return (
      <div>
        <SectionTitle>Strategy Guidance</SectionTitle>
        <SubTitle>Complete the Segmentation Assessment to unlock tailored strategy guidance.</SubTitle>
        <Alert type="info">
          No segmentation quadrant determined yet. Please complete Step 1 first.
        </Alert>
      </div>
    );
  }

  const q = assessment.quadrant;
  const guidance = STRATEGY_GUIDANCE[q];

  return (
    <div>
      <SectionTitle>Strategy Guidance</SectionTitle>
      <SubTitle>
        Based on the segmentation result, the following strategic approach is recommended.
      </SubTitle>

      <div style={{ display: "grid", gap: "16px" }}>
        {/* Highlighted guidance for current quadrant */}
        <Card
          style={{
            borderLeft: `5px solid ${C.blue}`,
            backgroundColor: C.blueLight,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span
              style={{
                padding: "4px 12px",
                backgroundColor: C.blue,
                color: C.white,
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Active Quadrant
            </span>
            <span
              style={{
                padding: "4px 12px",
                border: `1px solid ${C.blue}`,
                color: C.blue,
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "capitalize",
              }}
            >
              {q}
            </span>
          </div>
          <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: "700", color: C.blue }}>
            {guidance.heading}
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: C.gray700, lineHeight: "1.7", whiteSpace: "pre-line" }}>
            {guidance.body}
          </p>
        </Card>

        {/* Reference cards for other quadrants */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {Object.entries(STRATEGY_GUIDANCE)
            .filter(([key]) => key !== q)
            .map(([key, val]) => (
              <Card key={key} style={{ opacity: 0.6 }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: C.gray400,
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  {key}
                </div>
                <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "700", color: C.gray700 }}>
                  {val.heading}
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: C.gray500, lineHeight: "1.5" }}>
                  {val.body.slice(0, 140)}…
                </p>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Scorecard Setup placeholder ─────────────────────────────────────

function Step3Setup({ scorecard }: { scorecard: Scorecard | null }) {
  return (
    <div>
      <SectionTitle>Development Plan / Scorecard Setup</SectionTitle>
      <SubTitle>
        Configure the scorecard for this development plan. Use the sub-steps to define
        weightings, goals, metrics, and obtain concurrence.
      </SubTitle>
      {scorecard ? (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <InfoRow label="Scorecard Name" value={scorecard.name} />
            <InfoRow label="Status" value={scorecard.status} />
            <InfoRow label="Period Start" value={scorecard.period_start ?? "—"} />
            <InfoRow label="Period End" value={scorecard.period_end ?? "—"} />
            <InfoRow label="Review Type" value={scorecard.review_type} />
            <InfoRow label="Overall Score" value={scorecard.overall_score != null ? String(scorecard.overall_score) : "—"} />
          </div>
        </Card>
      ) : (
        <Alert type="info">
          No scorecard has been created yet. Proceed to Step 3.1 to define KPI weightings.
        </Alert>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: C.gray500, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: "600", color: C.gray900, textTransform: "capitalize" }}>{value}</div>
    </div>
  );
}

// ─── Step 3.1: Weightings ─────────────────────────────────────────────────────

function Step3_1Weightings({
  planId,
  scorecard,
  onScorecardCreated,
}: {
  planId: string;
  scorecard: Scorecard | null;
  onScorecardCreated: (s: Scorecard) => void;
}) {
  const [kpis, setKpis] = useState<ScorecardKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKpiName, setNewKpiName] = useState("");
  const [newKpiWeight, setNewKpiWeight] = useState("");
  const [newKpiDesc, setNewKpiDesc] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [creatingScorecard, setCreatingScorecard] = useState(false);
  const [scorecardName, setScorecardName] = useState("");

  const user = getUser();

  const loadKpis = useCallback(async () => {
    if (!scorecard) return;
    const { data } = await supabase
      .from("scorecard_kpis")
      .select("*")
      .eq("scorecard_id", scorecard.id)
      .order("sort_order");
    setKpis((data as ScorecardKpi[]) ?? []);
    setLoading(false);
  }, [scorecard]);

  useEffect(() => {
    if (scorecard) {
      loadKpis();
    } else {
      setLoading(false);
    }
  }, [scorecard, loadKpis]);

  const totalWeight = kpis.reduce((sum, k) => sum + Number(k.weight_pct), 0);

  async function handleCreateScorecard() {
    if (!scorecardName.trim()) {
      setError("Please enter a scorecard name.");
      return;
    }
    setCreatingScorecard(true);
    setError("");
    const { data, error: err } = await supabase
      .from("scorecards")
      .insert({
        development_plan_id: planId,
        name: scorecardName.trim(),
        review_type: "annually",
        status: "setup",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (err) {
      setError("Failed to create scorecard: " + err.message);
    } else {
      onScorecardCreated(data as Scorecard);
    }
    setCreatingScorecard(false);
  }

  async function handleAddKpi() {
    setError("");
    const w = parseFloat(newKpiWeight);
    if (!newKpiName.trim()) {
      setError("KPI name is required.");
      return;
    }
    if (isNaN(w) || w <= 0) {
      setError("Weight must be a positive number.");
      return;
    }
    if (totalWeight + w > 100) {
      setError(`Adding this weight (${w}%) would exceed 100%. Current total: ${totalWeight.toFixed(1)}%`);
      return;
    }

    const { data, error: err } = await supabase
      .from("scorecard_kpis")
      .insert({
        scorecard_id: scorecard!.id,
        name: newKpiName.trim(),
        description: newKpiDesc.trim() || null,
        weight_pct: w,
        sort_order: kpis.length,
      })
      .select()
      .single();

    if (err) {
      setError("Failed to add KPI: " + err.message);
    } else {
      setKpis((prev) => [...prev, data as ScorecardKpi]);
      setNewKpiName("");
      setNewKpiWeight("");
      setNewKpiDesc("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleDeleteKpi(id: string) {
    const { error: err } = await supabase.from("scorecard_kpis").delete().eq("id", id);
    if (!err) {
      setKpis((prev) => prev.filter((k) => k.id !== id));
    }
  }

  if (loading) return <Spinner />;

  if (!scorecard) {
    return (
      <div>
        <SectionTitle>KPI Weightings</SectionTitle>
        <SubTitle>Create a scorecard first to begin adding KPIs.</SubTitle>
        {error && <Alert type="error">{error}</Alert>}
        <Card>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "6px" }}>
            Scorecard Name
          </label>
          <input
            type="text"
            value={scorecardName}
            onChange={(e) => setScorecardName(e.target.value)}
            placeholder="e.g. FY2025 Supplier Scorecard"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: `1px solid ${C.gray300}`,
              borderRadius: "6px",
              fontSize: "14px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />
          <Btn onClick={handleCreateScorecard} disabled={creatingScorecard}>
            {creatingScorecard ? "Creating…" : "Create Scorecard"}
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>KPI Weightings</SectionTitle>
      <SubTitle>
        Define the Key Performance Indicators and their respective weights. Weights must sum to 100%.
      </SubTitle>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">KPI added successfully.</Alert>}

      {/* Weight progress bar */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
          <span style={{ color: C.gray500 }}>Total Weight Allocated</span>
          <span
            style={{
              fontWeight: "700",
              color: totalWeight > 100 ? C.red : totalWeight === 100 ? C.green : C.orange,
            }}
          >
            {totalWeight.toFixed(1)}% / 100%
          </span>
        </div>
        <div style={{ height: "8px", backgroundColor: C.gray200, borderRadius: "4px", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(totalWeight, 100)}%`,
              height: "100%",
              backgroundColor: totalWeight > 100 ? C.red : totalWeight === 100 ? C.green : C.blue,
              borderRadius: "4px",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* KPI table */}
      {kpis.length > 0 && (
        <Card style={{ marginBottom: "24px", padding: "0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: "600", fontSize: "12px" }}>#</th>
                <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: "600", fontSize: "12px" }}>KPI Name</th>
                <th style={{ padding: "10px 16px", textAlign: "left", color: C.gray500, fontWeight: "600", fontSize: "12px" }}>Description</th>
                <th style={{ padding: "10px 16px", textAlign: "right", color: C.gray500, fontWeight: "600", fontSize: "12px" }}>Weight %</th>
                <th style={{ padding: "10px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi, idx) => (
                <tr key={kpi.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                  <td style={{ padding: "10px 16px", color: C.gray400 }}>{idx + 1}</td>
                  <td style={{ padding: "10px 16px", fontWeight: "600", color: C.gray900 }}>{kpi.name}</td>
                  <td style={{ padding: "10px 16px", color: C.gray500 }}>{kpi.description ?? "—"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: C.blue }}>
                    {Number(kpi.weight_pct).toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <Btn variant="danger" size="sm" onClick={() => handleDeleteKpi(kpi.id)}>
                      Remove
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add KPI form */}
      <Card>
        <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: "700", color: C.gray900 }}>
          Add KPI
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "4px" }}>
              KPI Name *
            </label>
            <input
              type="text"
              value={newKpiName}
              onChange={(e) => setNewKpiName(e.target.value)}
              placeholder="e.g. On-Time Delivery"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "4px" }}>
              Weight (%) *
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={newKpiWeight}
              onChange={(e) => setNewKpiWeight(e.target.value)}
              placeholder="e.g. 25"
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "4px" }}>
            Description (optional)
          </label>
          <input
            type="text"
            value={newKpiDesc}
            onChange={(e) => setNewKpiDesc(e.target.value)}
            placeholder="Brief description of this KPI"
            style={inputStyle}
          />
        </div>
        <Btn onClick={handleAddKpi} disabled={totalWeight >= 100}>
          + Add KPI
        </Btn>
        {totalWeight >= 100 && (
          <span style={{ marginLeft: "12px", fontSize: "13px", color: C.green, fontWeight: "600" }}>
            Weight allocation complete (100%)
          </span>
        )}
      </Card>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: `1px solid ${C.gray300}`,
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  color: C.gray900,
};

// ─── Step 3.2: Goals & Metrics ─────────────────────────────────────────────────

function Step3_2GoalsMetrics({ scorecard }: { scorecard: Scorecard | null }) {
  const [kpis, setKpis] = useState<ScorecardKpi[]>([]);
  const [goals, setGoals] = useState<Record<string, ScorecardGoal[]>>({});
  const [metrics, setMetrics] = useState<Record<string, ScorecardMetric[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);
  const [newGoalText, setNewGoalText] = useState<Record<string, string>>({});
  const [newMetricName, setNewMetricName] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    if (!scorecard) return;
    const { data: kpiData } = await supabase
      .from("scorecard_kpis")
      .select("*")
      .eq("scorecard_id", scorecard.id)
      .order("sort_order");
    const kpiList = (kpiData as ScorecardKpi[]) ?? [];
    setKpis(kpiList);

    const goalMap: Record<string, ScorecardGoal[]> = {};
    const metricMap: Record<string, ScorecardMetric[]> = {};

    for (const kpi of kpiList) {
      const { data: gData } = await supabase
        .from("scorecard_goals")
        .select("*")
        .eq("kpi_id", kpi.id)
        .order("sort_order");
      goalMap[kpi.id] = (gData as ScorecardGoal[]) ?? [];
      for (const g of goalMap[kpi.id]) {
        const { data: mData } = await supabase
          .from("scorecard_metrics")
          .select("*")
          .eq("goal_id", g.id)
          .order("sort_order");
        metricMap[g.id] = (mData as ScorecardMetric[]) ?? [];
      }
    }
    setGoals(goalMap);
    setMetrics(metricMap);
    setLoading(false);
  }, [scorecard]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function addGoal(kpiId: string) {
    const text = (newGoalText[kpiId] ?? "").trim();
    if (!text) return;
    const existingGoals = goals[kpiId] ?? [];
    const { data, error: err } = await supabase
      .from("scorecard_goals")
      .insert({ kpi_id: kpiId, goal_text: text, sort_order: existingGoals.length })
      .select()
      .single();
    if (err) {
      setError("Failed to add goal: " + err.message);
    } else {
      setGoals((prev) => ({ ...prev, [kpiId]: [...(prev[kpiId] ?? []), data as ScorecardGoal] }));
      setNewGoalText((prev) => ({ ...prev, [kpiId]: "" }));
    }
  }

  async function addMetric(goalId: string) {
    const name = (newMetricName[goalId] ?? "").trim();
    if (!name) return;
    const existingMetrics = metrics[goalId] ?? [];
    const { data, error: err } = await supabase
      .from("scorecard_metrics")
      .insert({ goal_id: goalId, metric_name: name, sort_order: existingMetrics.length })
      .select()
      .single();
    if (err) {
      setError("Failed to add metric: " + err.message);
    } else {
      setMetrics((prev) => ({ ...prev, [goalId]: [...(prev[goalId] ?? []), data as ScorecardMetric] }));
      setNewMetricName((prev) => ({ ...prev, [goalId]: "" }));
    }
  }

  if (!scorecard) {
    return (
      <div>
        <SectionTitle>Goals & Metrics</SectionTitle>
        <Alert type="info">Please create a scorecard in Step 3.1 first.</Alert>
      </div>
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionTitle>Goals & Metrics</SectionTitle>
      <SubTitle>
        For each KPI, define the goals and sub-metrics used to track performance.
      </SubTitle>

      {error && <Alert type="error">{error}</Alert>}

      {kpis.length === 0 && (
        <Alert type="info">No KPIs defined yet. Please add KPIs in Step 3.1 first.</Alert>
      )}

      {kpis.map((kpi) => (
        <Card key={kpi.id} style={{ marginBottom: "16px" }}>
          {/* KPI header */}
          <button
            onClick={() => setExpandedKpi(expandedKpi === kpi.id ? null : kpi.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "15px", fontWeight: "700", color: C.gray900 }}>{kpi.name}</span>
              <span
                style={{
                  padding: "2px 8px",
                  backgroundColor: C.blueLight,
                  color: C.blue,
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                {Number(kpi.weight_pct).toFixed(1)}%
              </span>
              <span style={{ fontSize: "13px", color: C.gray400 }}>
                {(goals[kpi.id] ?? []).length} goal(s)
              </span>
            </div>
            <span style={{ fontSize: "18px", color: C.gray400, transform: expandedKpi === kpi.id ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              ›
            </span>
          </button>

          {expandedKpi === kpi.id && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${C.gray200}` }}>
              {/* Goals */}
              {(goals[kpi.id] ?? []).map((goal) => (
                <div key={goal.id} style={{ marginBottom: "16px", paddingLeft: "16px", borderLeft: `3px solid ${C.blue}` }}>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: C.gray900, marginBottom: "8px" }}>
                    {goal.goal_text}
                  </div>
                  {/* Metrics under goal */}
                  {(metrics[goal.id] ?? []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: C.gray50,
                        borderRadius: "4px",
                        marginBottom: "4px",
                        fontSize: "13px",
                        color: C.gray700,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ color: C.gray400 }}>◦</span>
                      {m.metric_name}
                    </div>
                  ))}
                  {/* Add metric */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <input
                      type="text"
                      value={newMetricName[goal.id] ?? ""}
                      onChange={(e) => setNewMetricName((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                      placeholder="Add sub-metric…"
                      style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => e.key === "Enter" && addMetric(goal.id)}
                    />
                    <Btn size="sm" onClick={() => addMetric(goal.id)}>+ Metric</Btn>
                  </div>
                </div>
              ))}

              {/* Add goal */}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input
                  type="text"
                  value={newGoalText[kpi.id] ?? ""}
                  onChange={(e) => setNewGoalText((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                  placeholder="Add a goal for this KPI…"
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && addGoal(kpi.id)}
                />
                <Btn size="sm" onClick={() => addGoal(kpi.id)}>+ Goal</Btn>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Concurrence / Comment Thread ─────────────────────────────────────────────

function ConcurrenceThread({
  objectId,
  objectType,
  step,
  title = "Concurrence",
  subtitle = "Add comments, approvals, or objections for this step.",
}: {
  objectId: string;
  objectType: "scorecard" | "development_plan" | "performance_review";
  step: string;
  title?: string;
  subtitle?: string;
}) {
  const [comments, setComments] = useState<Concurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const user = getUser();

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("concurrences")
      .select("*")
      .eq("object_id", objectId)
      .eq("object_type", objectType)
      .eq("step", step)
      .order("created_at", { ascending: true });
    setComments((data as Concurrence[]) ?? []);
    setLoading(false);
  }, [objectId, objectType, step]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleSubmit() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    setError("");
    const { data, error: err } = await supabase
      .from("concurrences")
      .insert({
        object_id: objectId,
        object_type: objectType,
        step,
        user_id: user?.id ?? null,
        comment: newComment.trim(),
      })
      .select()
      .single();
    if (err) {
      setError("Failed to post comment: " + err.message);
    } else {
      setComments((prev) => [...prev, data as Concurrence]);
      setNewComment("");
    }
    setSubmitting(false);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <SubTitle>{subtitle}</SubTitle>

      {error && <Alert type="error">{error}</Alert>}

      {/* Thread */}
      <div style={{ marginBottom: "24px" }}>
        {comments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              color: C.gray400,
              fontSize: "14px",
              border: `2px dashed ${C.gray200}`,
              borderRadius: "8px",
            }}
          >
            No comments yet. Be the first to add a concurrence.
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: C.blue,
                  color: C.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: "700",
                  flexShrink: 0,
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    backgroundColor: C.gray50,
                    border: `1px solid ${C.gray200}`,
                    borderRadius: "8px",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontWeight: "700", fontSize: "13px", color: C.gray900 }}>
                      {user?.name ?? "User"}
                    </span>
                    <span style={{ fontSize: "12px", color: C.gray400 }}>
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", color: C.gray700, lineHeight: "1.5" }}>
                    {c.comment}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New comment */}
      <Card>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "6px" }}>
          Add Comment
        </label>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Enter your comment, approval, or objection…"
          rows={3}
          style={{
            ...inputStyle,
            resize: "vertical",
            fontFamily: "inherit",
            marginBottom: "12px",
          }}
        />
        <Btn onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
          {submitting ? "Posting…" : "Post Comment"}
        </Btn>
      </Card>
    </div>
  );
}

// ─── Step 4: Populate Scorecard ───────────────────────────────────────────────

function Step4PopulateScorecard({ scorecard }: { scorecard: Scorecard | null }) {
  const [kpis, setKpis] = useState<ScorecardKpi[]>([]);
  const [goals, setGoals] = useState<Record<string, ScorecardGoal[]>>({});
  const [metrics, setMetrics] = useState<Record<string, ScorecardMetric[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    if (!scorecard) { setLoading(false); return; }
    const { data: kpiData } = await supabase
      .from("scorecard_kpis").select("*").eq("scorecard_id", scorecard.id).order("sort_order");
    const kpiList = (kpiData as ScorecardKpi[]) ?? [];
    setKpis(kpiList);
    const goalMap: Record<string, ScorecardGoal[]> = {};
    const metricMap: Record<string, ScorecardMetric[]> = {};
    for (const kpi of kpiList) {
      const { data: gData } = await supabase.from("scorecard_goals").select("*").eq("kpi_id", kpi.id).order("sort_order");
      goalMap[kpi.id] = (gData as ScorecardGoal[]) ?? [];
      for (const g of goalMap[kpi.id]) {
        const { data: mData } = await supabase.from("scorecard_metrics").select("*").eq("goal_id", g.id).order("sort_order");
        metricMap[g.id] = (mData as ScorecardMetric[]) ?? [];
      }
    }
    setGoals(goalMap);
    setMetrics(metricMap);
    setLoading(false);
  }, [scorecard]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function updateMetric(metricId: string, field: "actual" | "score" | "notes", value: string) {
    setSaving(metricId);
    const { error: err } = await supabase
      .from("scorecard_metrics")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", metricId);
    if (err) setError("Failed to save: " + err.message);
    else {
      setMetrics((prev) => {
        const next = { ...prev };
        for (const goalId in next) {
          next[goalId] = next[goalId].map((m) =>
            m.id === metricId ? { ...m, [field]: value } : m
          );
        }
        return next;
      });
    }
    setSaving(null);
  }

  if (!scorecard) return (
    <div>
      <SectionTitle>Populate Scorecard</SectionTitle>
      <Alert type="info">Please create a scorecard in Step 3.1 first.</Alert>
    </div>
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionTitle>Populate Scorecard</SectionTitle>
      <SubTitle>Enter actual values and scores for each metric in the scorecard.</SubTitle>

      {error && <Alert type="error">{error}</Alert>}

      {kpis.map((kpi) => (
        <Card key={kpi.id} style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: C.gray900 }}>{kpi.name}</h3>
            <span style={{ padding: "2px 8px", backgroundColor: C.blueLight, color: C.blue, borderRadius: "4px", fontSize: "12px", fontWeight: "700" }}>
              {Number(kpi.weight_pct).toFixed(1)}%
            </span>
          </div>

          {(goals[kpi.id] ?? []).map((goal) => (
            <div key={goal.id} style={{ marginBottom: "16px", paddingLeft: "16px", borderLeft: `3px solid ${C.blue}` }}>
              <div style={{ fontWeight: "600", fontSize: "14px", color: C.gray700, marginBottom: "10px" }}>
                {goal.goal_text}
              </div>
              {(metrics[goal.id] ?? []).map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 2fr",
                    gap: "8px",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: `1px solid ${C.gray100}`,
                  }}
                >
                  <span style={{ fontSize: "13px", color: C.gray900 }}>{m.metric_name}</span>
                  <input
                    type="text"
                    placeholder="Actual"
                    defaultValue={m.actual ?? ""}
                    onBlur={(e) => updateMetric(m.id, "actual", e.target.value)}
                    style={{ ...inputStyle, padding: "6px 8px", fontSize: "13px" }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Score"
                    defaultValue={m.score != null ? String(m.score) : ""}
                    onBlur={(e) => updateMetric(m.id, "score", e.target.value)}
                    style={{ ...inputStyle, padding: "6px 8px", fontSize: "13px" }}
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    defaultValue={m.notes ?? ""}
                    onBlur={(e) => updateMetric(m.id, "notes", e.target.value)}
                    style={{ ...inputStyle, padding: "6px 8px", fontSize: "13px" }}
                  />
                  {saving === m.id && (
                    <span style={{ fontSize: "11px", color: C.green }}>Saving…</span>
                  )}
                </div>
              ))}
              {(metrics[goal.id] ?? []).length === 0 && (
                <div style={{ fontSize: "13px", color: C.gray400, fontStyle: "italic" }}>No metrics defined.</div>
              )}
            </div>
          ))}
          {(goals[kpi.id] ?? []).length === 0 && (
            <div style={{ fontSize: "13px", color: C.gray400, fontStyle: "italic" }}>No goals defined for this KPI.</div>
          )}
        </Card>
      ))}

      {kpis.length === 0 && (
        <Alert type="info">No KPIs defined. Please complete Step 3.1 first.</Alert>
      )}
    </div>
  );
}

// ─── Step 4.1: Score Summary ──────────────────────────────────────────────────

function Step4_1ScoreSummary({ scorecard }: { scorecard: Scorecard | null }) {
  const [kpis, setKpis] = useState<ScorecardKpi[]>([]);
  const [goals, setGoals] = useState<Record<string, ScorecardGoal[]>>({});
  const [metrics, setMetrics] = useState<Record<string, ScorecardMetric[]>>({});
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!scorecard) { setLoading(false); return; }
    const { data: kpiData } = await supabase.from("scorecard_kpis").select("*").eq("scorecard_id", scorecard.id).order("sort_order");
    const kpiList = (kpiData as ScorecardKpi[]) ?? [];
    setKpis(kpiList);
    const goalMap: Record<string, ScorecardGoal[]> = {};
    const metricMap: Record<string, ScorecardMetric[]> = {};
    for (const kpi of kpiList) {
      const { data: gData } = await supabase.from("scorecard_goals").select("*").eq("kpi_id", kpi.id).order("sort_order");
      goalMap[kpi.id] = (gData as ScorecardGoal[]) ?? [];
      for (const g of goalMap[kpi.id]) {
        const { data: mData } = await supabase.from("scorecard_metrics").select("*").eq("goal_id", g.id).order("sort_order");
        metricMap[g.id] = (mData as ScorecardMetric[]) ?? [];
      }
    }
    setGoals(goalMap);
    setMetrics(metricMap);
    setLoading(false);
  }, [scorecard]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!scorecard) return (
    <div>
      <SectionTitle>Score Summary</SectionTitle>
      <Alert type="info">No scorecard found.</Alert>
    </div>
  );
  if (loading) return <Spinner />;

  // Calculate weighted overall score
  let overallScore = 0;
  const kpiScores: { name: string; weight: number; score: number | null }[] = [];
  for (const kpi of kpis) {
    const kpiGoals = goals[kpi.id] ?? [];
    let metricScores: number[] = [];
    for (const g of kpiGoals) {
      const ms = metrics[g.id] ?? [];
      for (const m of ms) {
        if (m.score != null) metricScores.push(Number(m.score));
      }
    }
    const avgScore = metricScores.length > 0 ? metricScores.reduce((a, b) => a + b, 0) / metricScores.length : null;
    kpiScores.push({ name: kpi.name, weight: Number(kpi.weight_pct), score: avgScore });
    if (avgScore != null) {
      overallScore += (avgScore * Number(kpi.weight_pct)) / 100;
    }
  }

  const scoreColor = overallScore >= 80 ? C.green : overallScore >= 60 ? C.orange : C.red;

  return (
    <div>
      <SectionTitle>Score Summary</SectionTitle>
      <SubTitle>Weighted scorecard summary based on populated metric scores.</SubTitle>

      {/* Overall score card */}
      <Card
        style={{
          textAlign: "center",
          marginBottom: "24px",
          background: `linear-gradient(135deg, ${C.blue} 0%, #0369a1 100%)`,
          color: C.white,
        }}
      >
        <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "4px" }}>OVERALL WEIGHTED SCORE</div>
        <div style={{ fontSize: "56px", fontWeight: "900", lineHeight: "1" }}>
          {overallScore.toFixed(1)}
        </div>
        <div style={{ fontSize: "14px", opacity: 0.7, marginTop: "4px" }}>/ 100</div>
      </Card>

      {/* Per-KPI breakdown */}
      <div style={{ display: "grid", gap: "12px" }}>
        {kpiScores.map((ks) => (
          <Card key={ks.name} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: C.gray900 }}>{ks.name}</div>
              <div style={{ fontSize: "12px", color: C.gray500 }}>Weight: {ks.weight.toFixed(1)}%</div>
            </div>
            <div style={{ minWidth: "160px" }}>
              <ScoreBar value={ks.score ?? 0} max={100} color={ks.score == null ? C.gray300 : (ks.score >= 80 ? C.green : ks.score >= 60 ? C.orange : C.red)} />
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: ks.score == null ? C.gray400 : (ks.score >= 80 ? C.green : ks.score >= 60 ? C.orange : C.red),
                minWidth: "60px",
                textAlign: "right",
              }}
            >
              {ks.score != null ? ks.score.toFixed(1) : "—"}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Step 5: Performance Review ───────────────────────────────────────────────

function Step5PerformanceReview({
  scorecard,
  review,
  onReviewUpdated,
}: {
  scorecard: Scorecard | null;
  review: PerformanceReview | null;
  onReviewUpdated: (r: PerformanceReview) => void;
}) {
  const [creating, setCreating] = useState(false);
  const user = getUser();

  async function handleCreateReview() {
    if (!scorecard) return;
    setCreating(true);
    const { data, error: err } = await supabase
      .from("performance_reviews")
      .insert({
        scorecard_id: scorecard.id,
        status: "in_progress",
        reviewed_by: user?.id ?? null,
      })
      .select()
      .single();
    if (!err && data) {
      onReviewUpdated(data as PerformanceReview);
    }
    setCreating(false);
  }

  if (!scorecard) return (
    <div>
      <SectionTitle>Performance Review</SectionTitle>
      <Alert type="info">No scorecard found. Complete Step 3 first.</Alert>
    </div>
  );

  return (
    <div>
      <SectionTitle>Performance Review</SectionTitle>
      <SubTitle>Initiate and manage the formal performance review process.</SubTitle>

      {review ? (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <InfoRow label="Review Status" value={review.status} />
            <InfoRow label="Review Date" value={review.review_date ?? "Not set"} />
            <InfoRow label="Overall Comments" value={review.overall_comments ?? "—"} />
          </div>
          {review.status === "in_progress" && (
            <Alert type="info" style={{ marginTop: "16px" }}>
              Review is in progress. Use the sub-steps (5.1–5.3) to complete the gap analysis, action plan, and concurrence.
            </Alert>
          )}
        </Card>
      ) : (
        <div>
          <Alert type="info">No performance review initiated yet.</Alert>
          <Btn onClick={handleCreateReview} disabled={creating}>
            {creating ? "Creating…" : "Initiate Performance Review"}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── Step 5.1: Gap Analysis ───────────────────────────────────────────────────

function Step5_1GapAnalysis({
  review,
  onReviewUpdated,
}: {
  review: PerformanceReview | null;
  onReviewUpdated: (r: PerformanceReview) => void;
}) {
  const [gapText, setGapText] = useState(review?.gap_analysis ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setGapText(review?.gap_analysis ?? "");
  }, [review]);

  async function handleSave() {
    if (!review) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("performance_reviews")
      .update({ gap_analysis: gapText, updated_at: new Date().toISOString() })
      .eq("id", review.id)
      .select()
      .single();
    if (err) setError("Failed to save: " + err.message);
    else {
      onReviewUpdated(data as PerformanceReview);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (!review) return (
    <div>
      <SectionTitle>Gap Analysis</SectionTitle>
      <Alert type="info">Please initiate the Performance Review in Step 5 first.</Alert>
    </div>
  );

  return (
    <div>
      <SectionTitle>Gap Analysis</SectionTitle>
      <SubTitle>
        Document the gaps between expected and actual supplier performance. Identify root causes
        and impact areas.
      </SubTitle>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">Gap analysis saved successfully.</Alert>}

      <Card>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "6px" }}>
          Gap Analysis
        </label>
        <textarea
          value={gapText}
          onChange={(e) => setGapText(e.target.value)}
          placeholder="Describe performance gaps, root causes, and impact areas…"
          rows={10}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: "16px" }}
        />
        <Btn onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Gap Analysis"}
        </Btn>
      </Card>
    </div>
  );
}

// ─── Step 5.2: Summary Action Plan ───────────────────────────────────────────

function Step5_2ActionPlan({
  review,
  onReviewUpdated,
}: {
  review: PerformanceReview | null;
  onReviewUpdated: (r: PerformanceReview) => void;
}) {
  const [planText, setPlanText] = useState(review?.summary_action_plan ?? "");
  const [comments, setComments] = useState(review?.overall_comments ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPlanText(review?.summary_action_plan ?? "");
    setComments(review?.overall_comments ?? "");
  }, [review]);

  async function handleSave() {
    if (!review) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("performance_reviews")
      .update({
        summary_action_plan: planText,
        overall_comments: comments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", review.id)
      .select()
      .single();
    if (err) setError("Failed to save: " + err.message);
    else {
      onReviewUpdated(data as PerformanceReview);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (!review) return (
    <div>
      <SectionTitle>Summary Action Plan</SectionTitle>
      <Alert type="info">Please initiate the Performance Review in Step 5 first.</Alert>
    </div>
  );

  return (
    <div>
      <SectionTitle>Summary Action Plan</SectionTitle>
      <SubTitle>
        Define the corrective and improvement actions required to address the identified gaps.
      </SubTitle>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">Action plan saved successfully.</Alert>}

      <Card style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "6px" }}>
          Summary Action Plan
        </label>
        <textarea
          value={planText}
          onChange={(e) => setPlanText(e.target.value)}
          placeholder="List the improvement actions, owners, timelines, and success criteria…"
          rows={8}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </Card>

      <Card style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: C.gray700, marginBottom: "6px" }}>
          Overall Comments
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="General comments on the performance review…"
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </Card>

      <Btn onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Action Plan"}
      </Btn>
    </div>
  );
}

// ─── Step 6: Continuous Improvement ──────────────────────────────────────────

function Step6ContinuousImprovement({ plan }: { plan: DevelopmentPlan | null }) {
  const [note, setNote] = useState("");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [status, setStatus] = useState<string>(plan?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleStatusUpdate() {
    if (!plan) return;
    setSaving(true);
    await supabase
      .from("development_plans")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  function addNote() {
    if (!note.trim()) return;
    setSavedNotes((prev) => [
      ...prev,
      `[${new Date().toLocaleDateString()}] ${note.trim()}`,
    ]);
    setNote("");
  }

  return (
    <div>
      <SectionTitle>Continuous Improvement</SectionTitle>
      <SubTitle>
        Track ongoing improvement initiatives, update plan status, and record progress notes
        for the next review cycle.
      </SubTitle>

      {saved && <Alert type="success">Plan status updated.</Alert>}

      {/* Status update */}
      <Card style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: "700", color: C.gray900 }}>
          Development Plan Status
        </h4>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ ...inputStyle, width: "auto", minWidth: "180px" }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <Btn onClick={handleStatusUpdate} disabled={saving}>
            {saving ? "Saving…" : "Update Status"}
          </Btn>
        </div>
      </Card>

      {/* Improvement notes */}
      <Card>
        <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: "700", color: C.gray900 }}>
          Improvement Notes
        </h4>
        {savedNotes.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            {savedNotes.map((n, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  backgroundColor: C.gray50,
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: C.gray700,
                  marginBottom: "8px",
                  borderLeft: `3px solid ${C.green}`,
                }}
              >
                {n}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an improvement note…"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <Btn onClick={addNote}>+ Add Note</Btn>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: C.gray400 }}>
          Note: Improvement notes are session-only in this view. Integrate with an audit log for persistence.
        </p>
      </Card>

      {/* Next cycle checklist */}
      <Card style={{ marginTop: "20px" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: "700", color: C.gray900 }}>
          Next Review Cycle Checklist
        </h4>
        {[
          "Review previous scorecard scores and trends",
          "Confirm segmentation is still accurate",
          "Update KPI weightings if priorities have changed",
          "Set new goals and targets for the next period",
          "Obtain stakeholder concurrences",
          "Schedule supplier review meeting",
        ].map((item, i) => (
          <ChecklistItem key={i} text={item} />
        ))}
      </Card>
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 0",
        borderBottom: `1px solid ${C.gray100}`,
        cursor: "pointer",
        fontSize: "14px",
        color: checked ? C.gray400 : C.gray700,
        textDecoration: checked ? "line-through" : "none",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        style={{ accentColor: C.blue, width: "16px", height: "16px" }}
      />
      {text}
    </label>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DevelopmentPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.supplierId as string;
  const planId = params.planId as string;

  const [plan, setPlan] = useState<DevelopmentPlan | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [assessment, setAssessment] = useState<SegmentationAssessment | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [review, setReview] = useState<PerformanceReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<StepId>("1");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      // Load plan
      const { data: planData, error: planErr } = await supabase
        .from("development_plans")
        .select("*")
        .eq("id", planId)
        .single();
      if (planErr || !planData) {
        setError("Development plan not found.");
        setLoading(false);
        return;
      }
      setPlan(planData as DevelopmentPlan);

      // Load supplier
      const { data: supplierData } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .single();
      setSupplier(supplierData as Supplier);

      // Load assessment
      const { data: assessData } = await supabase
        .from("segmentation_assessments")
        .select("*")
        .eq("development_plan_id", planId)
        .maybeSingle();
      setAssessment(
        assessData
          ? ({
              ...assessData,
              answers:
                typeof assessData.answers === "string"
                  ? JSON.parse(assessData.answers)
                  : assessData.answers,
            } as SegmentationAssessment)
          : null
      );

      // Load scorecard
      const { data: scData } = await supabase
        .from("scorecards")
        .select("*")
        .eq("development_plan_id", planId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setScorecard(scData as Scorecard | null);

      // Load performance review (latest)
      if (scData) {
        const { data: rvData } = await supabase
          .from("performance_reviews")
          .select("*")
          .eq("scorecard_id", scData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setReview(rvData as PerformanceReview | null);
      }

      setLoading(false);
    }
    load();
  }, [planId, supplierId]);

  const prev = prevStep(currentStep);
  const next = nextStep(currentStep);

  function renderStepContent() {
    switch (currentStep) {
      case "1":
        return (
          <Step1Assessment
            planId={planId}
            existingAssessment={assessment}
            onSaved={(a) => setAssessment(a)}
          />
        );
      case "1.1":
        return <Step1_1Graph assessment={assessment} />;
      case "2":
        return <Step2Strategy assessment={assessment} />;
      case "3":
        return <Step3Setup scorecard={scorecard} />;
      case "3.1":
        return (
          <Step3_1Weightings
            planId={planId}
            scorecard={scorecard}
            onScorecardCreated={(s) => setScorecard(s)}
          />
        );
      case "3.2":
        return <Step3_2GoalsMetrics scorecard={scorecard} />;
      case "3.3":
        return (
          <ConcurrenceThread
            objectId={scorecard?.id ?? planId}
            objectType={scorecard ? "scorecard" : "development_plan"}
            step="3.3"
            title="Concurrence — Scorecard Setup"
            subtitle="Obtain stakeholder concurrence on the scorecard structure, weightings, and goals."
          />
        );
      case "4":
        return <Step4PopulateScorecard scorecard={scorecard} />;
      case "4.1":
        return <Step4_1ScoreSummary scorecard={scorecard} />;
      case "4.2":
        return (
          <ConcurrenceThread
            objectId={scorecard?.id ?? planId}
            objectType={scorecard ? "scorecard" : "development_plan"}
            step="4.2"
            title="Concurrence — Scorecard Population"
            subtitle="Obtain stakeholder concurrence on the populated scorecard scores."
          />
        );
      case "5":
        return (
          <Step5PerformanceReview
            scorecard={scorecard}
            review={review}
            onReviewUpdated={(r) => setReview(r)}
          />
        );
      case "5.1":
        return (
          <Step5_1GapAnalysis
            review={review}
            onReviewUpdated={(r) => setReview(r)}
          />
        );
      case "5.2":
        return (
          <Step5_2ActionPlan
            review={review}
            onReviewUpdated={(r) => setReview(r)}
          />
        );
      case "5.3":
        return (
          <ConcurrenceThread
            objectId={review?.id ?? scorecard?.id ?? planId}
            objectType={review ? "performance_review" : "development_plan"}
            step="5.3"
            title="Concurrence — Performance Review"
            subtitle="Obtain stakeholder concurrence on the performance review findings and action plan."
          />
        );
      case "6":
        return <Step6ContinuousImprovement plan={plan} />;
      default:
        return <div>Select a step from the sidebar.</div>;
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: C.gray100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Alert type="error">{error}</Alert>
        <Btn variant="secondary" onClick={() => router.back()}>
          ← Go Back
        </Btn>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: C.gray100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top header */}
      <header
        style={{
          backgroundColor: C.blue,
          padding: "0 24px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              color: C.white,
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: "1",
              padding: "4px",
              opacity: 0.8,
            }}
          >
            ←
          </button>
          <div>
            <div style={{ color: C.white, fontSize: "15px", fontWeight: "700" }}>
              {plan?.name ?? "Development Plan"}
            </div>
            <div style={{ color: C.blueMid, fontSize: "12px" }}>
              {supplier?.name ?? "Supplier"} · Supplier Performance
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: "4px",
              color: C.white,
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "capitalize",
            }}
          >
            {plan?.status ?? "draft"}
          </span>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: "256px",
            flexShrink: 0,
            backgroundColor: C.white,
            borderRight: `1px solid ${C.gray200}`,
            overflowY: "auto",
            padding: "16px 0",
          }}
        >
          <div
            style={{
              padding: "0 16px 12px",
              fontSize: "11px",
              fontWeight: "700",
              color: C.gray400,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              borderBottom: `1px solid ${C.gray100}`,
              marginBottom: "8px",
            }}
          >
            Process Steps
          </div>

          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const isParent = !step.parent;
            const isCompleted = isStepCompleted(step.id, assessment, scorecard, review);

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: step.parent ? "7px 16px 7px 36px" : "9px 16px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  backgroundColor: isActive ? C.blueLight : "transparent",
                  borderLeft: isActive ? `3px solid ${C.blue}` : "3px solid transparent",
                  transition: "background-color 0.1s",
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    backgroundColor: isActive
                      ? C.blue
                      : isCompleted
                      ? C.green
                      : C.gray300,
                  }}
                />

                <span
                  style={{
                    fontSize: step.parent ? "13px" : "13px",
                    fontWeight: isActive ? "700" : isParent ? "600" : "400",
                    color: isActive ? C.blue : isParent ? C.gray900 : C.gray500,
                    lineHeight: "1.3",
                  }}
                >
                  <span style={{ color: C.gray400, fontSize: "11px", marginRight: "4px" }}>
                    {step.id}
                  </span>
                  {step.label}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px",
          }}
        >
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            {/* Breadcrumb */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "24px",
                fontSize: "13px",
                color: C.gray400,
              }}
            >
              <span>{supplier?.name ?? "Supplier"}</span>
              <span>›</span>
              <span>{plan?.name ?? "Plan"}</span>
              <span>›</span>
              <span style={{ color: C.gray700, fontWeight: "600" }}>
                Step {currentStep}: {STEPS.find((s) => s.id === currentStep)?.label}
              </span>
            </div>

            {/* Step content */}
            <div style={{ marginBottom: "48px" }}>{renderStepContent()}</div>

            {/* Navigation footer */}
            <div
              style={{
                borderTop: `1px solid ${C.gray200}`,
                paddingTop: "24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                {prev && (
                  <Btn variant="secondary" onClick={() => setCurrentStep(prev)}>
                    ← Previous Step
                  </Btn>
                )}
              </div>

              {/* Step dots */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {STEPS.filter((s) => !s.parent).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentStep(s.id)}
                    title={`Step ${s.id}: ${s.label}`}
                    style={{
                      width: currentStep === s.id ? "20px" : "8px",
                      height: "8px",
                      borderRadius: "4px",
                      backgroundColor: currentStep === s.id || currentStep.startsWith(s.id + ".")
                        ? C.blue
                        : isStepCompleted(s.id, assessment, scorecard, review)
                        ? C.green
                        : C.gray300,
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              <div>
                {next && (
                  <Btn onClick={() => setCurrentStep(next)}>
                    Next Step →
                  </Btn>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Step completion helpers ──────────────────────────────────────────────────

function isStepCompleted(
  stepId: StepId,
  assessment: SegmentationAssessment | null,
  scorecard: Scorecard | null,
  review: PerformanceReview | null
): boolean {
  switch (stepId) {
    case "1":
    case "1.1":
      return !!assessment?.completed_at;
    case "2":
      return !!assessment?.quadrant;
    case "3":
    case "3.1":
    case "3.2":
    case "3.3":
      return !!scorecard;
    case "4":
    case "4.1":
    case "4.2":
      return scorecard?.status === "populated" || scorecard?.status === "reviewed" || scorecard?.status === "completed";
    case "5":
    case "5.1":
    case "5.2":
    case "5.3":
      return review?.status === "completed";
    case "6":
      return false;
    default:
      return false;
  }
}
