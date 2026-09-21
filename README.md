# 薪衡 Compass

面向薪酬负责人的本地薪酬分析演示平台。React + TypeScript + Vite / Ant Design / ECharts，Python + FastAPI + Pandas。默认管理员身份，Mock 模式不读取密钥、不调用任何模型服务。

## 启动

要求 Node.js 22+、Python 3.11+。

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
npm install --cache .npm-cache
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

前端：<http://127.0.0.1:9003/>。后端及接口文档：<http://127.0.0.1:9002/docs>。9001 已被其他程序占用，因此采用 9003 / 9002。服务只监听本机回环地址。

也可以在两个终端分别运行：

```powershell
.venv/Scripts/python -m uvicorn backend.main:app --host 127.0.0.1 --port 9002
```

```powershell
npm run dev
```

`npm run build` 构建后，重新启动后端即可通过 9002 同时提供前端与 API，无须运行 Vite。

## 已实现

- Excel 多表导入、中文字段名识别、自定义字段映射、CSV 替换单表。
- 预览、质量校验、阻断错误导入、确认后创建新版本，保留原件。
- 按年度、组织、币种分析成本、薪酬分布、内部 CR、市场 P50 比率。
- 员工薪酬检索、区间筛选、10 张表数据预览、完整字段字典。
- 可编辑分析条件、方案复制、版本保存、乐观锁防止覆盖修改。
- 按薪酬缺口或统一涨幅测算，执行预算、涨幅、人员排除约束。
- Mock 模板分析、分析快照、历史报告、CSV 明细导出、HTML 报告打印为 PDF。
- OpenAI 分析提供器、MCP 数据源协议预留；尚未实现真实连接。

## 演示数据与导入契约

`outputs/demo/compass-demo.xlsx`：24 个月、150 个员工编号（期末 145 人），3 个业务中心、10 张业务表及字段说明。全部数据包括市场基准均为虚构。Excel 可直接从数据接入页下载和重新导入，也可以点击“载入演示数据”。

工作表名必须使用 `backend/schema.py` 中的英文表名。列名支持标准英文名或字典中的中文名。第一行是字段名。完整 Excel 必须包含 `organizations`、`job_grades`、`employee_monthly`、`payroll_monthly` 四张核心表。CSV 为 UTF-8 编码，在已有数据集上替换所选表，其余表继承上一个版本。

金额为数值、比例为小数、月为 `YYYY-MM`、日期为 `YYYY-MM-DD`。空值不会被自动填成零；不自动删除重复主键记录。数字格式带货币符号等无法可靠识别时报告错误。Excel 公式需要已有计算缓存，导入器不会运行 Excel 宏或公式引擎。

## 数据保存与 JSON

```text
data/
  active.json                    当前数据版本
  datasets/<id>/
    original.xlsx 或 original.csv 原始上传文件
    <table>.parquet               标准化数据明细
    meta.json / quality.json      版本与导入校验记录
  imports/<id>/                  导入预览及暂存 JSON
  scenarios/<id>/v<version>.json  不可变的条件版本
  runs/<id>.json                 数据版本、条件、测算与报告快照
```

浏览器与 API 通过 JSON 通信；分析条件与报告使用 JSON 保存。大量数值明细使用 Parquet 保留类型，避免反复解析和字段名膨胀。没有独立数据库服务。可用 `COMPASS_DATA_DIR` 覆盖存储目录。

## 指标与测算边界

- 累计金额只汇总所选年度实际提供的月份；员工人数、固定薪酬分布采用所选范围的最新薪酬月份快照，不是整年人数相加。
- 历史薪酬按员工当月组织归属连接，内部 CR 仅匹配同岗位、职级、地区、币种、有效期的月固定薪酬标准。市场比较仅使用基准月之前、同地区同口径的基准；多个匹配优先最新来源日期。
- 缺少公司成本合计或完整覆盖时显示未提供，不把缺失成本当成零。收入只使用同期间、同币种、`metric_code=revenue`、`aggregation_method=sum` 的组织数据；收入不得含与其他组织重复的汇总记录。
- 调薪测算目前只包含每年 12 个月固定薪酬增量，不含额外计薪月、公司社保公积金、浮动奖金联动和未来编制变化。生效当年口径包含生效月。
- 调整金额精确到分。最低涨幅超出预算时阻断；可行时在上下限之间按目标缺口比例分配。预算为上限，不保证全部花完。
- 业务背景文字只保存，不由 Mock 模型自动解释执行。绩效、提成、调薪历史和编制预算目前可导入与预览；复杂绩效规则、阶梯提成、下一年度完整成本预测尚未做成专门分析模块。
- 组织表目前按稳定组织编号唯一，名称保留于整个数据版本；同一数据集不支持同编号多段组织名称历史。员工月度表保留转岗归属。
- 默认管理员是演示身份，不是认证系统；当前设计面向单机使用。

## 验证

```powershell
npm run build
.venv/Scripts/python -m unittest discover -s tests -v
```

测试覆盖导入回读、数据合计、历史组织归属、缺失值、重复键、关联错误、预算上下限、零预算、当年口径、方案版本和历史结果不变。

演示 Excel 的 JSON 源数据可用 `.venv/Scripts/python -m backend.demo` 再生。Excel 作者脚本使用 Codex 提供的 `@oai/artifact-tool`；已交付的 Excel 不依赖该工具即可使用。
