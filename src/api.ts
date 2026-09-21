export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ detail: "服务暂时无法连接" }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  }
  return response.json();
}
export const post = (path: string, data?: unknown) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export const money = (v: number | null | undefined, digits = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("zh-CN", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
export const wan = (v: number | null | undefined) =>
  v == null ? "—" : money(v / 10000, 1);
export const date = (v: string) =>
  new Date(v).toLocaleString("zh-CN", { hour12: false });
