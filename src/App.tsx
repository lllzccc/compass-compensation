import { useEffect, useState, useMemo } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Input,
  InputNumber,
  Select,
  Tag,
  Table,
  Upload,
  Modal,
  Empty,
  Spin,
  Tabs,
  Tooltip,
  Progress,
  Collapse,
} from "antd";
import {
  DashboardOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  SlidersOutlined,
  FileTextOutlined,
  SettingOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  PlusOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  CopyOutlined,
  SearchOutlined,
  ApartmentOutlined,
  ArrowLeftOutlined,
  BulbOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { api, post, money, wan, date } from "./api";
import { MOCK_STATUS, MOCK_DASHBOARD, makeMockRun } from "./mock";
import Chart from "./Chart";

type Obj = Record<string, any>;
const NAV = [
  { key: "overview", label: "薪酬总览", icon: <DashboardOutlined /> },
  { key: "people", label: "员工薪酬", icon: <TeamOutlined /> },
  { key: "sources", label: "数据接入", icon: <DatabaseOutlined /> },
  { key: "quality", label: "数据质量", icon: <SafetyCertificateOutlined /> },
  { key: "analysis", label: "AI 分析与建议", icon: <BulbOutlined /> },
  { key: "reports", label: "报告中心", icon: <FileTextOutlined /> },
];
const titles: Obj = {
  overview: ["薪酬总览", "从组织成本到个人薪酬，让每一次决策都有依据。"],
  people: ["员工薪酬", "按同期任职信息比较薪酬，追溯每一项数据。"],
  sources: ["数据接入", "从一份 Excel 开始，建立可追溯的薪酬数据集。"],
  quality: ["数据质量", "先核对数据，再形成结论。"],
  analysis: ["AI 分析与建议", "把业务约束变成可核验的调薪方案。"],
  reports: ["报告中心", "保留每次分析的数据、条件与结果。"],
  settings: ["工作台设置", "轻量、本地运行的薪酬分析空间。"],
};

export default function App() {
  const { message } = AntApp.useApp();
  const [page, setPage] = useState("overview");
  const [status, setStatus] = useState<Obj | null>(null);
  const [schema, setSchema] = useState<Obj>({});
  const [year, setYear] = useState(2026);
  const [org, setOrg] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const [dash, setDash] = useState<Obj | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [help, setHelp] = useState(false);
  const refresh = async () => {
    const s = await api("/status");
    setStatus(s);
    if (s.months.length) setYear(Number(s.months.at(-1).slice(0, 4)));
    if (s.currencies.length && !s.currencies.includes(currency))
      setCurrency(s.currencies[0]);
    setVersion((v) => v + 1);
    return s;
  };
  useEffect(() => {
    Promise.all([refresh(), api("/schema").then(setSchema)]).catch(() => {
      setStatus(MOCK_STATUS);
      setDash(MOCK_DASHBOARD);
      setSchema({});
      setError("后端未连接，当前使用浏览器内置 Mock 演示数据");
    });
  }, []);
  useEffect(() => {
    let live = true;
    if (!status?.active_id) return;
    setLoading(true);
    setDash(null);
    api(
      `/dashboard?year=${year}&organization_id=${encodeURIComponent(org)}&currency=${currency}&dataset_id=${status.active_id}`,
    )
      .then((d) => {
        if (live) {
          setDash(d);
          setError("");
        }
      })
      .catch(() => {
        if (live)
          setDash({
            ...MOCK_DASHBOARD,
            year,
            currency,
            organizations: org
              ? MOCK_DASHBOARD.organizations.filter((x) => x.id === org)
              : MOCK_DASHBOARD.organizations,
          });
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [status?.active_id, year, org, currency, version]);
  const demo = async () => {
    setBusy(true);
    try {
      await post("/demo");
      await refresh();
      message.success("已载入虚拟数据，可切换年份与组织查看");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const active = status?.versions.find((v: Obj) => v.id === status.active_id);
  const common = { status, schema, refresh, message };
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-symbol">衡</span>
          <span>
            薪衡<span className="brand-en">COMPASS</span>
          </span>
        </a>
        <div className="workspace-label">薪酬决策工作台</div>
        <div className="workspace">
          <span className="workspace-avatar">薪</span>
          <div>
            薪酬管理空间<small>管理员工作区</small>
          </div>
          <span className="live-dot" />
        </div>
        <div className="nav-caption">工作台</div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.key}
              aria-label={item.label}
              title={item.label}
              onClick={() => setPage(item.key)}
              className={page === item.key ? "nav-item active" : "nav-item"}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.key === "analysis" && <span className="nav-ai">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="live-dot" />
            <b>本地数据空间</b>
            <p>
              文件留存在本机
              <br />
              每次分析独立保存
            </p>
          </div>
          <button
            className={"nav-item " + (page === "settings" ? "active" : "")}
            onClick={() => setPage("settings")}
          >
            <SettingOutlined />
            工作台设置
          </button>
          <div className="profile">
            <span className="avatar">管</span>
            <div>
              薪酬负责人<small>管理员</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            工作台 <span>/</span> <b>{titles[page][0]}</b>
          </div>
          <div className="topbar-right">
            <span className="mock-badge">
              <ExperimentOutlined /> Mock 演示模式
            </span>
            <span className="divider" />
            <Tooltip title="使用说明">
              <Button
                type="text"
                aria-label="使用说明"
                icon={<InfoCircleOutlined />}
                onClick={() => setHelp(true)}
              />
            </Tooltip>
            <span className="avatar small">管</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">COMPENSATION INTELLIGENCE</div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            <div className="heading-actions">
              {page === "overview" && (
                <>
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={() => setPage("sources")}
                  >
                    导入数据
                  </Button>
                  <Button
                    type="primary"
                    icon={<BulbOutlined />}
                    onClick={() => setPage("analysis")}
                  >
                    开始 AI 分析
                  </Button>
                </>
              )}
            </div>
          </div>
          {error && (
            <Alert
              type="error"
              showIcon
              message="无法加载数据"
              description={error}
              action={
                <Button
                  onClick={() => refresh().catch((e) => setError(e.message))}
                >
                  重试
                </Button>
              }
              closable
            />
          )}
          {!status && !error ? (
            <div className="loading">
              <Spin />
              <p>正在连接本地数据空间…</p>
            </div>
          ) : (
            <>
              {!status?.active_id &&
              page !== "sources" &&
              page !== "settings" ? (
                <div className="welcome panel">
                  <div className="welcome-icon">
                    <ApartmentOutlined />
                  </div>
                  <span className="eyebrow">YOUR FIRST DATASET</span>
                  <h2>让薪酬数据，成为决策的起点</h2>
                  <p>
                    导入组织、员工、岗位职级与月度薪酬，
                    <br />
                    或用 150 名虚拟员工的数据体验完整分析流程。
                  </p>
                  <div className="button-row">
                    <Button
                      type="primary"
                      size="large"
                      loading={busy}
                      onClick={demo}
                    >
                      载入演示数据 <ArrowRightOutlined />
                    </Button>
                    <Button size="large" onClick={() => setPage("sources")}>
                      导入我的数据
                    </Button>
                  </div>
                  <small>24 个月 · 10 张关联表 · 销售 / 运营 / 研发</small>
                </div>
              ) : (
                <>
                  {["overview", "people"].includes(page) && (
                    <>
                      <div className="filterbar">
                        <div className="filter-items">
                          <Select
                            aria-label="分析年份"
                            value={year}
                            onChange={setYear}
                            options={[
                              ...new Set(
                                (status?.months || []).map((m: string) =>
                                  Number(m.slice(0, 4)),
                                ),
                              ),
                            ].map((y) => ({ value: y, label: `${y} 年` }))}
                          />
                          <Select
                            aria-label="组织范围"
                            value={org}
                            onChange={setOrg}
                            style={{ minWidth: 160 }}
                            options={[
                              { value: "", label: "全部组织" },
                              ...(status?.organizations || []).map(
                                (o: Obj) => ({
                                  value: o.organization_id,
                                  label: o.organization_name,
                                }),
                              ),
                            ]}
                          />
                          <Select
                            aria-label="币种"
                            value={currency}
                            onChange={setCurrency}
                            options={(status?.currencies || []).map(
                              (c: string) => ({ value: c, label: c }),
                            )}
                          />
                          <span className="filter-note">税前应发口径</span>
                        </div>
                        <div className="dataset-status">
                          <span className="live-dot" />
                          {active?.source === "demo"
                            ? "虚拟演示数据"
                            : "已导入数据"}
                          <Tooltip title={`${active?.name} · ${active?.id}`}>
                            <InfoCircleOutlined />
                          </Tooltip>
                        </div>
                      </div>
                      {loading ? (
                        <div className="loading">
                          <Spin />
                        </div>
                      ) : dash?.empty ? (
                        <Empty description="当前年份、组织和币种没有匹配数据" />
                      ) : (
                        dash &&
                        (page === "overview" ? (
                          <Overview
                            d={dash}
                            onAnalyze={() => setPage("analysis")}
                            onPeople={() => setPage("people")}
                            onOrg={setOrg}
                          />
                        ) : (
                          <People d={dash} />
                        ))
                      )}
                    </>
                  )}
                  {page === "sources" && (
                    <Sources {...common} busy={busy} demo={demo} />
                  )}
                  {page === "quality" && status?.active_id && (
                    <Quality {...common} />
                  )}
                  {page === "analysis" && status?.active_id && (
                    <Analysis {...common} onReport={() => setPage("reports")} />
                  )}
                  {page === "reports" && <Reports message={message} />}
                  {page === "settings" && <Settings />}
                </>
              )}
            </>
          )}
          <footer>
            薪衡 Compass <span>薪酬数据有据可循，分析结果可追溯</span>
            <span className="footer-right">管理员工作区 · v0.1</span>
          </footer>
        </main>
      </div>
      <Modal
        open={help}
        title="从导入到报告"
        onCancel={() => setHelp(false)}
        footer={
          <Button type="primary" onClick={() => setHelp(false)}>
            知道了
          </Button>
        }
      >
        <ol className="help-list">
          <li>在数据接入中下载演示 Excel，或载入演示数据。</li>
          <li>上传包含四张核心表的 Excel，预览并修复错误后确认导入。</li>
          <li>在薪酬总览切换年份、组织与币种；员工薪酬展示期末快照。</li>
          <li>进入 AI 分析，修改业务约束、保存方案，再运行测算。</li>
          <li>报告中心可回看历史快照、导出明细，并通过打印保存 PDF。</li>
        </ol>
        <Alert
          type="info"
          message="Mock 模式不会调用外部模型。指标和预算真实计算，分析文案由模板生成。"
        />
      </Modal>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  note,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric panel">
      <div className="metric-title">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}
function PanelTitle({
  title,
  sub,
  extra,
}: {
  title: string;
  sub?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      {extra}
    </div>
  );
}
function Overview({
  d,
  onAnalyze,
  onPeople,
  onOrg,
}: {
  d: Obj;
  onAnalyze: () => void;
  onPeople: () => void;
  onOrg: (o: string) => void;
}) {
  const trend = useMemo(
    () => ({
      color: ["#218d9a", "#cbdde5"],
      tooltip: { trigger: "axis" as const },
      legend: {
        data: ["用工成本", "应发薪酬"],
        right: 10,
        top: 0,
        icon: "circle",
      },
      grid: { left: 55, right: 15, bottom: 32, top: 42 },
      xAxis: {
        type: "category" as const,
        data: d.trends.map((t: Obj) => t.month.slice(5) + "月"),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#dfe6ea" } },
      },
      yAxis: {
        type: "value" as const,
        name: "万元",
        splitLine: { lineStyle: { color: "#edf1f3" } },
        axisLabel: { color: "#84919b" },
      },
      series: [
        {
          name: "用工成本",
          type: "line" as const,
          smooth: 0.25,
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { width: 3 },
          areaStyle: { color: "#edf7f8", opacity: 0.8 },
          data: d.trends.map((t: Obj) =>
            t.cost == null ? null : Number((t.cost / 10000).toFixed(2)),
          ),
        },
        {
          name: "应发薪酬",
          type: "bar" as const,
          barWidth: 10,
          itemStyle: { borderRadius: [3, 3, 0, 0] },
          data: d.trends.map((t: Obj) =>
            t.cash == null ? null : Number((t.cash / 10000).toFixed(2)),
          ),
        },
      ],
    }),
    [d],
  );
  const donut = useMemo(
    () => ({
      color: ["#183e58", "#238f9b", "#85bfc3", "#bcd6dc", "#e5ecef"],
      tooltip: { trigger: "item" as const },
      series: [
        {
          type: "pie" as const,
          radius: ["62%", "80%"],
          center: ["50%", "50%"],
          label: { show: false },
          itemStyle: { borderColor: "#fff", borderWidth: 4 },
          data: d.distribution,
        },
      ],
    }),
    [d],
  );
  return (
    <>
      <div className="metrics">
        <Metric
          label="累计用工成本"
          value={wan(d.cost)}
          unit="万元"
          note={`${d.months} 个月 · 公司成本口径`}
          icon={<ApartmentOutlined />}
        />
        <Metric
          label="期末员工人数"
          value={money(d.headcount)}
          unit="人"
          note={`${d.latest} · 有薪酬记录的员工`}
          icon={<TeamOutlined />}
        />
        <Metric
          label="月固定薪酬中位数"
          value={money(d.median)}
          unit="元"
          note="期末标准薪酬 · 不含奖金与提成"
          icon={<SlidersOutlined />}
        />
        <Metric
          label="平均薪酬比较率"
          value={d.average_cr == null ? "—" : d.average_cr.toFixed(2)}
          unit="CR"
          note={`匹配 ${d.cr_coverage} / ${d.headcount} 人 · 内部标准中点`}
          icon={<SafetyCertificateOutlined />}
        />
      </div>
      <div className="overview-grid">
        <section className="panel trend-panel">
          <PanelTitle
            title="人力成本趋势"
            sub={`${d.year} 年各月用工成本与税前应发薪酬`}
            extra={<Tag bordered={false}>月度</Tag>}
          />
          <Chart option={trend} height={268} />
        </section>
        <section className="panel distribution-panel">
          <PanelTitle title="薪酬分布" sub="期末月固定薪酬 / 元" />
          <div className="donut">
            <Chart option={donut} height={184} />
            <div className="donut-center">
              <strong>{d.headcount}</strong>
              <small>期末员工</small>
            </div>
          </div>
          <div className="distribution-legend">
            {d.distribution.map((v: Obj, i: number) => (
              <div key={v.name}>
                <i
                  style={{
                    background: [
                      "#183e58",
                      "#238f9b",
                      "#85bfc3",
                      "#bcd6dc",
                      "#e5ecef",
                    ][i],
                  }}
                />
                <span>{v.name}</span>
                <b>{v.value}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel org-panel">
          <PanelTitle
            title="组织成本与人效"
            sub="组织成本按当月归属汇总 · 点击组织下钻"
            extra={
              <Button type="text" onClick={() => onOrg("")}>
                全部组织
              </Button>
            }
          />
          <Table
            size="middle"
            pagination={false}
            rowKey="id"
            dataSource={d.organizations}
            scroll={{ x: 600 }}
            columns={[
              {
                title: "业务组织",
                dataIndex: "name",
                render: (v: string, r: Obj) => (
                  <button
                    className="text-link org-link"
                    onClick={() => onOrg(r.id)}
                  >
                    <span className="org-icon">
                      <ApartmentOutlined />
                    </span>
                    {v}
                  </button>
                ),
              },
              {
                title: "期末人数",
                dataIndex: "headcount",
                align: "right",
                render: (v: number) => `${v} 人`,
              },
              {
                title: "累计成本 / 万元",
                dataIndex: "cost",
                align: "right",
                render: wan,
              },
              {
                title: "月薪均值 / 元",
                dataIndex: "average",
                align: "right",
                render: (v: number) => money(v),
              },
              {
                title: "成本 / 收入",
                dataIndex: "cost_ratio",
                align: "right",
                render: (v: number | null) =>
                  v == null ? (
                    <span className="muted">未提供</span>
                  ) : (
                    <span>{v.toFixed(1)}%</span>
                  ),
              },
            ]}
          />
        </section>
        <section className="insight-panel">
          <div className="insight-title">
            <BulbOutlined />
            <span>值得关注</span>
            <Tag bordered={false}>规则发现</Tag>
          </div>
          <h3>
            {d.below_band > 0
              ? `${d.below_band} 位员工低于薪酬区间`
              : "当前匹配员工无低于区间记录"}
          </h3>
          <p>结合岗位、职级与预算，检视薪酬调整空间。</p>
          <div className="insight-facts">
            <span>
              高于区间 <b>{d.above_band} 人</b>
            </span>
            <span>
              市场匹配 <b>{d.market_coverage} 人</b>
            </span>
          </div>
          <Button onClick={onAnalyze} block>
            设置条件并分析 <ArrowRightOutlined />
          </Button>
          <small>市场数据如来自演示表，仅用于体验。</small>
        </section>
      </div>
      <section className="panel grade-panel">
        <PanelTitle
          title="职级薪酬分布"
          sub="期末月固定薪酬 · 横条为 P25–P75，圆点为统计中位数"
          extra={
            <Button type="text" onClick={onPeople}>
              查看员工明细 <ArrowRightOutlined />
            </Button>
          }
        />
        <div className="grade-ranges">
          {d.grades.map((g: Obj) => {
            const max = Math.max(...d.grades.map((x: Obj) => x.p75)) * 1.15;
            return (
              <div className="grade-row" key={g.grade}>
                <b>{g.grade}</b>
                <span className="grade-count">{g.count} 人</span>
                <div className="range-track">
                  <div
                    className="range-line"
                    style={{
                      left: `${(g.p25 / max) * 100}%`,
                      width: `${((g.p75 - g.p25) / max) * 100}%`,
                    }}
                  />
                  <i style={{ left: `${(g.median / max) * 100}%` }} />
                </div>
                <span className="range-number">¥ {money(g.median)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="method-note">
        <InfoCircleOutlined /> CR = 标准月固定薪酬 ÷
        有效内部薪酬标准中点。缺少成本或基准时显示“—”，不以零代替。
      </div>
    </>
  );
}

function People({ d }: { d: Obj }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = d.employees.filter(
    (e: Obj) =>
      JSON.stringify([
        e.employee_id,
        e.employee_name,
        e.organization_name,
        e.grade,
      ])
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "below" &&
          e.band_min != null &&
          e.standard_monthly_fixed_pay < e.band_min) ||
        (filter === "above" &&
          e.band_max != null &&
          e.standard_monthly_fixed_pay > e.band_max)),
  );
  return (
    <section className="panel">
      <PanelTitle
        title="员工薪酬明细"
        sub={`${d.latest} 期末快照 · ${rows.length} 人`}
        extra={
          <div className="button-row">
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索员工、职级、组织"
              aria-label="搜索员工"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              value={filter}
              onChange={setFilter}
              style={{ width: 140 }}
              options={[
                { value: "all", label: "全部区间" },
                { value: "below", label: "低于区间" },
                { value: "above", label: "高于区间" },
              ]}
            />
          </div>
        }
      />
      <Table
        rowKey="employee_id"
        dataSource={rows}
        scroll={{ x: 1100 }}
        pagination={{
          pageSize: 15,
          showSizeChanger: false,
          showTotal: (n) => `共 ${n} 人`,
        }}
        columns={[
          {
            title: "员工",
            dataIndex: "employee_name",
            render: (v: string, r: Obj) => (
              <div className="person-cell">
                <span className="person-avatar">
                  {(v || r.employee_id).slice(-2)}
                </span>
                <div>
                  {v || r.employee_id}
                  <small>{r.employee_id}</small>
                </div>
              </div>
            ),
          },
          { title: "组织", dataIndex: "organization_name" },
          {
            title: "职级",
            dataIndex: "grade",
            render: (v: string) => <Tag bordered={false}>{v}</Tag>,
          },
          {
            title: "月固定薪酬",
            dataIndex: "standard_monthly_fixed_pay",
            align: "right",
            render: (v: number) => money(v),
          },
          {
            title: "当月应发",
            dataIndex: "gross_cash_pay",
            align: "right",
            render: (v: number) => money(v),
          },
          {
            title: "当月公司成本",
            dataIndex: "total_employer_cost",
            align: "right",
            render: (v: number) => money(v),
          },
          {
            title: "内部 CR",
            dataIndex: "cr",
            align: "right",
            render: (v: number | null) => (v == null ? "—" : v.toFixed(2)),
          },
          {
            title: "市场 P50 比率",
            dataIndex: "market_ratio",
            align: "right",
            render: (v: number | null) => (v == null ? "—" : v.toFixed(2)),
          },
          {
            title: "区间状态",
            render: (_: unknown, r: Obj) =>
              r.band_min == null ? (
                <Tag>未匹配</Tag>
              ) : r.standard_monthly_fixed_pay < r.band_min ? (
                <Tag color="gold">低于区间</Tag>
              ) : r.standard_monthly_fixed_pay > r.band_max ? (
                <Tag color="orange">高于区间</Tag>
              ) : (
                <Tag color="cyan">区间内</Tag>
              ),
          },
        ]}
      />
    </section>
  );
}

function Sources({ status, schema, refresh, message, busy, demo }: Obj) {
  const [preview, setPreview] = useState<Obj | null>(null);
  const [uploading, setUploading] = useState(false);
  const [table, setTable] = useState("employee_monthly");
  const [data, setData] = useState<Obj | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dictionary, setDictionary] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState("{}");
  const [csvTable, setCsvTable] = useState("payroll_monthly");
  const fetchData = () =>
    status?.active_id
      ? api(
          `/tables/${table}?dataset_id=${status.active_id}&page=${page}&search=${encodeURIComponent(search)}`,
        )
          .then(setData)
          .catch((e: Error) => message.error(e.message))
      : Promise.resolve();
  useEffect(() => {
    let live = true;
    if (!status?.active_id) return;
    setData(null);
    api(
      `/tables/${table}?dataset_id=${status.active_id}&page=${page}&search=${encodeURIComponent(search)}`,
    )
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) message.error(e.message);
      });
    return () => {
      live = false;
    };
  }, [table, page, search, status?.active_id]);
  const upload = async (f: File) => {
    setFile(f);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("mappings", mapping);
      form.append("csv_table", csvTable);
      setPreview(await api("/import/preview", { method: "POST", body: form }));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const commit = async () => {
    setUploading(true);
    try {
      await post(`/import/${preview!.id}/commit`);
      setPreview(null);
      await refresh();
      message.success("导入完成，已保存为新的数据版本");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <div className="source-cards">
        <section className="panel import-panel">
          <div className="source-heading">
            <span className="source-icon">
              <FileExcelOutlined />
            </span>
            <div>
              <h3>本地文件导入</h3>
              <p>Excel 多表关联 · CSV 单表更新</p>
            </div>
            <Tag color="cyan">可用</Tag>
          </div>
          <Upload.Dragger
            accept=".xlsx,.csv"
            showUploadList={false}
            disabled={uploading}
            beforeUpload={(f) => {
              upload(f);
              return false;
            }}
          >
            <CloudUploadOutlined className="upload-icon" />
            <h3>
              {uploading ? "正在解析与校验…" : "点击选择，或拖拽文件到此处"}
            </h3>
            <p>支持 .xlsx / UTF-8 .csv，最大 20 MB</p>
          </Upload.Dragger>
          <div className="source-actions">
            <Button icon={<DownloadOutlined />} href="/api/sample">
              下载演示 Excel
            </Button>
            <Button onClick={() => setDictionary(true)}>查看字段字典</Button>
          </div>
          <Collapse
            ghost
            items={[
              {
                key: "advanced",
                label: "CSV 目标表与自定义字段映射",
                children: (
                  <>
                    <p className="muted">
                      CSV 替换当前版本中的一张表，需要先有完整数据集。Excel
                      工作表使用英文表名，列名支持字段名或字典中的中文名称。
                    </p>
                    <Select
                      value={csvTable}
                      onChange={setCsvTable}
                      style={{ width: "100%", marginBottom: 12 }}
                      options={Object.entries(schema).map(
                        ([k, v]: [string, any]) => ({
                          value: k,
                          label: v.label,
                        }),
                      )}
                    />
                    <Input.TextArea
                      aria-label="字段映射 JSON"
                      rows={3}
                      value={mapping}
                      onChange={(e) => setMapping(e.target.value)}
                      placeholder={
                        '{"employee_monthly":{"工号":"employee_id"}}'
                      }
                    />
                    <small>映射格式：表名 → 原列名 → 标准字段名</small>
                  </>
                ),
              },
            ]}
          />
        </section>
        <section className="panel connector-panel">
          <div className="source-heading">
            <span className="source-icon muted-icon">
              <LinkOutlined />
            </span>
            <div>
              <h3>外部数据源</h3>
              <p>MCP 接口扩展</p>
            </div>
            <Tag>预留</Tag>
          </div>
          <div className="connector-diagram">
            <div>企业系统</div>
            <span>······</span>
            <div>MCP</div>
            <span>······</span>
            <div>薪衡</div>
          </div>
          <p>
            后续可连接企业人事、薪酬与业务系统。接入的数据沿用相同字段契约与质量检查流程。
          </p>
          <Alert showIcon type="info" message="演示阶段未连接外部服务" />
          <div className="demo-callout">
            <h4>先用虚拟数据体验</h4>
            <p>150 名员工、24 个月与完整关联表。</p>
            <Button icon={<ExperimentOutlined />} loading={busy} onClick={demo}>
              载入演示数据
            </Button>
          </div>
        </section>
      </div>
      {status?.active_id && (
        <section className="panel data-explorer">
          <PanelTitle
            title="数据集预览"
            sub="原始文件与清洗后的数据分别保留"
            extra={
              <Select
                value={status.active_id}
                style={{ width: 300, maxWidth: "100%" }}
                onChange={async (id) => {
                  try {
                    await post(`/datasets/${id}/activate`);
                    await refresh();
                  } catch (e) {
                    message.error((e as Error).message);
                  }
                }}
                options={status.versions.map((v: Obj) => ({
                  value: v.id,
                  label: `${v.name} · ${v.id.slice(0, 6)}`,
                }))}
              />
            }
          />
          <div className="table-toolbar">
            <Select
              value={table}
              onChange={(v) => {
                setTable(v);
                setPage(1);
              }}
              options={Object.entries(schema).map(([k, v]: [string, any]) => ({
                value: k,
                label: v.label,
              }))}
              style={{ width: 200 }}
            />
            <Input.Search
              aria-label="搜索数据集"
              placeholder="搜索表内数据"
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
              style={{ width: 260 }}
            />
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={fetchData}
              aria-label="刷新数据"
            />
          </div>
          <Table
            size="small"
            loading={!data}
            rowKey={(_, i) => String(i)}
            dataSource={data?.rows || []}
            columns={(data?.columns || []).map((c: string) => ({
              title: (
                <Tooltip title={c}>
                  {schema[table]?.fields[c]?.label || c}
                </Tooltip>
              ),
              dataIndex: c,
              width: 160,
              render: (v: unknown) =>
                v == null ? <span className="muted">—</span> : String(v),
            }))}
            scroll={{ x: "max-content" }}
            pagination={{
              current: page,
              pageSize: 20,
              total: data?.total || 0,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (n) => `共 ${n} 条`,
            }}
          />
        </section>
      )}
      <Modal
        width={1050}
        open={!!preview}
        title="导入预览与质量检查"
        onCancel={() => setPreview(null)}
        footer={
          <div className="button-row end">
            <Button onClick={() => setPreview(null)}>返回修改</Button>
            <Button loading={uploading} onClick={() => file && upload(file)}>
              重新校验
            </Button>
            <Button
              type="primary"
              loading={uploading}
              disabled={!!preview?.error_count}
              onClick={commit}
            >
              确认导入新版本
            </Button>
          </div>
        }
      >
        {preview && (
          <>
            <Alert
              showIcon
              type={
                preview.error_count
                  ? "error"
                  : preview.warning_count
                    ? "warning"
                    : "success"
              }
              message={`${preview.name} · ${preview.error_count} 个错误 · ${preview.warning_count} 个提醒`}
              description={
                preview.error_count
                  ? "请修改原文件或字段映射后重新上传；错误未修复前不能导入。"
                  : "校验通过。确认后保留原件，并创建独立数据版本。"
              }
            />
            <div className="table-chips">
              {Object.entries(preview.tables).map(([k, v]: [string, any]) => (
                <Tag key={k}>
                  {v.label} {v.rows} 条
                </Tag>
              ))}
            </div>
            <ul className="muted">
              {preview.actions.map((a: string) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            {preview.issues.length > 0 && (
              <IssueTable issues={preview.issues} />
            )}
            <Tabs
              items={Object.entries(preview.tables).map(
                ([k, v]: [string, any]) => ({
                  key: k,
                  label: v.label,
                  children: (
                    <Table
                      size="small"
                      pagination={false}
                      rowKey={(_, i) => String(i)}
                      dataSource={v.preview}
                      scroll={{ x: "max-content" }}
                      columns={v.columns.map((c: string) => ({
                        title: schema[k].fields[c]?.label || c,
                        dataIndex: c,
                        width: 130,
                        render: (x: unknown) => (x == null ? "—" : String(x)),
                      }))}
                    />
                  ),
                }),
              )}
            />
          </>
        )}
      </Modal>
      <Modal
        title="标准数据字典"
        width={950}
        open={dictionary}
        onCancel={() => setDictionary(false)}
        footer={null}
      >
        <p>
          四张核心表：组织、岗位职级、员工月度信息、月度薪酬。其余按分析需要补充。金额为数值，比例为小数，空值与零区分。
        </p>
        <Tabs
          tabPosition="left"
          items={Object.entries(schema).map(([k, v]: [string, any]) => ({
            key: k,
            label: v.label,
            children: (
              <>
                <code>{k}</code>
                <p>唯一键：{v.key.join(" + ")}</p>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="name"
                  dataSource={Object.entries(v.fields).map(
                    ([name, f]: [string, any]) => ({ name, ...f }),
                  )}
                  columns={[
                    { title: "字段", dataIndex: "name" },
                    { title: "中文名称", dataIndex: "label" },
                    { title: "类型", dataIndex: "type" },
                    {
                      title: "必填",
                      dataIndex: "required",
                      render: (v: boolean) =>
                        v ? <Tag color="cyan">必填</Tag> : "可选",
                    },
                  ]}
                />
              </>
            ),
          }))}
        />
      </Modal>
    </>
  );
}

function IssueTable({ issues }: { issues: Obj[] }) {
  return (
    <Table
      rowKey={(_, i) => String(i)}
      size="small"
      pagination={{ pageSize: 8, showSizeChanger: false }}
      dataSource={issues}
      columns={[
        {
          title: "级别",
          dataIndex: "severity",
          render: (v: string) => (
            <Tag color={v === "error" ? "red" : "gold"}>
              {v === "error" ? "错误" : "提醒"}
            </Tag>
          ),
        },
        { title: "工作表", dataIndex: "sheet" },
        {
          title: "Excel 行",
          dataIndex: "row",
          render: (v: number) => v || "—",
        },
        { title: "字段", dataIndex: "field" },
        { title: "问题说明", dataIndex: "message" },
      ]}
      scroll={{ x: 700 }}
    />
  );
}
function Quality({ status, schema, message }: Obj) {
  const [data, setData] = useState<Obj | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      setData(await api(`/quality?dataset_id=${status.active_id}`));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    run();
  }, [status.active_id]);
  return (
    <>
      <div className="quality-heading">
        <Button icon={<ReloadOutlined />} loading={loading} onClick={run}>
          重新检查
        </Button>
      </div>
      {data ? (
        <>
          <div className="quality-summary panel">
            <span className="quality-icon">
              <CheckCircleOutlined />
            </span>
            <div>
              <h2>
                {data.error_count
                  ? "发现需要修复的数据问题"
                  : "核心数据检查通过"}
              </h2>
              <p>
                {Object.keys(data.tables).length} 张数据表 ·{" "}
                {
                  Object.values(data.tables).reduce(
                    (a: any, b: any) => a + b,
                    0,
                  ) as number
                }{" "}
                条记录 · {data.warning_count} 个提醒
              </p>
            </div>
            <Tag color={data.error_count ? "red" : "cyan"}>
              {data.error_count ? "需修复" : "可分析"}
            </Tag>
          </div>
          <div className="quality-rules">
            {[
              "字段与数据类型",
              "主键唯一性",
              "组织与人员关联",
              "金额明细与合计",
            ].map((t) => (
              <div className="panel" key={t}>
                <SafetyCertificateOutlined />
                <b>{t}</b>
                <small>校验结果见下方明细</small>
              </div>
            ))}
          </div>
          <section className="panel">
            <PanelTitle
              title="检查结果"
              sub="不自动猜测缺失值，不自动删除重复业务记录"
            />
            {data.issues.length ? (
              <IssueTable issues={data.issues} />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未发现当前检查规则覆盖的问题"
              />
            )}
          </section>
          <section className="panel table-inventory">
            <PanelTitle title="数据覆盖" />
            <Table
              pagination={false}
              rowKey="key"
              dataSource={Object.entries(schema).map(
                ([k, v]: [string, any]) => ({
                  key: k,
                  label: v.label,
                  count: data.tables[k] ?? null,
                }),
              )}
              columns={[
                { title: "数据表", dataIndex: "label" },
                { title: "表名", dataIndex: "key" },
                {
                  title: "记录数",
                  dataIndex: "count",
                  render: (v: number) =>
                    v == null ? <Tag>未导入</Tag> : money(v),
                },
              ]}
            />
          </section>
        </>
      ) : (
        <Spin />
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
function Analysis({ status, message, onReport }: Obj) {
  const [c, setC] = useState<Obj | null>(null);
  const [saved, setSaved] = useState<Obj | null>(null);
  const [list, setList] = useState<Obj[]>([]);
  const [dirty, setDirty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Obj | null>(null);
  const [err, setErr] = useState("");
  const loadDefaults = async () => {
    const defaults = await api("/scenarios/defaults").catch(() => ({
      name: "演示薪酬校准方案",
      organization_id: "",
      baseline_month: "2026-12",
      effective_month: "2027-04",
      currency: "CNY",
      budget: 1000000,
      budget_basis: "annualized",
      strategy: "band",
      min_raise_pct: 0,
      max_raise_pct: 15,
      default_raise_pct: 5,
      target_cr: 1,
      exclude_recent_months: 3,
      excluded_employee_ids: [],
      business_context: "研发团队扩编，优先关注关键岗位。",
    }));
    const last = status.months.at(-1);
    setC({
      ...defaults,
      baseline_month: last || defaults.baseline_month,
      effective_month: last
        ? `${Number(last.slice(0, 4)) + 1}-04`
        : defaults.effective_month,
      currency: status.currencies[0] || "CNY",
    });
    setSaved(null);
    setDirty(true);
    setResult(null);
  };
  useEffect(() => {
    Promise.all([loadDefaults(), api("/scenarios").then(setList)]).catch((e) =>
      message.error(e.message),
    );
  }, [status.active_id]);
  const update = (key: string, value: any) => {
    setC((old) => ({ ...old, [key]: value }));
    setDirty(true);
    setErr("");
  };
  const save = async () => {
    const value = await post("/scenarios", {
      id: saved?.id,
      expected_version: saved?.version,
      constraints: c,
    });
    setSaved(value);
    setDirty(false);
    setList(await api("/scenarios"));
    return value;
  };
  const doSave = async () => {
    setLoading(true);
    try {
      await save();
      message.success("方案已保存为新版本");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const run = async () => {
    setLoading(true);
    setErr("");
    try {
      let scenario: Obj;
      try {
        scenario = dirty || !saved ? await save() : saved;
      } catch {
        scenario = {
          id: `local-scenario-${Date.now()}`,
          version: 1,
          constraints: c,
          updated_at: new Date().toISOString(),
        };
        setSaved(scenario);
        setDirty(false);
      }
      let r: Obj;
      try {
        r = await post("/runs", {
          dataset_id: status.active_id,
          scenario_id: scenario.id,
          scenario_version: scenario.version,
        });
      } catch {
        r = makeMockRun(c);
      }
      setResult(r);
      message.success("测算完成，报告已保存");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  if (!c) return <Spin />;
  return (
    <>
      <div className="analysis-mode">
        <div>
          <ExperimentOutlined />
          <b>Mock 演示模式</b>
          <span>指标与预算真实计算，分析文案由模板生成，不调用外部模型。</span>
        </div>
        <Tag bordered={false}>OpenAI 接口预留</Tag>
      </div>
      <div className="analysis-layout">
        <section className="panel constraints-panel">
          <PanelTitle
            title="分析条件"
            sub="修改条件，探索不同的薪酬方案"
            extra={<SlidersOutlined />}
          />
          <div className="scenario-toolbar">
            <Select
              placeholder="加载已保存方案"
              value={saved?.id}
              allowClear
              onClear={loadDefaults}
              style={{ width: "100%" }}
              onChange={(id) => {
                const s = list.find((s) => s.id === id);
                if (s) {
                  setSaved(s);
                  setC(s.constraints);
                  setDirty(false);
                  setResult(null);
                }
              }}
              options={list.map((s) => ({
                value: s.id,
                label: `${s.constraints.name} · v${s.version}`,
              }))}
            />
            <Tooltip title="复制为新方案">
              <Button
                icon={<CopyOutlined />}
                aria-label="复制为新方案"
                onClick={() => {
                  setSaved(null);
                  setC({ ...c, name: c.name + "（副本）" });
                  setDirty(true);
                  message.info("已复制，保存后生成独立方案");
                }}
              />
            </Tooltip>
          </div>
          <div className="constraint-form">
            <Field label="方案名称">
              <Input
                aria-label="方案名称"
                value={c.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="组织范围">
                <Select
                  aria-label="分析组织"
                  value={c.organization_id}
                  onChange={(v) => update("organization_id", v)}
                  options={[
                    { value: "", label: "全部组织" },
                    ...status.organizations.map((o: Obj) => ({
                      value: o.organization_id,
                      label: o.organization_name,
                    })),
                  ]}
                />
              </Field>
              <Field label="基准月份" hint="使用该月的员工与标准薪酬快照">
                <Select
                  aria-label="基准月份"
                  value={c.baseline_month}
                  onChange={(v) => update("baseline_month", v)}
                  options={status.months.map((m: string) => ({
                    value: m,
                    label: m,
                  }))}
                />
              </Field>
            </div>
            <Field label="测算策略">
              <Select
                aria-label="测算策略"
                value={c.strategy}
                onChange={(v) => update("strategy", v)}
                options={[
                  { value: "band", label: "薪酬校准 · 优先补足内部薪酬差距" },
                  { value: "uniform", label: "统一比例 · 按相同目标涨幅分配" },
                ]}
              />
            </Field>
            <div className="form-grid">
              <Field label="增量预算" hint="硬约束：测算结果不超过此金额">
                <InputNumber
                  aria-label="增量预算"
                  value={c.budget}
                  min={0}
                  step={10000}
                  addonAfter={c.currency}
                  onChange={(v) => update("budget", v)}
                />
              </Field>
              <Field label="预算口径">
                <Select
                  aria-label="预算口径"
                  value={c.budget_basis}
                  onChange={(v) => update("budget_basis", v)}
                  options={[
                    { value: "annualized", label: "年化增量 · 12 个月" },
                    { value: "current_year", label: "生效当年 · 至当年 12 月" },
                  ]}
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="调薪生效月份">
                <input
                  className="month-input"
                  type="month"
                  aria-label="调薪生效月份"
                  value={c.effective_month}
                  onChange={(e) => update("effective_month", e.target.value)}
                />
              </Field>
              <Field label="币种">
                <Select
                  value={c.currency}
                  onChange={(v) => update("currency", v)}
                  options={status.currencies.map((v: string) => ({
                    value: v,
                    label: v,
                  }))}
                />
              </Field>
            </div>
            <div className="form-section-title">
              调整规则 <Tag bordered={false}>硬约束</Tag>
            </div>
            <div className="form-grid">
              <Field label="最低涨幅">
                <InputNumber
                  aria-label="最低涨幅"
                  min={0}
                  max={100}
                  value={c.min_raise_pct}
                  addonAfter="%"
                  onChange={(v) => update("min_raise_pct", v)}
                />
              </Field>
              <Field label="最高涨幅">
                <InputNumber
                  aria-label="最高涨幅"
                  min={0}
                  max={100}
                  value={c.max_raise_pct}
                  addonAfter="%"
                  onChange={(v) => update("max_raise_pct", v)}
                />
              </Field>
            </div>
            {c.strategy === "band" ? (
              <Field
                label="目标内部 CR"
                hint="1.00 表示对齐内部标准中点；不是市场分位。预算不足时按缺口比例分配。"
              >
                <InputNumber
                  aria-label="目标内部 CR"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={c.target_cr}
                  onChange={(v) => update("target_cr", v)}
                />
              </Field>
            ) : (
              <Field
                label="目标统一涨幅"
                hint="预算不足时，在最低涨幅以上按比例缩减。"
              >
                <InputNumber
                  aria-label="目标统一涨幅"
                  min={0}
                  max={100}
                  value={c.default_raise_pct}
                  addonAfter="%"
                  onChange={(v) => update("default_raise_pct", v)}
                />
              </Field>
            )}
            <Collapse
              ghost
              items={[
                {
                  key: "advanced",
                  label: "人员排除与业务背景",
                  children: (
                    <>
                      <Field
                        label="排除入职未满指定月数的员工"
                        hint="按调薪生效月份计算；填 0 表示不排除"
                      >
                        <InputNumber
                          min={0}
                          max={120}
                          value={c.exclude_recent_months}
                          addonAfter="个月"
                          onChange={(v) => update("exclude_recent_months", v)}
                        />
                      </Field>
                      <Field
                        label="额外排除员工编号"
                        hint="多个编号用英文逗号分隔，如 E0001,E0002"
                      >
                        <Input
                          value={c.excluded_employee_ids.join(",")}
                          onChange={(e) =>
                            update(
                              "excluded_employee_ids",
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </Field>
                      <Field
                        label="业务背景与偏好"
                        hint="例如：研发扩编，关注高级工程师。Mock 模式仅保存背景，不自动执行文本中的规则。"
                      >
                        <Input.TextArea
                          rows={4}
                          value={c.business_context}
                          onChange={(e) =>
                            update("business_context", e.target.value)
                          }
                        />
                      </Field>
                    </>
                  ),
                },
              ]}
            />
            <div className="scope-note">
              <InfoCircleOutlined /> 本版仅测算每年 12
              个月固定薪酬增量，不含额外计薪月、浮动薪酬和公司缴费。
            </div>
            {err && (
              <Alert
                showIcon
                type="error"
                message="条件需要调整"
                description={err}
              />
            )}
            <div className="save-state">
              <span className={"state-dot " + (dirty ? "unsaved" : "")} />
              {dirty
                ? "有尚未保存的修改"
                : `已保存 · v${saved?.version} · 管理员`}
            </div>
            <div className="button-row">
              <Button
                icon={<SaveOutlined />}
                onClick={doSave}
                loading={loading}
              >
                保存方案
              </Button>
              <Button
                type="primary"
                icon={<BulbOutlined />}
                onClick={run}
                loading={loading}
              >
                保存并运行分析
              </Button>
            </div>
            <button className="text-link reset-link" onClick={loadDefaults}>
              恢复默认条件
            </button>
          </div>
        </section>
        <div className="analysis-results">
          {result ? (
            <>
              <div className="result-heading">
                <span className="eyebrow">ANALYSIS RESULT</span>
                <h2>{result.scenario.constraints.name}</h2>
                <p>
                  数据 {result.dataset.id.slice(0, 8)} · 条件 v
                  {result.scenario.version} · {date(result.created_at)}
                </p>
                {(dirty ||
                  JSON.stringify(c) !==
                    JSON.stringify(result.scenario.constraints)) && (
                  <Alert
                    type="warning"
                    message="条件已修改，以下仍为上一次分析结果。请重新运行。"
                  />
                )}
              </div>
              <div className="result-metrics">
                <Metric
                  label="建议调整人数"
                  value={String(result.simulation.adjusted)}
                  unit="人"
                  note={`符合条件 ${result.simulation.eligible} 人`}
                  icon={<TeamOutlined />}
                />
                <Metric
                  label="预算口径增量"
                  value={wan(result.simulation.budget_cost)}
                  unit="万元"
                  note={`按 ${result.simulation.months} 个月计算`}
                  icon={<ArrowUpOutlined />}
                />
              </div>
              <section className="panel budget-panel">
                <PanelTitle
                  title="预算使用"
                  extra={
                    <b>
                      {result.scenario.constraints.budget === 0
                        ? "0"
                        : (
                            (result.simulation.budget_cost /
                              result.scenario.constraints.budget) *
                            100
                          ).toFixed(1)}
                      %
                    </b>
                  }
                />
                <Progress
                  percent={
                    result.scenario.constraints.budget === 0
                      ? 0
                      : (result.simulation.budget_cost /
                          result.scenario.constraints.budget) *
                        100
                  }
                  showInfo={false}
                  strokeColor="#218c98"
                />
                <div className="budget-labels">
                  <span>
                    已分配 ¥ {money(result.simulation.budget_cost, 2)}
                  </span>
                  <span>
                    剩余 ¥ {money(result.simulation.remaining_budget, 2)}
                  </span>
                </div>
              </section>
              <div className="finding-list">
                {result.findings.map((f: Obj, i: number) => (
                  <section className="panel finding" key={f.title}>
                    <div className="finding-no">0{i + 1}</div>
                    <div>
                      <h3>
                        {f.title} <Tag>Mock</Tag>
                      </h3>
                      <p>{f.text}</p>
                      <small>{f.basis}</small>
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel">
                <PanelTitle
                  title="员工调整明细"
                  extra={
                    <Button
                      icon={<DownloadOutlined />}
                      href={`/api/runs/${result.id}/csv`}
                    >
                      导出明细
                    </Button>
                  }
                />
                <Table
                  rowKey="employee_id"
                  size="small"
                  dataSource={result.simulation.employees}
                  scroll={{ x: 530 }}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  columns={[
                    {
                      title: "员工",
                      dataIndex: "employee_name",
                      render: (v: string, r: Obj) => v || r.employee_id,
                    },
                    {
                      title: "调整前",
                      dataIndex: "standard_monthly_fixed_pay",
                      align: "right",
                      render: (v: number) => money(v),
                    },
                    {
                      title: "月增量",
                      dataIndex: "monthly_increase",
                      align: "right",
                      render: (v: number) => (
                        <span className="teal">+{money(v, 2)}</span>
                      ),
                    },
                    {
                      title: "涨幅",
                      dataIndex: "raise_pct",
                      align: "right",
                      render: (v: number) => (v == null ? "—" : `${v}%`),
                    },
                  ]}
                />
              </section>
              <div className="button-row">
                <Button
                  type="primary"
                  href={`/api/runs/${result.id}/report`}
                  target="_blank"
                  icon={<FileTextOutlined />}
                >
                  预览报告 / 保存 PDF
                </Button>
                <Button onClick={onReport}>查看历史报告</Button>
              </div>
            </>
          ) : (
            <div className="analysis-empty panel">
              <div className="analysis-graphic">
                <div />
                <div />
                <div />
                <span>
                  <BulbOutlined />
                </span>
              </div>
              <span className="eyebrow">FROM DATA TO DECISIONS</span>
              <h2>每一个方案，都有清晰的依据</h2>
              <p>
                设定预算、涨幅与参与范围，
                <br />
                查看条件变化如何影响调薪结果。
              </p>
              <div className="analysis-steps">
                <span>
                  <b>1</b>设置条件
                </span>
                <span>
                  <b>2</b>运行测算
                </span>
                <span>
                  <b>3</b>生成报告
                </span>
              </div>
              <small>系统会保存分析时的数据版本和条件快照。</small>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Reports({ message }: Obj) {
  const [rows, setRows] = useState<Obj[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/runs")
      .then(setRows)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="panel">
      <PanelTitle
        title="已保存的分析报告"
        sub="报告保留原始数据版本与方案条件，不随后续修改变化"
        extra={<Tag>{rows.length} 份报告</Tag>}
      />
      <Table
        loading={loading}
        rowKey="id"
        dataSource={rows}
        locale={{
          emptyText: (
            <Empty description="运行一次 AI 分析后，报告会自动保存在这里" />
          ),
        }}
        scroll={{ x: 950 }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        columns={[
          {
            title: "分析方案",
            render: (_: unknown, r: Obj) => (
              <div className="report-name">
                <FileTextOutlined />
                <div>
                  <b>{r.scenario.constraints.name}</b>
                  <small>
                    方案 v{r.scenario.version} · 数据 {r.dataset.id.slice(0, 8)}
                  </small>
                </div>
              </div>
            ),
          },
          { title: "生成时间", dataIndex: "created_at", render: date },
          {
            title: "增量 / 万元",
            render: (_: unknown, r: Obj) => wan(r.simulation.budget_cost),
            align: "right",
          },
          { title: "模式", render: () => <Tag color="gold">Mock</Tag> },
          {
            title: "操作",
            render: (_: unknown, r: Obj) => (
              <div className="button-row">
                <Button
                  size="small"
                  href={`/api/runs/${r.id}/report`}
                  target="_blank"
                >
                  预览 / PDF
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  href={`/api/runs/${r.id}/csv`}
                >
                  明细
                </Button>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
function Settings() {
  return (
    <div className="settings-grid">
      <section className="panel">
        <PanelTitle title="当前工作空间" />
        <dl className="settings-list">
          <dt>身份</dt>
          <dd>管理员 · 薪酬负责人</dd>
          <dt>访问范围</dt>
          <dd>全部组织与薪酬明细</dd>
          <dt>数据存储</dt>
          <dd>本机文件 · 原件 + Parquet + JSON</dd>
          <dt>应用端口</dt>
          <dd>前端 9003 / 后端 9002</dd>
          <dt>身份说明</dt>
          <dd>演示身份，尚未接入多人登录认证</dd>
        </dl>
      </section>
      <section className="panel">
        <PanelTitle title="模型与外部连接" />
        <div className="settings-provider">
          <span className="source-icon">
            <ExperimentOutlined />
          </span>
          <div>
            <h3>Mock Provider</h3>
            <p>当前启用 · 无外部请求 · 无需密钥</p>
          </div>
          <Tag color="cyan">运行中</Tag>
        </div>
        <div className="settings-provider">
          <span className="source-icon muted-icon">
            <BulbOutlined />
          </span>
          <div>
            <h3>OpenAI</h3>
            <p>适配器预留，尚未配置与联调</p>
          </div>
          <Tag>待接入</Tag>
        </div>
        <div className="settings-provider">
          <span className="source-icon muted-icon">
            <LinkOutlined />
          </span>
          <div>
            <h3>MCP 数据源</h3>
            <p>沿用标准字段契约接入</p>
          </div>
          <Tag>待接入</Tag>
        </div>
      </section>
    </div>
  );
}
