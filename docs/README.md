# CryptoFolio 文档中心

隐私优先的本地加密货币持仓追踪工具。所有用户数据存储在浏览器本地 IndexedDB，无任何服务端依赖。

---

## 技术文档（开发者）

### 核心模块设计

| 文档 | 内容 |
|------|------|
| [数据模型](technical/01-data-model.md) | Transaction / Position / Fund 的字段定义、实体关系、删除级联规则 |
| [数据库与迁移](technical/02-database.md) | Dexie 配置、Schema 版本管理、各版本迁移逻辑 |
| [状态管理](technical/03-state-management.md) | 四个 Zustand Store 的 action 设计、响应式查询模式 |
| [指标计算引擎](technical/04-metrics-engine.md) | LONG/SHORT 盈亏计算、NAV 模型、全局组合指标 |
| [价格获取](technical/05-price-fetching.md) | 多交易所 API、缓存策略、Yahoo Finance 代理 |
| [路由与页面](technical/06-routing-and-pages.md) | 路由配置、布局架构、移动端动态头部系统 |
| [组件架构](technical/07-components.md) | 组件目录结构、各组件职责、样式约定 |
| [备份与恢复](technical/08-backup-restore.md) | 备份文件格式、导入导出流程、跨版本迁移 |
| [测试体系](technical/09-testing.md) | 测试工具栈、各测试文件职责、测试编写指南 |

### 总体架构

- [技术架构总览](architecture.md) — 系统设计原则、技术选型、关键模式
- [部署指南](deployment.md) — Cloudflare Pages 部署流程

---

## 用户指南

1. [市场行情与仪表盘](guides/01-market-watch.md) — 实时价格追踪和固定资产
2. [交易记录管理](guides/02-transaction-mastery.md) — 手动录入与批量导入
3. [持仓策略](guides/03-position-strategies.md) — PRIMARY vs SHADOW 持仓设计
4. [绩效分析](guides/04-performance-analytics.md) — ROI、胜率、时间范围过滤
5. [数据安全与界面](guides/05-data-security.md) — 备份、恢复与主题设置

---

## 名词解释

- [GLOSSARY.md](GLOSSARY.md) — 核心指标定义与计算公式（中文）

---

## 开发快速参考

```bash
npm run dev          # 启动开发服务器
npm test             # 运行测试
npm run lint         # 代码检查
npm run build        # 生产构建（推送前必须通过）
npm run deploy       # 部署到 Cloudflare Pages
```

**推送前检查清单：**
1. `npm run lint` — 无 lint 错误
2. `npm run build` — 构建成功（含 TypeScript 类型检查）
3. `npm test` — 所有测试通过

详见 [CLAUDE.md](../CLAUDE.md)。
