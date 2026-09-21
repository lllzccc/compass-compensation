"""Provider contracts keep demo operation independent of credentials and model SDKs."""
from typing import Protocol

class AnalysisProvider(Protocol):
    def analyze(self, evidence: dict, constraints: dict, simulation: dict) -> list[dict]: ...

class MockProvider:
    def analyze(self, evidence, constraints, simulation):
        return [
            {'title':'薪酬区间检查','text':f'基准年度期末有 {evidence["below_band"]} 人低于内部薪酬区间、{evidence["above_band"]} 人高于区间。先核对岗位、职级和适用薪酬标准，再决定是否调整。','basis':f'有效 CR 匹配 {evidence["cr_coverage"]} / {evidence["headcount"]} 人；来源：员工月度信息、岗位职级。'},
            {'title':'预算与调整空间','text':f'当前规则为 {simulation["adjusted"]} 人分配调整，所选预算口径新增固定薪酬 {simulation["budget_cost"]:,.2f} 元，剩余 {simulation["remaining_budget"]:,.2f} 元。','basis':f'按 {simulation["months"]} 个月计算；金额来自确定性测算，未由模型推算。'},
            {'title':'实施前建议','text':'核对关键岗位与绩效背景，检查个别员工的调整原因。将公司缴费、额外计薪月和浮动薪酬联动补入完整预算后再形成正式方案。','basis':'Mock 模板建议；自由文本业务背景仅留存展示，未参与自动计算。'},
        ]

class OpenAIProvider:
    """Reserved adapter. No key is read and no network request is made in demo mode."""
    def analyze(self, evidence, constraints, simulation):
        raise NotImplementedError('当前版本为 Mock 演示；OpenAI 接口待配置和联调')

class DataConnector(Protocol):
    def fetch_tables(self) -> dict: ...

class MCPConnector:
    def fetch_tables(self):
        raise NotImplementedError('MCP 数据源接口已预留，尚未连接外部服务')
