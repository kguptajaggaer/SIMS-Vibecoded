"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, getUser, formatDateShort } from "@/lib/supabase";
import type { PerformanceReview, Scorecard } from "@/lib/types";

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

// ─── Review status config ─────────────────────────────────────────────────────
const REVIEW_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: C.gray100,    color: C.gray500, label: "Pending"     },
  in_progress: { bg: "#fef9c3",    color: "#ca8a04", label: "In Progress" },
  completed:   { bg: C.greenLight, color: C.green,   label: "Completed"   },
};

function truncate(text: string | null | undefined, len: number): string {
  if (!text) return "—";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

// ─── Row type ─────────────────────────────────────────────────────────────────
interface ReviewRow {
  review: PerformanceReview;
  scorecardName: string;
}

// Suppress unused import warning — Scorecard is used via the query shape
type _SC = Scorecard;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 700, color: C.gray900 }}>{children}</h2>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 16px", fontSize: "13px", color: C.gray500 }}>{children}</p>;
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

// ─── Read-only text block ─────────────────────────────────────────────────────
function ReadOnlyTextBlock({ label, value, minHeight = "100px" }: { label: string; value?: string | null; minHeight?: string }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>{label}</div>
      <div style={{ padding: "14px 16px", border: `1px solid ${C.gray200}`, borderRadius: "6px", backgroundColor: C.gray50, minHeight, fontSize: "14px", color: value ? C.gray700 : C.gray400, lineHeight: "1.75", whiteSpace: "pre-wrap", fontStyle: value ? "normal" : "italic" }}>
        {value || "Nothing recorded."}
      </div>
    </div>
  );
}

// ─── Review detail modal ──────────────────────────────────────────────────────
function ReviewDetailModal({ row, onClose }: { row: ReviewRow; onClose: () => void }) {
  const { review, scorecardName } = row;
  const sb = REVIEW_STATUS[review.status] ?? { bg: C.gray100, color: C.gray500, label: review.status };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 998 }}/>
      {/* Panel */}
      <div style={{ position: "fixed", top: "5%", left: "50%", transform: "translateX(-50%)", width: "92%", maxWidth: "780px", maxHeight: "88vh", background: C.white, borderRadius: "10px", zIndex: 999, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.gray200}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: C.gray900 }}>Performance Review</h2>
              <span style={{ padding: "3px 10px", backgroundColor: sb.bg, color: sb.color, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{sb.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: C.gray500 }}>
              Scorecard: {scorecardName}
              {review.review_date && ` · Reviewed: ${formatDateShort(review.review_date)}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: C.gray500, flexShrink: 0 }} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>

          {/* Meta strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "24px" }}>
            {[
              { label: "Review Date", value: review.review_date ? formatDateShort(review.review_date) : "Not set" },
              { label: "Status",      value: sb.label },
              { label: "Created",     value: formatDateShort(review.created_at) },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: "6px", padding: "12px 14px" }}>
                <div style={{ fontSize: "11px", color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: C.gray900 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Gap Analysis */}
          <div style={{ borderTop: `2px solid ${C.blueLight}`, paddingTop: "20px" }}>
            <SectionTitle>Gap Analysis</SectionTitle>
            <SubTitle>Documented gaps between expected and actual supplier performance.</SubTitle>
            <ReadOnlyTextBlock label="Gap Analysis" value={review.gap_analysis} minHeight="120px"/>
          </div>

          {/* Action Plan */}
          <div style={{ borderTop: `2px solid ${C.blueLight}`, paddingTop: "20px" }}>
            <SectionTitle>Summary Action Plan</SectionTitle>
            <SubTitle>Corrective and improvement actions to address the identified gaps.</SubTitle>
            <ReadOnlyTextBlock label="Action Plan" value={review.summary_action_plan} minHeight="100px"/>
          </div>

          {/* Overall Comments */}
          <div style={{ borderTop: `2px solid ${C.blueLight}`, paddingTop: "20px" }}>
            <SectionTitle>Overall Comments</SectionTitle>
            <SubTitle>General observations and summary remarks for this review cycle.</SubTitle>
            <ReadOnlyTextBlock label="Overall Comments" value={review.overall_comments} minHeight="80px"/>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.gray200}`, display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: `1px solid ${C.gray300}`, borderRadius: "6px", background: C.white, color: C.gray700, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SupplierReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<ReviewRow | null>(null);

  const user = getUser();
  const supplierId = user?.supplier_id;

  const loadReviews = useCallback(async () => {
    if (!supplierId) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Development plans for this supplier
      const { data: plans, error: pe } = await supabase
        .from("development_plans")
        .select("id")
        .eq("supplier_id", supplierId);
      if (pe) throw pe;

      const planIds = ((plans as { id: string }[]) ?? []).map((p) => p.id);
      if (planIds.length === 0) { setRows([]); setLoading(false); return; }

      // 2. Scorecards under those plans
      const { data: scs, error: se } = await supabase
        .from("scorecards")
        .select("id, name")
        .in("development_plan_id", planIds);
      if (se) throw se;

      const scorecardMap: Record<string, string> = {};
      for (const sc of (scs as { id: string; name: string }[]) ?? []) {
        scorecardMap[sc.id] = sc.name;
      }

      const scorecardIds = Object.keys(scorecardMap);
      if (scorecardIds.length === 0) { setRows([]); setLoading(false); return; }

      // 3. Performance reviews for those scorecards
      const { data: revs, error: re } = await supabase
        .from("performance_reviews")
        .select("*")
        .in("scorecard_id", scorecardIds)
        .order("created_at", { ascending: false });
      if (re) throw re;

      const built: ReviewRow[] = ((revs as PerformanceReview[]) ?? []).map((r) => ({
        review: r,
        scorecardName: scorecardMap[r.scorecard_id] ?? "—",
      }));
      setRows(built);
    } catch {
      setError("Failed to load performance reviews.");
    }
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  if (loading) return <Spinner/>;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: C.gray900 }}>Performance Reviews</h1>
        <p style={{ margin: 0, fontSize: "14px", color: C.gray500 }}>Read-only view of completed and in-progress performance reviews for your scorecards.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {!supplierId && <Alert type="error">No supplier account linked. Please contact your administrator.</Alert>}

      {rows.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "60px 24px", border: `2px dashed ${C.gray200}`, borderRadius: "8px", color: C.gray400 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: C.gray500, marginBottom: "4px" }}>No performance reviews found</div>
          <div style={{ fontSize: "13px" }}>Performance reviews are generated from your scorecards. Contact your account manager for more information.</div>
        </div>
      )}

      {rows.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Review Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Scorecard</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Gap Analysis</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Action Plan</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: C.gray500, fontWeight: 600, fontSize: "12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ review, scorecardName }) => {
                const sb = REVIEW_STATUS[review.status] ?? { bg: C.gray100, color: C.gray500, label: review.status };
                return (
                  <tr key={review.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: "12px 16px", color: C.gray700, whiteSpace: "nowrap" }}>
                      {review.review_date ? formatDateShort(review.review_date) : <span style={{ color: C.gray400, fontStyle: "italic" }}>Not set</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: C.gray900 }}>{scorecardName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 8px", backgroundColor: sb.bg, color: sb.color, borderRadius: "4px", fontSize: "12px", fontWeight: 700 }}>{sb.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: C.gray500, fontSize: "13px", maxWidth: "220px" }}>
                      {truncate(review.gap_analysis, 80)}
                    </td>
                    <td style={{ padding: "12px 16px", color: C.gray500, fontSize: "13px", maxWidth: "220px" }}>
                      {truncate(review.summary_action_plan, 80)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => setViewing({ review, scorecardName })}
                        style={{ padding: "6px 14px", backgroundColor: C.blue, color: C.white, border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
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

      {/* Summary stats */}
      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "20px" }}>
          {[
            { label: "Total Reviews", value: rows.length,                                                     color: C.blue   },
            { label: "Completed",     value: rows.filter((r) => r.review.status === "completed").length,      color: C.green  },
            { label: "In Progress",   value: rows.filter((r) => r.review.status === "in_progress").length,    color: C.orange },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ backgroundColor: C.white, border: `1px solid ${C.gray200}`, borderRadius: "8px", padding: "16px 20px" }}>
              <div style={{ fontSize: "11px", color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <ReviewDetailModal row={viewing} onClose={() => setViewing(null)}/>
      )}
    </div>
  );
}
