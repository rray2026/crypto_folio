# 路由与页面设计

## 1. 路由结构

使用 React Router v7（browser 模式），路由配置在 `src/App.tsx`：

```
/                           → Dashboard（仪表盘）
/positions                  → Positions（持仓列表）
/positions/:id              → PositionDetails（持仓详情）
/transactions               → Transactions（交易记录列表）
/transactions/:id           → TransactionDetails（交易详情）
/assets/:symbol             → AssetDetails（标的详情）
/funds                      → Funds（基金列表）
/funds/:id                  → FundDetails（基金详情）
/settings                   → Settings（设置）
/settings/trading-pairs     → TradingPairs（交易对配置）
/glossary                   → Glossary（名词解释）
```

所有路由都被 `AppLayout` 包裹，公用同一套导航/布局。

---

## 2. 布局架构

### 2.1 AppLayout

`src/components/layout/AppLayout.tsx` 是顶级布局组件：

```
┌─────────────────────────────────────────────────────┐
│ Desktop:                                            │
│ ┌──────────┬──────────────────────────────────────┐ │
│ │          │                                      │ │
│ │ Sidebar  │  <Outlet />（当前路由页面）           │ │
│ │ (固定)   │                                      │ │
│ │          │                                      │ │
│ └──────────┴──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Mobile:                                             │
│ ┌─────────────────────────────────────────────────┐ │
│ │ MobileHeader（顶部动态标题栏）                   │ │
│ ├─────────────────────────────────────────────────┤ │
│ │                                                 │ │
│ │ <Outlet />（当前路由页面）                       │ │
│ │                                                 │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ MobileNav（底部导航栏）                          │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

响应断点：`md`（768px）以上显示 Sidebar，以下显示 Mobile 布局。

### 2.2 Sidebar（桌面导航）

`src/components/layout/Sidebar.tsx`

- 固定在左侧，包含所有主要路由的导航链接。
- 使用 `NavLink` 实现当前路由高亮。
- 包含 Logo 和版本号（从 `package.json` 的 `__BUILD_DATE__` 注入）。
- 底部固定：Settings 链接。

**导航项：**
| 图标 | 标签 | 路由 |
|------|------|------|
| LayoutDashboard | 仪表盘 | `/` |
| TrendingUp | 持仓 | `/positions` |
| ArrowLeftRight | 交易记录 | `/transactions` |
| Wallet | 基金 | `/funds` |
| Settings | 设置 | `/settings` |

### 2.3 MobileHeader（移动端顶部栏）

`src/components/layout/MobileHeader.tsx`

- 顶部固定，高度固定（如 56px）。
- 内容**动态**：由当前页面通过 `useMobileHeader()` hook 设置。
- 结构：`[左侧 Action] [居中标题] [右侧 Actions]`

### 2.4 MobileNav（移动端底部导航）

`src/components/layout/MobileNav.tsx`

- 底部固定，5 个 Tab 图标（仪表盘/持仓/交易/基金/设置）。
- 当前激活 Tab 高亮显示。
- 点击切换路由。

---

## 3. 移动端动态头部系统

### 3.1 设计动机

移动端每个页面的标题和顶部 Action 按钮都不同（如持仓页右上角有"新建"按钮，详情页左上角有"返回"按钮），需要动态配置 MobileHeader。

使用 Context + Hook 实现，避免通过 Router 层层传 props。

### 3.2 实现结构

```typescript
// src/contexts/MobileHeaderContextDefinition.ts
interface MobileHeaderConfig {
  title: string;
  leftAction?: ReactNode;   // 通常是返回按钮
  rightActions?: ReactNode; // 通常是操作按钮（新建、编辑等）
}

// src/contexts/MobileHeaderContext.tsx
const MobileHeaderContext = createContext<{
  config: MobileHeaderConfig;
  setMobileHeader: (config: MobileHeaderConfig) => void;
}>(/* ... */);

export function MobileHeaderProvider({ children }) {
  const [config, setConfig] = useState<MobileHeaderConfig>({ title: '' });
  return (
    <MobileHeaderContext.Provider value={{ config, setMobileHeader: setConfig }}>
      {children}
    </MobileHeaderContext.Provider>
  );
}

// src/hooks/useMobileHeader.ts
export function useMobileHeader() {
  return useContext(MobileHeaderContext);
}
```

### 3.3 页面使用方式

```typescript
// 在页面组件中
function PositionDetails() {
  const { setMobileHeader } = useMobileHeader();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileHeader({
      title: '持仓详情',
      leftAction: (
        <button onClick={() => navigate(-1)}>
          <ChevronLeft />
        </button>
      ),
      rightActions: (
        <button onClick={openEditDialog}>
          <Edit2 />
        </button>
      ),
    });
  }, [setMobileHeader, navigate, openEditDialog]);

  // ...
}
```

`MobileHeaderProvider` 包裹在 `AppLayout` 中，所有子页面均可使用。

---

## 4. 页面功能详述

### 4.1 Dashboard（`/`）

**主要功能：**
- 显示固定交易对（Pinned Pairs）的实时价格。
- 显示全局投资组合指标（totalPnL、globalROI、winRate）。
- 支持时间范围筛选（1M/3M/6M/1Y/ALL）。

**数据流：**
1. 从 `useSettingsStore` 读取 `pinnedPairs` 和 `prices`。
2. 页面挂载时调用 `fetchPrices()`。
3. 从 IndexedDB 读取所有 PRIMARY 持仓，调用 `getPortfolioMetrics()`。
4. PullToRefresh 触发 `fetchPrices({ force: true })`。

### 4.2 Positions（`/positions`）

**主要功能：**
- 持仓列表，按 status（OPEN/CLOSED）分组显示。
- 支持按 symbol、名称搜索过滤。
- 每个持仓卡片显示 PositionMetrics（ROI、PnL 等）。
- 可创建新持仓（弹出 PositionForm）。

**注意：** 列表页对每个持仓都调用 `getPositionMetrics()`，需要当前价格。页面挂载时批量获取所有 OPEN 持仓标的的价格。

### 4.3 PositionDetails（`/positions/:id`）

**主要功能：**
- 持仓完整信息：指标、关联交易、日志。
- 添加/移除关联交易。
- 关闭/重新开启持仓。
- 编辑持仓信息（名称、策略、备注）。
- 编辑日志（Journal）。

**数据加载：**
```typescript
const position = useLiveQuery(
  () => db.positions.get(id),
  [id]
);
const linkedTxs = useLiveQuery(
  () => db.transactions
    .where('id').anyOf(position?.entries.map(e => e.transactionId) ?? [])
    .toArray(),
  [position]
);
```

### 4.4 Transactions（`/transactions`）

**主要功能：**
- 交易记录列表，按日期降序排列。
- 多维度筛选：时间范围、交易类型、symbol、关联状态。
- 批量选择 → 创建持仓。
- 单条手动录入。
- 批量导入（CSV/Excel）。
- AI 辅助导入。

### 4.5 Funds（`/funds`）

**主要功能：**
- 基金列表，每个 FundCard 显示 NAV 和涨跌幅。
- 创建新基金。

### 4.6 FundDetails（`/funds/:id`）

**主要功能：**
- 基金详情：NAV 图表、指标。
- 关联持仓列表。
- 持仓分配（assignPositionToFund）。

### 4.7 Settings（`/settings`）

**主要功能：**
- 主题切换（深色/浅色/跟随系统）。
- 数据备份（下载 JSON）。
- 数据恢复（上传 JSON）。
- 数据库版本信息和兼容性状态。
- 应用版本和构建日期。

### 4.8 TradingPairs（`/settings/trading-pairs`）

**主要功能：**
- 管理预设交易对列表。
- 为每个交易对配置 Exchange 和数据提供商。
- 固定/取消固定交易对（显示在 Dashboard）。
- 实时测试价格获取（点击刷新按钮）。

### 4.9 AssetDetails（`/assets/:symbol`）

**主要功能：**
- 显示特定标的的所有持仓（按 symbol 过滤）。
- 标的级别的汇总指标。

### 4.10 Glossary（`/glossary`）

- 静态页面，展示名词解释和计算公式说明。
- 内容来自 `docs/GLOSSARY.md` 的整理（UI 中直接渲染）。

---

## 5. 主题管理

主题由 `useSettingsStore` 统一管理，`App.tsx` 监听变化并应用到 `<html>` 元素：

```typescript
// src/App.tsx
function ThemeApplier() {
  const { theme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return null;
}
```

Tailwind 使用 `class` 策略（`darkMode: 'class'`），因此只要 `<html>` 有 `dark` 类，所有 `dark:` 前缀的样式都生效。

**规则：读写主题只能通过 `useSettingsStore`，不能直接操作 `document.documentElement`。**
