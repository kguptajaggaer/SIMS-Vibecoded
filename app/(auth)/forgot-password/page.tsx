"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await fetch("/api/email/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      // Silently ignore — always show success to prevent email enumeration
    }
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      {/* USPS Header Bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, var(--usps-blue) 70%, var(--usps-red) 70%)",
          zIndex: 100,
        }}
      />

      {/* Logo / Branding */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "var(--usps-blue)",
            marginBottom: 12,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>
          United States Postal Service
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--usps-blue)", letterSpacing: "-0.01em" }}>
          SIMS
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          Supplier Information Management System
        </div>
      </div>

      {/* Card */}
      <div
        className="card"
        style={{ width: "100%", maxWidth: 420 }}
      >
        {/* Card top accent */}
        <div style={{ height: 4, background: "var(--usps-blue)", borderRadius: "8px 8px 0 0" }} />

        <div className="card-body" style={{ padding: "32px 32px 28px" }}>
          {!submitted ? (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
                Enter the email address associated with your SIMS account and we will send you a link to reset your password.
              </p>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="you@usps.gov"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--success-bg)",
                  marginBottom: 16,
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="var(--success)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
                Check your inbox
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 24px" }}>
                If an account exists for{" "}
                <strong style={{ color: "var(--text)" }}>{email}</strong>, a password reset link has been sent. Please check your inbox and spam folder.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}
                onClick={() => { setSubmitted(false); setEmail(""); }}
              >
                Try a different email
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <Link
              href="/login"
              style={{
                fontSize: 13,
                color: "var(--usps-blue)",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M19 12H5m7-7l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
        &copy; {new Date().getFullYear()} United States Postal Service. All rights reserved.
      </p>
    </div>
  );
}
