export const MOCK_STATUS = {
  role: "薪酬负责人 / 管理员",
  ai_mode: "mock",
  backend: false,
  active_id: "local-demo",
  versions: [
    {
      id: "local-demo",
      name: "薪衡本地演示数据",
      source: "demo",
      created_at: "2026-09-21T00:00:00Z",
      tables: {},
    },
  ],
  months: Array.from(
    { length: 24 },
    (_, i) =>
      `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
  ),
  currencies: ["CNY"],
  organizations: [
    { organization_id: "D1", organization_name: "销售中心" },
    { organization_id: "D2", organization_name: "运营中心" },
    { organization_id: "D3", organization_name: "研发中心" },
  ],
};
export const MOCK_DASHBOARD = {
  empty: false,
  year: 2026,
  currency: "CNY",
  latest: "2026-12",
  months: 12,
  headcount: 145,
  cash: 45719494,
  cost: 54520804,
  median: 19096,
  average_cr: 1.06,
  cr_coverage: 145,
  below_band: 9,
  above_band: 24,
  commission: 2990000,
  changed_employees: 139,
  market_coverage: 145,
  trends: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    cost: 3900000 + i * 37000,
    cash: 3270000 + i * 31000,
    headcount: 145,
    commission: 180000 + i * 4000,
  })),
  organizations: [
    {
      id: "D1",
      name: "销售中心",
      headcount: 47,
      cost: 17895000,
      average: 17706,
      revenue: 48000000,
      cost_ratio: 37.3,
    },
    {
      id: "D2",
      name: "运营中心",
      headcount: 49,
      cost: 14873000,
      average: 16841,
      revenue: 49900000,
      cost_ratio: 29.8,
    },
    {
      id: "D3",
      name: "研发中心",
      headcount: 49,
      cost: 21753000,
      average: 25010,
      revenue: 52600000,
      cost_ratio: 41.3,
    },
  ],
  distribution: [
    { name: "1万以下", value: 12 },
    { name: "1–2万", value: 67 },
    { name: "2–3万", value: 52 },
    { name: "3–4万", value: 11 },
    { name: "4万以上", value: 3 },
  ],
  grades: [
    { grade: "P4", count: 23, p25: 8500, median: 10550, p75: 12500 },
    { grade: "P5", count: 60, p25: 14500, median: 18041, p75: 21600 },
    { grade: "P6", count: 39, p25: 17500, median: 20256, p75: 27600 },
    { grade: "P7", count: 20, p25: 23000, median: 28749, p75: 33000 },
    { grade: "P8", count: 3, p25: 43000, median: 54227, p75: 68000 },
  ],
  employees: Array.from({ length: 15 }, (_, i) => ({
    employee_id: `E${String(i + 1).padStart(4, "0")}`,
    employee_name: `演示员工${String(i + 1).padStart(3, "0")}`,
    organization_name: ["销售中心", "运营中心", "研发中心"][i % 3],
    grade: `P${4 + (i % 5)}`,
    standard_monthly_fixed_pay: 9000 + i * 1200,
    gross_cash_pay: 32000 + i * 2200,
    total_employer_cost: 35000 + i * 2400,
    cr: 0.8 + (i % 6) * 0.07,
    market_ratio: 0.76 + (i % 5) * 0.08,
    band_min: 9500,
    band_max: 30000,
  })),
};

export function makeMockRun(constraints: any = {}) {
  const budget = Number(constraints.budget || 1000000);
  const monthly = Math.min(budget / 12, 41666.38);
  const cost = Math.round(monthly * 12 * 100) / 100;
  const adjusted = Math.min(63, Math.floor(monthly / 620));
  const scenario = {
    id: `local-scenario-${Date.now()}`,
    version: 1,
    constraints: {
      ...constraints,
      name: constraints.name || "线上演示薪酬校准方案",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return {
    id: `local-run-${Date.now()}`,
    created_at: new Date().toISOString(),
    mode: "mock",
    dataset: { id: "netlify-demo", name: "薪衡线上演示数据", source: "demo" },
    scenario,
    simulation: {
      adjusted,
      eligible: 145,
      months: 12,
      monthly_increase: Math.round(monthly * 100) / 100,
      budget_cost: cost,
      annualized_cost: cost,
      remaining_budget: Math.round((budget - cost) * 100) / 100,
      average_raise_pct: 5.4,
      method:
        "前端 Mock 演示：按 12 个月固定薪酬增量测算，不含额外计薪月、浮动薪酬和公司缴费。",
      employees: MOCK_DASHBOARD.employees.map((e: any) => ({
        ...e,
        monthly_increase:
          e.employee_id <= `E${String(adjusted).padStart(4, "0")}`
            ? Math.round((monthly / Math.max(adjusted, 1)) * 100) / 100
            : 0,
        raise_pct: 5.4,
      })),
    },
    findings: [
      {
        title: "薪酬区间检查",
        text: `演示数据中有 ${MOCK_DASHBOARD.below_band} 位员工低于内部薪酬区间、${MOCK_DASHBOARD.above_band} 位员工高于区间。建议先核对岗位、职级与适用薪酬标准。`,
        basis: "Mock 模板建议；依据内置演示数据。",
      },
      {
        title: "预算与调整空间",
        text: `当前条件下建议调整约 ${adjusted} 人，预算口径增量约 ${cost.toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元，剩余预算约 ${Math.max(0, budget - cost).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元。`,
        basis: "规则测算结果；不由模型临时推算。",
      },
      {
        title: "实施前建议",
        text: "核对关键岗位和绩效背景，再将公司缴费、额外计薪月与浮动薪酬联动补入完整预算。",
        basis: "Mock 模板建议。",
      },
    ],
  };
}
