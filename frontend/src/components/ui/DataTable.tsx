import type { ReactNode, CSSProperties } from "react";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  render?: (row: T) => ReactNode;
}

interface EmptyAction {
  label: string;
  onClick: () => void;
}

interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyAction?: EmptyAction;
}

const skeletonContainerStyle: CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const theadStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "var(--bg-2)",
};

const thStyle: CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "var(--text-3)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  verticalAlign: "middle",
};

export function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = "No data",
  emptyAction,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={skeletonContainerStyle}>
        <Skeleton variant="table" lines={5} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Desktop table — hidden on mobile via CSS */}
      <div className="data-table-wrapper">
        <table style={tableStyle} className="data-table">
          <thead style={theadStyle}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ ...thStyle, width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="data-table-row"
                style={{ transition: "background 100ms" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={tdStyle}>
                    {col.render
                      ? col.render(row)
                      : (row as Record<string, unknown>)[col.key] != null
                      ? String((row as Record<string, unknown>)[col.key])
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack — shown only at ≤768px via CSS */}
      <div className="data-table-cards">
        {data.map((row, rowIdx) => (
          <div key={rowIdx} className="data-table-card">
            {columns.map((col) => (
              <div key={col.key} className="data-table-card-row">
                <span className="data-table-card-label">{col.label}</span>
                <span className="data-table-card-value">
                  {col.render
                    ? col.render(row)
                    : (row as Record<string, unknown>)[col.key] != null
                    ? String((row as Record<string, unknown>)[col.key])
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
