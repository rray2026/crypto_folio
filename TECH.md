# 加密货币投资记录 (Crypto Trade Tracker) - 技术与架构设计

## 1. 项目定位与形式
本项目定位为一个**纯前端 (Client-side Only)** 驱动的 Web 应用程序 (Single Page Application, SPA)。
所有的核心逻辑、数据存储、盈亏计算都在用户的浏览器本地完成。

*   **无后端依赖**：不需要部署服务器，无需注册/登录系统，用户直接打开网页即可使用。
*   **隐私与安全**：用户所有的交易数据（开仓记录、资金流向）仅保存在用户本机的浏览器中，具有绝对的隐私性。
*   **低成本/零成本部署**：后续可直接托管于 GitHub Pages、Vercel 或 Netlify 等免费静态页面托管平台。

## 2. 技术栈选择 (Technology Stack)

### 2.1 核心框架
*   **前端框架**: React.js (或 Vue 3 / Svelte，当前建议考虑 **React**)
    *   *理由*：生态丰富，组件化维护成本低，非常适合构建这种大量表单交互、数据计算且状态复杂的 Dashboard 类应用。
*   **构建工具**: Vite
    *   *理由*：启动极快，HMR（热更新）体验优秀，优于传统的 Webpack (CRA)。
*   **开发语言**: TypeScript
    *   *理由*：金融类计算（涉及价格、数量等浮点数，以及复杂的波段/交易单数据结构）极易出现类型错误，引入 TypeScript 进行强类型校验是刚需。

### 2.2 状态管理与数据持久化
*   **全局状态管理**: Zustand (React) 或 Pinia (Vue)
    *   *理由*：轻量级，API 简单直观，没有 Redux 繁琐的样板代码。
*   **数据持久化 (Local Storage)**: IndexedDB (基于 Dexie.js 封装) 或 `localStorage`。
    *   *初期 (MVP) 方案*：使用 `localStorage`，实现简单，配合 Zustand 的 persist 中间件可快速落地。
    *   *长期维护 方案*：金融数据可能随时间不断增加（几千条以上的交易记录），建议使用 **Dexie.js** 封装的 IndexedDB，它支持异步，有更好的检索/查询性能，且存储容量远大于 localStorage（后者通常仅有 5MB）。

### 2.3 样式与 UI 组件库
*   **样式方案**: Tailwind CSS
    *   *理由*：快速编写原子类，非常契合需要快速迭代和高度定制的 Dashboard 界面。
*   **UI 组件库 (无头/半成品)**: shadcn/ui (结合 Radix UI)
    *   *理由*：提供极具现代感的设计，且代码直接复制进项目中，可塑性极强，比传统的 Ant Design 或 MUI 看起来更现代且不臃肿。
*   **图表库**: Recharts 或 ECharts
    *   *理由*：用于在“总览看板”中渲染收益曲线、资产占比饼图等，直观展示投资回报趋势。

### 2.4 测试框架 (TDD 驱动)
*   **单元测试与集成测试**: Vitest
    *   *理由*：极速的模块热更，与 Vite 浑然一体。作为本系统 TDD 的底层运行核心。
*   **组件测试库**: React Testing Library
    *   *理由*：模拟最真实的用户交互。
*   **测试策略**: 对底层金融计算函数（均价、成本、ROI分摊等）、状态机流转必须做到严密的覆盖；保证核心逻辑脱离 UI 环境时依旧坚不可摧。

### 2.5 外部接口 (可选/进阶)
*   因为是纯前端应用，初期核心功能（计算实际盈亏）完全依赖用户手动输入数据。
*   若要实现“未实现盈亏(浮盈评估)”，必须获取实时标价，可以调用免费公开的 API：
    *   **CoinGecko API** 或 **Binance Public API** (仅获取 ticker 数据，无须鉴权)。

## 3. 核心数据结构设计 (Data Model Sketch)

*这是将要在本地存储中维护的核心 JSON 数据结构。*

### 3.1 交易单 (Transaction)
记录真实的买卖行为。
```typescript
interface Transaction {
  id: string; // 唯一 UUID
  date: number; // 交易时间戳
  symbol: string; // 交易对，如 "BTC/USDT", "SOL/USDT"
  type: "BUY" | "SELL"; // 交易方向
  price: number; // 成交均价（U）
  amount: number; // 成交数量（币个数量）
  fee: number; // 交易手续费（可折算为 USDT 或计价币种）
  associatedPositionIds: string[]; // 关联的“波段(Position)” ID 列表；若为空表示尚未分配至任何波段
  notes?: string; // 备注
}
```

### 3.2 交易波段 (Position)
将特定策略的一组买卖聚合计算盈亏（【核心实体】）。
```typescript
interface Position {
  id: string; // 唯一 UUID
  symbol: string; // 关联交易对
  strategyName: string; // 波段名称/策略标签 (如：“三月马斯克喊单波段”、“BTC定投#1”)
  status: "OPEN" | "CLOSED"; // 当前波段状态
  
  // 关联记录，这是一种中间状态。为了支持多波段共用同一笔交易的“部分数量”，
  // 可能需要建立一个更细化的关联结构(PositionEntry)，而不仅是简单的交易 ID 数组。
  entries: Array<{
    transactionId: string; // 关联的底层交易ID
    allocatedAmount: number; // 从该笔交易中划拨到本波段的具体数量
  }>;
  
  // -- 缓存或实时算出的冗余指标 (可不持久化，由 Getter 动态算出) --
  // averageEntryPrice: number; 综合开仓均价
  // totalCost: number;         开仓总成本
  // realizedPnL: number;       已实现盈亏 (U)
  
  // 复盘与日志
  journal?: {
    entryReason?: string; // 建仓理由
    exitReason?: string; // 平仓/止损理由
    moodScore?: number; // 情绪打分 1-5
    reviewNotes?: string; // 复盘反思详细文字
  }
}
```

## 4. 架构难点与解决方案
*   **多对多与部分数量拆分 (Partial Allocation)**: 
    由于需求提到“一笔交易可能分配到多个波段”，这意味着一条买入记录可能只拿了 30% 分给波段A，剩余 70% 留给波段B。
    *   *方案*：必须引入类似上面定义的 `Position.entries` 结构，明确指出“某笔交易中，到底有多少仓位是被划分给当前波段的”。
*   **浮点数精度问题**:
    JavaScript 原生的 `number` 在处理 `0.1 + 0.2` 等浮点运算时存在精度丢失，这在金融资产计算时是灾难性的。
    *   *方案*：项目中必须引入第三方数学库进行高精度运算，如 `decimal.js` 或 `bignumber.js`。所有的价格/数量/手续费/盈亏计算必须封装一层精确的运算 Util 函数。
