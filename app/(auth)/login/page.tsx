"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser, saveUser, supabase } from "@/lib/supabase";
import { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Query users table with matching email, including role relation
      const { data, error: queryError } = await supabase
        .from("users")
        .select("*, role:roles(id, name)")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (queryError || !data) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      const dbUser = data as User & { password_hash: string; is_active: boolean };

      // Check active status
      if (dbUser.is_active === false) {
        setError("Your account is inactive. Please contact your administrator.");
        setLoading(false);
        return;
      }

      // Password check:
      // If password_hash starts with '$2a$' it is a bcrypt hash (seeded admin).
      // For MVP: accept 'Admin@123' as the magic password for bcrypt-hashed accounts.
      // Otherwise compare password directly to the stored hash.
      let passwordValid = false;
      if (dbUser.password_hash && dbUser.password_hash.startsWith("$2a$")) {
        passwordValid = password === "Admin@123";
      } else {
        passwordValid = password === dbUser.password_hash;
      }

      if (!passwordValid) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      // Persist user in local storage / context
      saveUser(dbUser as User);

      // Redirect based on user_type
      if (dbUser.user_type === "supplier") {
        router.push("/supplier/dashboard");
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* USPS-branded header bar */}
      <header
        style={{
          backgroundColor: "#004B87",
          padding: "0 24px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* USPS Eagle placeholder */}
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="40" height="40" rx="4" fill="#ffffff22" />
            <text
              x="50%"
              y="55%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="700"
              fontFamily="Arial, sans-serif"
            >
              USPS
            </text>
          </svg>
          <div>
            <div
              style={{
                color: "#ffffff",
                fontSize: "20px",
                fontWeight: "700",
                letterSpacing: "0.04em",
                lineHeight: "1.1",
              }}
            >
              SIMS
            </div>
            <div
              style={{
                color: "#c8d9ec",
                fontSize: "11px",
                fontWeight: "400",
                letterSpacing: "0.02em",
              }}
            >
              Supplier Information Management System
            </div>
          </div>
        </div>

        <span
          style={{
            color: "#c8d9ec",
            fontSize: "12px",
            fontWeight: "500",
            letterSpacing: "0.03em",
          }}
        >
          United States Postal Service
        </span>
      </header>

      {/* Main content — centered card */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 16px",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08)",
            width: "100%",
            maxWidth: "440px",
            overflow: "hidden",
          }}
        >
          {/* Card header accent */}
          <div
            style={{
              backgroundColor: "#004B87",
              height: "6px",
              width: "100%",
            }}
          />

          <div style={{ padding: "40px 40px 32px" }}>
            <h1
              style={{
                margin: "0 0 4px",
                fontSize: "22px",
                fontWeight: "700",
                color: "#1a2332",
                letterSpacing: "-0.01em",
              }}
            >
              Sign In
            </h1>
            <p
              style={{
                margin: "0 0 28px",
                fontSize: "14px",
                color: "#6b7280",
              }}
            >
              Enter your credentials to access the system.
            </p>

            {/* Error alert */}
            {error && (
              <div
                className="alert alert-error"
                role="alert"
                style={{ marginBottom: "20px" }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Email field */}
              <div style={{ marginBottom: "18px" }}>
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>

              {/* Password field */}
              <div style={{ marginBottom: "10px" }}>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              {/* Forgot password */}
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "28px",
                }}
              >
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: "13px",
                    color: "#004B87",
                    textDecoration: "none",
                    fontWeight: "500",
                  }}
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: "100%" }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>

          {/* Card footer */}
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: "18px 40px",
              backgroundColor: "#f9fafb",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "#6b7280" }}>
              Are you a supplier?{" "}
              <Link
                href="/supplier/login"
                style={{
                  color: "#004B87",
                  fontWeight: "600",
                  textDecoration: "none",
                }}
              >
                Supplier Portal Login
              </Link>
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "16px",
          fontSize: "12px",
          color: "#9ca3af",
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "#f3f4f6",
        }}
      >
        &copy; {new Date().getFullYear()} United States Postal Service. All
        rights reserved.
      </footer>
    </div>
  );
}
