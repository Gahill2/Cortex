import { CortexBrand } from "./brand/CortexBrand";

export function PageLoading() {
  return (
    <div className="page-loading-panel" role="status" aria-label="Loading Cortex">
      <CortexBrand variant="appbar" />
      <div className="page-loading-spinner" aria-hidden />
    </div>
  );
}
