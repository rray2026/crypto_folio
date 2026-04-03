# 组件架构设计

## 1. 目录结构

```
src/components/
├── funds/          # 基金相关表单和卡片
├── layout/         # 应用骨架（导航、头部）
├── positions/      # 持仓相关表单
├── shared/         # 跨页面复用的展示组件
├── transactions/   # 交易相关表单和导入流程
└── ui/             # Shadcn/UI 基础组件库（不手动编辑）
```

---

## 2. Shadcn/UI 基础组件（`src/components/ui/`）

这些组件来自 [Shadcn/UI](https://ui.shadcn.com/)，基于 Radix UI 原语 + Tailwind CSS 样式。

**规则：不要手动修改 `src/components/ui/` 中的任何文件。**

添加新 Shadcn 组件：
```bash
npx shadcn@latest add <component-name>
```

**当前已安装的 Shadcn 组件（部分）：**

| 组件 | 用途 |
|------|------|
| `Button` | 按钮，支持 variant（default/outline/ghost/destructive） |
| `Input` | 文本输入框 |
| `Label` | 表单标签 |
| `Dialog` | 模态弹窗（含 Trigger/Content/Header/Footer） |
| `Select` | 下拉选择框 |
| `Tabs` | 标签页 |
| `Card` | 卡片容器（含 Header/Content/Footer） |
| `Badge` | 状态标签（绿色/红色/灰色） |
| `Checkbox` | 复选框 |
| `Popover` | 浮层（用于日期选择器等） |
| `Calendar` | 日历组件 |
| `Command` | 命令面板（搜索 + 列表） |
| `DateTimePicker` | 日期时间选择器（自定义，基于 Calendar + Popover） |
| `PullToRefresh` | 下拉刷新（移动端手势） |

---

## 3. 布局组件（`src/components/layout/`）

详见 [06-routing-and-pages.md](./06-routing-and-pages.md) 的布局架构章节。

| 组件 | 职责 |
|------|------|
| `AppLayout` | 顶级容器，组合 Sidebar/MobileHeader/MobileNav/Outlet |
| `Sidebar` | 桌面端左侧导航栏（宽度固定，深色背景） |
| `MobileHeader` | 移动端顶部动态标题栏 |
| `MobileNav` | 移动端底部 Tab 导航栏 |

---

## 4. 共享展示组件（`src/components/shared/`）

### 4.1 PositionCard

在持仓列表页（`/positions`）中展示单个持仓的摘要信息。

```tsx
interface PositionCardProps {
  position: Position;
  metrics: PositionMetrics;
  onClick?: () => void;
}
```

**展示内容：**
- 标的 symbol + 策略名称
- PRIMARY/SHADOW 类型标识
- OPEN/CLOSED 状态标识
- 核心指标：ROI、总盈亏、当前价
- 开仓日期 / 平仓日期

**颜色规则：**
- 盈利（PnL > 0）→ 绿色
- 亏损（PnL < 0）→ 红色
- 持平 → 灰色

### 4.2 TransactionCard

在交易记录列表中展示单条交易。有两种展示形态：

- **桌面端**：表格行（`TransactionRow`）
- **移动端**：卡片（`TransactionCard`）

```tsx
interface TransactionCardProps {
  transaction: Transaction;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  showPosition?: boolean;  // 是否显示关联持仓
}
```

**展示内容：**
- 日期时间
- BUY/SELL 类型标签（颜色区分）
- Symbol
- 数量、价格、总额
- 手续费
- 关联持仓数量（如已关联）

### 4.3 TransactionListHeader

交易列表的桌面端表头，定义列宽和标签，与 `TransactionRow` 配合使用。

---

## 5. 基金组件（`src/components/funds/`）

### 5.1 FundForm

创建/编辑基金的表单组件（Dialog 内容）。

**字段：**
- 基金名称（必填）
- 描述（可选）
- 初始本金（必填，数字输入）
- 初始份额（必填，数字输入）
- 计价货币（默认 USDT）

**逻辑：**
- 实时计算并预览初始 NAV（`初始本金 / 初始份额`）。
- 提交时调用 `useFundStore.createFund()` 或 `updateFund()`。

### 5.2 FundCard

基金列表页的单个基金卡片。

**展示内容：**
- 基金名称
- 初始本金 vs 当前净值
- 初始 NAV vs 当前 NAV
- NAV 涨跌幅（颜色）
- 关联持仓数量
- ACTIVE/CLOSED 状态

---

## 6. 持仓组件（`src/components/positions/`）

### 6.1 PositionForm

创建新持仓的表单（可从交易列表选中多条交易后触发，也可独立创建空持仓）。

**字段：**
- Symbol（必填，下拉选择或自定义输入）
- 策略名称（可选）
- 持仓类型（PRIMARY/SHADOW 切换开关）
- 关联基金（可选下拉）
- 备注（可选）

**预填充逻辑：**
- 从交易列表选择多条交易创建持仓时，Symbol 自动填入（所有选中交易必须同 Symbol）。
- 系统验证：不同 Symbol 的交易不能混入同一持仓。

### 6.2 PositionEditForm

编辑现有持仓的表单，字段与 PositionForm 类似，额外支持编辑日志（Journal）：
- 开仓原因
- 平仓原因
- 情绪评分（1-5 星）
- 复盘笔记

---

## 7. 交易组件（`src/components/transactions/`）

### 7.1 TransactionForm

手动录入单条交易的表单。

**字段：**
- 交易对（SymbolSelector 组件）
- 类型（BUY/SELL 切换）
- 日期时间（DateTimePicker）
- 价格
- 数量
- 总额（自动计算：`价格 × 数量`，也可手动输入反推数量）
- 手续费
- 备注

**自动计算逻辑：**
- 修改价格或数量 → 自动更新总额。
- 修改总额 → 自动反推数量（`总额 / 价格`）。
- 使用 `math.ts` 工具确保精度。

### 7.2 TransactionEditForm

编辑已有交易，字段与 TransactionForm 相同。

**注意：** 编辑会影响所有已关联该交易的持仓的指标计算（指标是实时计算的，编辑交易数据即时生效）。

### 7.3 SymbolSelector

交易对选择组件，结合 Command（搜索 + 列表）和自定义输入：

```tsx
interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
}
```

**行为：**
- 展示 `predefinedPairs` 列表，支持搜索过滤。
- 允许输入任意自定义交易对（不在预设列表中的也接受）。
- 选择后 Popover 自动关闭。

### 7.4 ImportTransactionsButton

触发文件导入的按钮和处理逻辑：

**支持的文件格式：**
- Binance 交易导出（Excel `.xlsx`）
- 通用 CSV 格式

**Binance 导入流程：**
1. 用户点击按钮，选择 Excel 文件。
2. `xlsx` 库解析文件，转换为 JSON 行。
3. 按 Binance 的列格式解析字段（时间、交易对、方向、价格、数量、金额、手续费、OrderId）。
4. 手续费聚合：同一 OrderId 的多条 Trade 记录的手续费求和。
5. 调用 `bulkAddTransactions()` 批量导入，自动去重（orderId 去重）。
6. 返回 `{ added, skipped }` 结果提示。

**手续费提取正则：**
```typescript
// 费用字段如："0.00123 BNB"
const feeMatch = feeStr.match(/^([\d.]+)\s*([A-Z]+)$/);
const feeAmount = parseFloat(feeMatch?.[1] ?? '0');
```

### 7.5 AiImportFlow

AI 辅助导入流程（多步 Dialog）：

1. 用户粘贴原始交易文本（来自任意格式）。
2. 调用 Claude API 解析文本，提取结构化交易数据。
3. 预览解析结果，用户确认或修改。
4. 确认后调用 `bulkAddTransactions()` 导入。

**设计说明：** 处理各交易所不同格式的历史数据，或用户自己整理的非标准格式。

---

## 8. 样式约定

### 颜色语义

```typescript
// 盈亏颜色
const pnlClass = pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground';

// 类型标签
const typeClass = type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
```

### class 合并工具

```typescript
// 使用 cn() 合并 Tailwind 类名（避免冲突）
import { cn } from '@/lib/utils';

<div className={cn('base-class', condition && 'conditional-class', props.className)} />
```

`cn()` 内部使用 `clsx` + `tailwind-merge`，正确处理 Tailwind 的类名优先级。

### 深色模式

所有组件应同时提供亮色和深色样式：
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

或使用 CSS 变量（来自 `src/index.css`）：
```tsx
<div className="bg-background text-foreground">
```

---

## 9. 新增组件指南

### 添加业务组件

1. 确定放置位置（`funds/`、`positions/`、`transactions/` 或 `shared/`）。
2. 使用 `@/` 路径别名导入。
3. 用 `cn()` 合并类名。
4. 如需 Shadcn 基础组件，先 `npx shadcn@latest add <name>`。

### 注意事项

- **不要**在 `src/components/ui/` 中手动添加或修改文件。
- 尽量使用 CSS 变量（`bg-background`、`text-foreground` 等），而非硬编码颜色，确保深色模式正确。
- 金额显示始终用 `toFixed(2)` 或自定义格式化函数，不直接展示浮点数。
