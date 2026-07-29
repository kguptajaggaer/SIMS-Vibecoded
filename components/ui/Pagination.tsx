import React from "react";

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Build a window of up to 5 page numbers centred on the current page.
  const getPageNumbers = (): number[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let windowStart = Math.max(1, page - 2);
    let windowEnd = windowStart + 4;
    if (windowEnd > totalPages) {
      windowEnd = totalPages;
      windowStart = Math.max(1, windowEnd - 4);
    }
    return Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      {/* Results summary */}
      <p className="text-sm text-base-content/70">
        {total === 0
          ? "No results"
          : `Showing ${start}–${end} of ${total} result${total !== 1 ? "s" : ""}`}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          className="btn btn-sm btn-outline btn-ghost"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          &lsaquo; Prev
        </button>

        {/* Page numbers */}
        {pageNumbers.map((p) => (
          <button
            key={p}
            className={`btn btn-sm ${
              p === page ? "btn-outline" : "btn-ghost"
            }`}
            onClick={() => onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ))}

        {/* Next */}
        <button
          className="btn btn-sm btn-outline btn-ghost"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next &rsaquo;
        </button>
      </div>
    </div>
  );
}

export default Pagination;
