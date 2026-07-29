"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, getUser, formatDateShort } from "@/lib/supabase";
import type { Supplier, SegmentationQuadrant } from "@/lib/types";

// ─── Aggregated card type ────────────────────────────────────────────────────
type SupplierPlanCard = {
  planId: string;
  supplierId: string;
  supplierName: string;
  apexNumber: string | null;
  quadrant: SegmentationQuadrant | null;
  activeScorecardCount: number;
  lastReviewDate: string | null;
};

// ─── Quadrant badge helpers ──────────────────────────────────────────────────
const QUADRANT_LABELS: Record<SegmentationQuadrant, string> = {
  strategic: "Strategic",
  critical: "Critical",
  support: "Support",
  leading: "Leading",
};

const QUADRANT_COLORS: Record<SegmentationQuadrant, { bg: string; color: string }> = {
  strategic: { bg: "var(--usps-blue-light)", color: "var(--usps-blue)" },
  critical: { bg: "var(--danger-bg)", color: "var(--danger)" },
  support: { bg: "#f1f5f9", color: "#475569" },
  leading: { bg: "var(--success-bg)", color: "var(--success)" },
};

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SupplierPerformancePage() {
  const router = useRouter();

  const [cards, setCards] = useState<SupplierPlanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Add-supplier modal state
  const [showModal, setShowModal] = useState(false);
  const [modalQuery, setModalQuery] = useState("");
  const [modalResults, setModalResults] = useState<Supplier[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ── Fetch active development plans ────────────────────────────────────────
  async function fetchPlans() {
    setLoading(true);
    setError("");
    try {
      // Get active development_plans joined with supplier
      const { data: plans, error: plansErr } = await supabase
        .from("development_plans")
        .select(
          "id, supplier_id, segmentation_quadrant, suppliers!inner(id, name, apex_number), scorecards(id, status)"
        )
        .eq("status", "active");

      if (plansErr) throw plansErr;
      if (!plans || plans.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      // Collect all scorecard IDs to look up last review dates
      const scorecardIds: string[] = (plans as any[]).flatMap((p: any) =>
        (p.scorecards || []).map((s: any) => s.id)
      );

      let reviewMap: Record<string, string> = {}; // scorecard_id -> latest review_date
      if (scorecardIds.length > 0) {
        const { data: reviews } = await supabase
          .from("performance_reviews")
          .select("scorecard_id, review_date")
          .in("scorecard_id", scorecardIds)
          .not("review_date", "is", null)
          .order("review_date", { ascending: false });

        if (reviews) {
          for (const rev of reviews as { scorecard_id: string; review_date: string }[]) {
            if (!reviewMap[rev.scorecard_id]) {
              reviewMap[rev.scorecard_id] = rev.review_date;
            }
          }
        }
      }

      // Build cards
      const built: SupplierPlanCard[] = (plans as any[]).map((plan: any) => {
        const supplier = plan.suppliers;
        const scorecards: { id: string; status: string }[] = plan.scorecards || [];

        const activeScorecardCount = scorecards.filter((s) => s.status === "active").length;

        // Most recent review date across all scorecards for this plan
        const reviewDates = scorecards
          .map((s) => reviewMap[s.id])
          .filter(Boolean) as string[];
        reviewDates.sort((a, b) => (b > a ? 1 : -1));
        const lastReviewDate = reviewDates[0] ?? null;

        return {
          planId: plan.id,
          supplierId: supplier.id,
          supplierName: supplier.name,
          apexNumber: supplier.apex_number ?? null,
          quadrant: (plan.segmentation_quadrant as SegmentationQuadrant) ?? null,
          activeScorecardCount,
          lastReviewDate,
        };
      });

      // Sort by supplier name
      built.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
      setCards(built);
    } catch (err: any) {
      console.error("fetchPlans error:", err);
      setError("Failed to load supplier performance data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlans();
  }, []);

  // ── Modal supplier search ──────────────────────────────────────────────────
  const searchModalSuppliers = useCallback(async (query: string) => {
    setModalLoading(true);
    try {
      let q = supabase
        .from("suppliers")
        .select("id, name, apex_number, status")
        .order("name")
        .limit(20);

      if (query.trim()) {
        q = q.ilike("name", `%${query.trim()}%`);
      }

      const { data } = await q;
      setModalResults((data as Supplier[]) || []);
    } catch {
      setModalResults([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const timer = setTimeout(() => searchModalSuppliers(modalQuery), 250);
    return () => clearTimeout(timer);
  }, [modalQuery, showModal, searchModalSuppliers]);

  // Pre-load results when modal opens
  useEffect(() => {
    if (showModal) {
      setModalQuery("");
      setModalResults([]);
      setCreateError("");
      searchModalSuppliers("");
    }
  }, [showModal, searchModalSuppliers]);

  // ── Create plan and navigate ───────────────────────────────────────────────
  async function handleSelectSupplier(supplier: Supplier) {
    setCreating(true);
    setCreateError("");
    try {
      const user = getUser();

      const { data: plan, error: insertErr } = await supabase
        .from("development_plans")
        .insert({
          supplier_id: supplier.id,
          name: `Development Plan – ${supplier.name}`,
          review_frequency: "quarterly",
          status: "active",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      if (!plan) throw new Error("No plan returned after insert.");

      setShowModal(false);
      router.push(`/supplier-performance/suppliers/${supplier.id}/development-plans`);
    } catch (err: any) {
      console.error("create plan error:", err);
      setCreateError("Failed to create development plan. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Filtered cards ─────────────────────────────────────────────────────────
  const filteredCards = cards.filter((c) =>
    c.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier Performance</h1>
          <p className="page-subtitle">
            Manage supplier development plans, scorecards, and performance reviews
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Supplier
        </button>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: "24px", maxWidth: "380px" }}>
        <div style={{ position: "relative" }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            aria-hidden="true"
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="#94a3b8" strokeWidth="1.5" />
            <path d="M10.5 10.5l3 3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="form-input"
            style={{ paddingLeft: "34px" }}
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{ padding: "20px", opacity: 0.5, animation: "pulse 1.5s infinite" }}
            >
              <div style={{ height: "16px", background: "#e2e8f0", borderRadius: "4px", marginBottom: "12px", width: "60%" }} />
              <div style={{ height: "12px", background: "#e2e8f0", borderRadius: "4px", marginBottom: "8px", width: "40%" }} />
              <div style={{ height: "12px", background: "#e2e8f0", borderRadius: "4px", width: "50%" }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredCards.length === 0 && (
        <div
          className="card"
          style={{ padding: "48px 32px", textAlign: "center" }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.4 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ display: "inline-block" }} aria-hidden="true">
              <rect x="4" y="8" width="40" height="32" rx="4" stroke="#94a3b8" strokeWidth="2" fill="none" />
              <path d="M4 16h40M16 8v8M32 8v8" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              <circle cx="24" cy="28" r="5" stroke="#94a3b8" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
            {search ? "No suppliers match your search" : "No active supplier development plans"}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {search
              ? "Try a different search term."
              : "Click \"Add Supplier\" to create the first development plan."}
          </p>
        </div>
      )}

      {/* Cards grid */}
      {!loading && filteredCards.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredCards.map((card) => (
            <SupplierCard
              key={card.planId}
              card={card}
              onClick={() =>
                router.push(
                  `/supplier-performance/suppliers/${card.supplierId}/development-plans`
                )
              }
            />
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showModal && (
        <AddSupplierModal
          query={modalQuery}
          setQuery={setModalQuery}
          results={modalResults}
          loading={modalLoading}
          creating={creating}
          error={createError}
          onSelect={handleSelectSupplier}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Supplier card ────────────────────────────────────────────────────────────
function SupplierCard({
  card,
  onClick,
}: {
  card: SupplierPlanCard;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const quadrantStyle =
    card.quadrant && QUADRANT_COLORS[card.quadrant]
      ? QUADRANT_COLORS[card.quadrant]
      : { bg: "#f1f5f9", color: "#64748b" };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "white",
        border: `1px solid ${hovered ? "var(--usps-blue)" : "var(--border)"}`,
        borderRadius: "8px",
        padding: "20px",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: hovered
          ? "0 4px 12px rgba(0, 75, 135, 0.12)"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Top row: name + quadrant badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: "1.3",
            flex: 1,
          }}
        >
          {card.supplierName}
        </span>
        {card.quadrant && (
          <span
            className="badge"
            style={{
              background: quadrantStyle.bg,
              color: quadrantStyle.color,
              flexShrink: 0,
            }}
          >
            {QUADRANT_LABELS[card.quadrant]}
          </span>
        )}
      </div>

      {/* APEX */}
      <div style={{ marginBottom: "14px" }}>
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            fontWeight: 500,
          }}
        >
          APEX:&nbsp;
        </span>
        <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: 600 }}>
          {card.apexNumber || "—"}
        </span>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          paddingTop: "12px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <Stat label="Active Scorecards" value={String(card.activeScorecardCount)} />
        <Stat
          label="Last Review"
          value={card.lastReviewDate ? formatDateShort(card.lastReviewDate) : "—"}
        />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--usps-blue)" }}>
        {value}
      </div>
    </div>
  );
}

// ─── Add Supplier Modal ───────────────────────────────────────────────────────
function AddSupplierModal({
  query,
  setQuery,
  results,
  loading,
  creating,
  error,
  onSelect,
  onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Supplier[];
  loading: boolean;
  creating: boolean;
  error: string;
  onSelect: (s: Supplier) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 999,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "white",
          borderRadius: "10px",
          width: "100%",
          maxWidth: "520px",
          zIndex: 1000,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
              Add Supplier to Performance Hub
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              Search and select a supplier to create a development plan
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--text-muted)",
              lineHeight: 1,
              borderRadius: "4px",
            }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ position: "relative" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            >
              <circle cx="6.5" cy="6.5" r="5" stroke="#94a3b8" strokeWidth="1.5" />
              <path d="M10.5 10.5l3 3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              autoFocus
              className="form-input"
              style={{ paddingLeft: "34px" }}
              placeholder="Type supplier name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={creating}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ margin: "12px 24px 0" }}>
            {error}
          </div>
        )}

        {/* Results list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 24px 20px" }}>
          {loading && (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              {query.trim() ? "No suppliers found." : "No suppliers available."}
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onSelect(s)}
                    disabled={creating}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "10px 12px",
                      background: "none",
                      border: "1px solid transparent",
                      borderRadius: "6px",
                      cursor: creating ? "not-allowed" : "pointer",
                      textAlign: "left",
                      transition: "background 0.12s, border-color 0.12s",
                      marginBottom: "4px",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--usps-blue-light)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--usps-blue)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "none";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--text)",
                          marginBottom: "2px",
                        }}
                      >
                        {s.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {s.apex_number ? `APEX: ${s.apex_number}` : "No APEX"}
                        {s.status && (
                          <>
                            &nbsp;&bull;&nbsp;
                            <span
                              style={{
                                textTransform: "capitalize",
                                color:
                                  s.status === "active"
                                    ? "var(--success)"
                                    : "var(--text-muted)",
                              }}
                            >
                              {s.status.replace(/_/g, " ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      style={{ flexShrink: 0, opacity: 0.4 }}
                      aria-hidden="true"
                    >
                      <path
                        d="M5 3l4 4-4 4"
                        stroke="var(--usps-blue)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Creating overlay hint */}
          {creating && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--usps-blue)",
              }}
            >
              Creating development plan...
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
