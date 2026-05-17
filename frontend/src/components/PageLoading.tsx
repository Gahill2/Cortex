export function PageLoading() {
  return (
    <div
      className="d-flex align-items-center justify-content-center flex-grow-1 min-vh-0"
      style={{
        background: "var(--bg)",
        color: "rgba(255, 255, 255, 0.42)",
      }}
    >
      <div
        className="rounded-circle"
        role="status"
        aria-label="Loading"
        style={{
          width: 28,
          height: 28,
          border: "2px solid rgba(255, 255, 255, 0.1)",
          borderTopColor: "rgba(255, 255, 255, 0.45)",
          animation: "cortex-page-loading-spin 0.65s linear infinite",
        }}
      />
      <style>{`
        @keyframes cortex-page-loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
