/** Run a homelab sub-task without failing the whole dashboard request. */
export async function homelabSafe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[homelab] ${label} failed:`, err);
    return fallback;
  }
}
