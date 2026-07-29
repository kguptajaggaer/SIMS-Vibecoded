"use client";

import { useState, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ─── Constants ──────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  { header: "ContractNo",           field: "contract_number",       required: true,  description: "Unique contract number" },
  { header: "VendorName",           field: "supplier_name",         required: true,  description: "Legal name of the vendor / supplier" },
  { header: "VendorAPEX",           field: "supplier_apex",         required: false, description: "Vendor APEX system identifier" },
  { header: "Portfolios",           field: "portfolios",            required: false, description: "Portfolio(s) associated with this contract" },
  { header: "Commodity",            field: "commodity",             required: false, description: "Commodity or service category" },
  { header: "VendorContact",        field: "vendor_contact",        required: false, description: "Primary vendor contact name" },
  { header: "ContractAmount",       field: "contract_amount",       required: false, description: "Total contract value in USD (numbers only)" },
  { header: "ContractOfficer",      field: "contract_officer",      required: true,  description: "Full name of the contracting officer" },
  { header: "ContractOfficerEmail", field: "contract_officer_email",required: false, description: "Email address of the contracting officer" },
  { header: "StartDate",            field: "start_date",            required: false, description: "Contract start date (YYYY-MM-DD or MM/DD/YYYY)" },
  { header: "ExpirationDate",       field: "expiration_date",       required: false, description: "Contract expiration date (YYYY-MM-DD or MM/DD/YYYY)" },
  { header: "Comments",             field: "comments",              required: false, description: "General comments or notes" },
  { header: "Exception",            field: "exception",             required: false, description: "Exception type or justification, if applicable" },
  { header: "Status",               field: null,                    required: false, description: "Informational status label (not stored in database)" },
] as const;

const PREVIEW_ROWS = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow {
  ContractNo: string;
  VendorName: string;
  VendorAPEX: string;
  Portfolios: string;
  Commodity: string;
  VendorContact: string;
  ContractAmount: string;
  ContractOfficer: string;
  ContractOfficerEmail: string;
  StartDate: string;
  ExpirationDate: string;
  Comments: string;
  Exception: string;
  Status: string;
  [key: string]: string;
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // MM/DD/YYYY
  const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  // Split a CSV line respecting quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] ?? "";
    });
    rows.push(row as ParsedRow);
  }

  return rows;
}

function buildSampleCSV(): string {
  const headers = CSV_COLUMNS.map((c) => c.header).join(",");
  const example = [
    "C-2024-001",
    "Acme Supplies LLC",
    "APEX-00123",
    "Logistics",
    "Office Supplies",
    "Jane Smith",
    "250000",
    "John Doe",
    "john.doe@usps.gov",
    "2024-01-01",
    "2025-12-31",
    "Annual renewal",
    "",
    "Active",
  ].join(",");
  return `${headers}\n${example}\n`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubKContractImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string>("");

  // ── Download sample CSV ──────────────────────────────────────────────────

  function handleDownloadSample() {
    const csvContent = buildSampleCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "subk_contracts_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── File selection ───────────────────────────────────────────────────────

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setParseError("");
    setParsedRows([]);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Only CSV files are accepted. Please select a .csv file.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setParseError("The file appears to be empty or has no data rows.");
          return;
        }
        setParsedRows(rows);
      } catch {
        setParseError("Failed to parse CSV. Please check the file format.");
      }
    };
    reader.readAsText(file);
  }

  // ── Import ───────────────────────────────────────────────────────────────

  async function handleImport() {
    if (parsedRows.length === 0) return;

    setImporting(true);
    setResult(null);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowLabel = `Row ${i + 2}`; // +2 because row 1 is headers

      // Validate required fields
      if (!row.ContractNo?.trim()) {
        errors.push(`${rowLabel}: ContractNo is required.`);
        errorCount++;
        continue;
      }
      if (!row.VendorName?.trim()) {
        errors.push(`${rowLabel} (${row.ContractNo}): VendorName is required.`);
        errorCount++;
        continue;
      }
      if (!row.ContractOfficer?.trim()) {
        errors.push(`${rowLabel} (${row.ContractNo}): ContractOfficer is required.`);
        errorCount++;
        continue;
      }

      const record = {
        contract_number:       row.ContractNo.trim(),
        supplier_name:         row.VendorName.trim(),
        supplier_apex:         row.VendorAPEX?.trim() || null,
        portfolios:            row.Portfolios?.trim() || null,
        commodity:             row.Commodity?.trim() || null,
        vendor_contact:        row.VendorContact?.trim() || null,
        contract_amount:       row.ContractAmount?.trim()
                                 ? parseFloat(row.ContractAmount.replace(/[$,]/g, ""))
                                 : null,
        contract_officer:      row.ContractOfficer.trim(),
        contract_officer_email: row.ContractOfficerEmail?.trim() || null,
        start_date:            parseDate(row.StartDate),
        expiration_date:       parseDate(row.ExpirationDate),
        comments:              row.Comments?.trim() || null,
        exception:             row.Exception?.trim() || null,
        contract_type:         "subk" as const,
      };

      const { error } = await supabase
        .from("contracts")
        .upsert(record, { onConflict: "contract_number" });

      if (error) {
        errors.push(`${rowLabel} (${row.ContractNo}): ${error.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    }

    setResult({ successCount, errorCount, errors });
    setImporting(false);
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  function handleReset() {
    setParsedRows([]);
    setFileName("");
    setResult(null);
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const previewRows = parsedRows.slice(0, PREVIEW_ROWS);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>

      {/* Back link */}
      <div style={{ marginBottom: "16px" }}>
        <Link
          href="/compliance/subk/contracts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--usps-blue)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to SubK Contracts
        </Link>
      </div>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Import SubK Contracts</h1>
          <p className="page-subtitle">
            Bulk-load contracts from a CSV file. Download the template, fill in your data, then upload.
          </p>
        </div>
      </div>

      {/* ── Section 1: Download Sample File ── */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h2 className="card-title">Download Sample File</h2>
        </div>
        <div className="card-body">
          <p style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--text-muted)" }}>
            Use the template below as a starting point. The first row must contain the column headers
            exactly as shown. Required columns are marked with an asterisk (*).
          </p>

          {/* Column list */}
          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Column Header</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {CSV_COLUMNS.map((col) => (
                  <tr key={col.header}>
                    <td>
                      <code
                        style={{
                          background: "#f1f5f9",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          color: "var(--usps-blue)",
                        }}
                      >
                        {col.header}
                      </code>
                      {col.required && (
                        <span style={{ color: "var(--usps-red)", marginLeft: "4px", fontWeight: 700 }}>*</span>
                      )}
                    </td>
                    <td>
                      {col.required ? (
                        <span className="badge badge-red">Required</span>
                      ) : (
                        <span className="badge badge-gray">Optional</span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>{col.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-outline" onClick={handleDownloadSample}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M7.5 1v9M4 7l3.5 3.5L11 7M2 13h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download CSV Template
          </button>
        </div>
      </div>

      {/* ── Section 2: Import File ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Import File</h2>
        </div>
        <div className="card-body">

          {/* File picker */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label" htmlFor="csv-upload">
              Select CSV File
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{
                  fontSize: "13px",
                  color: "var(--text)",
                  border: "1.5px solid var(--border)",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  background: "white",
                  cursor: "pointer",
                  flex: 1,
                  minWidth: "220px",
                  maxWidth: "420px",
                }}
              />
              {parsedRows.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleReset}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
            {fileName && parsedRows.length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                {fileName} — {parsedRows.length} data row{parsedRows.length !== 1 ? "s" : ""} detected
              </p>
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="alert alert-error" style={{ marginBottom: "16px" }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7.5 4.5v3.5M7.5 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                Preview
                {parsedRows.length > PREVIEW_ROWS && (
                  <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "6px" }}>
                    (showing first {PREVIEW_ROWS} of {parsedRows.length} rows)
                  </span>
                )}
              </p>
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      {CSV_COLUMNS.map((col) => (
                        <th key={col.header}>{col.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx}>
                        {CSV_COLUMNS.map((col) => (
                          <td
                            key={col.header}
                            style={{
                              maxWidth: "180px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={row[col.header] ?? ""}
                          >
                            {row[col.header] || (
                              <span style={{ color: "var(--border)" }}>—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div style={{ marginBottom: "16px" }}>
              {result.successCount > 0 && (
                <div className="alert alert-success" style={{ marginBottom: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M4.5 7.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {result.successCount} contract{result.successCount !== 1 ? "s" : ""} imported successfully.
                </div>
              )}
              {result.errorCount > 0 && (
                <div className="alert alert-error" style={{ marginBottom: "8px", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M7.5 4.5v3.5M7.5 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {result.errorCount} row{result.errorCount !== 1 ? "s" : ""} failed to import.
                  </div>
                  {result.errors.length > 0 && (
                    <ul style={{ margin: "0 0 0 24px", padding: 0, fontSize: "12px", lineHeight: "1.7" }}>
                      {result.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={parsedRows.length === 0 || importing}
              type="button"
            >
              {importing ? (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  >
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" strokeDasharray="22" strokeDashoffset="8" strokeLinecap="round"/>
                  </svg>
                  Importing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 7l3 3 9-9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Import {parsedRows.length > 0 ? `${parsedRows.length} Record${parsedRows.length !== 1 ? "s" : ""}` : "Records"}
                </>
              )}
            </button>
            {parsedRows.length > 0 && !importing && (
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Existing contracts with the same ContractNo will be updated.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Spin keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
