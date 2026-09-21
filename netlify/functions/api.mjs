// Lightweight demo backend for the Netlify preview. Production data processing remains in backend/main.py.
const status = {
  role: "薪酬负责人 / 管理员", ai_mode: "mock", backend: true, active_id: "netlify-demo",
  versions: [{ id: "netlify-demo", name: "薪衡线上演示数据", source: "demo", created_at: new Date().toISOString(), tables: {} }],
  months: Array.from({ length: 24 }, (_, i) => `${2025 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`),
  currencies: ["CNY"], organizations: [{ organization_id: "D1", organization_name: "销售中心" }, { organization_id: "D2", organization_name: "运营中心" }, { organization_id: "D3", organization_name: "研发中心" }]
};
const organizations = [{ id: "D1", name: "销售中心", headcount: 47, cost: 17895000, average: 17706, cost_ratio: 37.3 }, { id: "D2", name: "运营中心", headcount: 49, cost: 14873000, average: 16841, cost_ratio: 29.8 }, { id: "D3", name: "研发中心", headcount: 49, cost: 21753000, average: 25010, cost_ratio: 41.3 }];
const dashboard = { empty: false, year: 2026, currency: "CNY", latest: "2026-12", months: 12, headcount: 145, cash: 45719494, cost: 54520804, median: 19096, average_cr: 1.06, cr_coverage: 145, below_band: 9, above_band: 24, commission: 2990000, changed_employees: 139, market_coverage: 145,
  trends: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, cost: 3900000 + i * 37000, cash: 3270000 + i * 31000, headcount: 145, commission: 180000 + i * 4000 })), organizations,
  distribution: [{ name: "1万以下", value: 12 }, { name: "1–2万", value: 67 }, { name: "2–3万", value: 52 }, { name: "3–4万", value: 11 }, { name: "4万以上", value: 3 }],
  grades: [{ grade: "P4", count: 23, p25: 8500, median: 10550, p75: 12500 }, { grade: "P5", count: 60, p25: 14500, median: 18041, p75: 21600 }, { grade: "P6", count: 39, p25: 17500, median: 20256, p75: 27600 }, { grade: "P7", count: 20, p25: 23000, median: 28749, p75: 33000 }, { grade: "P8", count: 3, p25: 43000, median: 54227, p75: 68000 }],
  employees: Array.from({ length: 15 }, (_, i) => ({ employee_id: `E${String(i + 1).padStart(4, "0")}`, employee_name: `演示员工${String(i + 1).padStart(3, "0")}`, organization_name: ["销售中心", "运营中心", "研发中心"][i % 3], grade: `P${4 + (i % 5)}`, standard_monthly_fixed_pay: 9000 + i * 1200, gross_cash_pay: 32000 + i * 2200, total_employer_cost: 35000 + i * 2400, cr: 0.8 + (i % 6) * 0.07, market_ratio: 0.76 + (i % 5) * 0.08, band_min: 9500, band_max: 30000 })) };

export default async (req) => {
  const path = req.path || new URL(req.url).pathname;
  const endpoint = path.includes("/.netlify/functions/api") ? path.split("/.netlify/functions/api")[1] : path;
  if (endpoint.endsWith("/status")) return json(status);
  if (endpoint.endsWith("/schema")) return json({});
  if (endpoint.endsWith("/dashboard")) {
    const url = new URL(req.rawUrl || "https://local.invalid");
    const org = url.searchParams.get("organization_id");
    return json({ ...dashboard, year: Number(url.searchParams.get("year") || 2026), organizations: org ? organizations.filter((x) => x.id === org) : organizations });
  }
  if (endpoint.endsWith("/scenarios/defaults")) return json({ name: "线上演示薪酬校准方案", organization_id: "", baseline_month: "2026-12", effective_month: "2027-04", currency: "CNY", budget: 1000000, budget_basis: "annualized", strategy: "band", min_raise_pct: 0, max_raise_pct: 15, default_raise_pct: 5, target_cr: 1, exclude_recent_months: 3, excluded_employee_ids: [], business_context: "研发团队扩编，优先关注关键岗位。" });
  return json({ detail: "线上 Mock 后端仅提供演示读取接口；完整 Excel 导入与持久化请连接 FastAPI 服务。" }, 501);
};
function json(body, statusCode = 200) { return new Response(JSON.stringify(body), { status: statusCode, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
