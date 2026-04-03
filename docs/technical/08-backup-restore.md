# 备份与恢复系统

## 1. 概览

备份恢复功能实现在 `src/lib/backup.ts`，是用户数据跨设备迁移和版本升级的唯一途径（因为没有服务器）。

**核心函数：**
- `exportData()`：将全量数据导出为 JSON 文件下载
- `importData(file)`：从 JSON 文件恢复数据

---

## 2. 备份文件格式

### 2.1 BackupPayload 结构

```typescript
interface BackupPayload {
  version: number;         // 备份版本号（当前：4）
  timestamp: number;       // 导出时的 Unix 时间戳
  appName: 'CryptoFolio'; // 应用标识（用于验证）
  transactions: Transaction[];
  positions: Position[];
  funds: Fund[];
  settings: {
    predefinedPairs: string[];
    pairConfigs?: PairConfig[];
    dashboardTimeRange: DashboardTimeRange;
    theme: Theme;
    // 注意：不包含 prices 缓存（实时数据，无需备份）
    // 注意：不包含 pinnedPairs（v4 之前的备份可能没有）
  };
}
```

### 2.2 文件命名

```
cryptofolio-backup-YYYY-MM-DD.json
```

例：`cryptofolio-backup-2026-04-03.json`

---

## 3. 导出流程（`exportData`）

```typescript
async function exportData(): Promise<void> {
  // 1. 从 IndexedDB 读取全量数据
  const [transactions, positions, funds] = await Promise.all([
    db.transactions.toArray(),
    db.positions.toArray(),
    db.funds.toArray(),
  ]);

  // 2. 从 localStorage 读取 Zustand 持久化设置
  const settingsRaw = localStorage.getItem('crypto-folio-settings');
  const settings = settingsRaw ? JSON.parse(settingsRaw) : {};

  // 3. 构建 payload
  const payload: BackupPayload = {
    version: BACKUP_VERSION,  // 当前：4
    timestamp: Date.now(),
    appName: 'CryptoFolio',
    transactions,
    positions,
    funds,
    settings: {
      predefinedPairs: settings.state?.predefinedPairs ?? [],
      pairConfigs: settings.state?.pairConfigs ?? [],
      dashboardTimeRange: settings.state?.dashboardTimeRange ?? 'ALL',
      theme: settings.state?.theme ?? 'system',
    },
  };

  // 4. 序列化并触发下载
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cryptofolio-backup-${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**关键设计：**
- 价格缓存（`prices`）不导出——它是实时数据，恢复后会重新获取。
- Settings 从 localStorage 中单独读取，而非从 Zustand store 实例（保证在任何时机都可读）。

---

## 4. 导入流程（`importData`）

```typescript
async function importData(file: File): Promise<void> {
  // 1. 读取并解析 JSON
  const text = await file.text();
  let payload: BackupPayload = JSON.parse(text);

  // 2. 验证文件合法性
  if (payload.appName !== 'CryptoFolio') {
    throw new Error('不是有效的 CryptoFolio 备份文件');
  }
  if (typeof payload.version !== 'number') {
    throw new Error('备份文件缺少版本号');
  }
  if (payload.version > BACKUP_VERSION) {
    throw new Error('备份文件来自更新版本的应用，请先更新应用');
  }

  // 3. 版本迁移（如果备份版本低于当前版本）
  if (payload.version < BACKUP_VERSION) {
    payload = migratePayload(payload, payload.version, BACKUP_VERSION);
  }

  // 4. 清空现有数据
  await Promise.all([
    db.transactions.clear(),
    db.positions.clear(),
    db.funds.clear(),
  ]);

  // 5. 批量写入新数据
  await Promise.all([
    db.transactions.bulkAdd(payload.transactions),
    db.positions.bulkAdd(payload.positions),
    db.funds.bulkAdd(payload.funds ?? []),
  ]);

  // 6. 恢复设置到 localStorage
  const existingRaw = localStorage.getItem('crypto-folio-settings');
  const existing = existingRaw ? JSON.parse(existingRaw) : { state: {} };
  const mergedSettings = {
    ...existing,
    state: {
      ...existing.state,
      predefinedPairs: payload.settings.predefinedPairs ?? existing.state.predefinedPairs,
      pairConfigs: payload.settings.pairConfigs ?? existing.state.pairConfigs,
      dashboardTimeRange: payload.settings.dashboardTimeRange ?? existing.state.dashboardTimeRange,
      theme: payload.settings.theme ?? existing.state.theme,
    },
    version: BACKUP_VERSION,
  };
  localStorage.setItem('crypto-folio-settings', JSON.stringify(mergedSettings));

  // 7. 强制刷新页面（确保 React 和 Zustand 状态从新数据初始化）
  window.location.reload();
}
```

**关键设计决策：**

**为什么要 `window.location.reload()`？**

导入完成后，内存中的 Zustand 状态与新数据库状态不一致（Zustand 还是旧数据）。强制刷新确保所有状态从头初始化。如果不刷新，可能出现显示的是旧数据但数据库已是新数据的不一致状态。

**为什么先 clear() 再 bulkAdd()？**

避免新旧数据混合。如果只做 `put()`（upsert），旧数据中存在但备份中不存在的记录会残留，导致数据不干净。

**Settings 合并策略：**

采用"备份优先"合并：有备份的字段用备份值，备份中没有的字段保留当前值。这样即使旧版本备份缺少某些字段，也不会丢失当前设置。

---

## 5. 版本迁移（`migratePayload`）

```typescript
// src/lib/migrations.ts
export function migratePayload(
  payload: BackupPayload,
  fromVersion: number,
  toVersion: number
): BackupPayload {
  let current = { ...payload };

  for (let v = fromVersion; v < toVersion; v++) {
    // MIGRATIONS 数组从 index 0 开始，对应 v1→v2 迁移
    const migration = MIGRATIONS[v - 1];
    current = migration.upgradePayload(current);
    current.version = v + 1;
  }

  return current;
}
```

**示例：** 从 v2 备份导入到当前 v4 应用：
1. 执行 `MIGRATIONS[1].upgradePayload()`（v2→v3）：确保 funds 数组存在。
2. 执行 `MIGRATIONS[2].upgradePayload()`（v3→v4）：重命名 dataSource → dataProvider。

---

## 6. 错误处理

导入时可能抛出的错误：

| 错误 | 原因 | 处理方式 |
|------|------|---------|
| `appName` 不匹配 | 不是 CryptoFolio 的备份文件 | 提示用户选择正确的文件 |
| `version` 缺失或非数字 | 文件格式损坏 | 提示文件损坏 |
| 备份版本 > 应用版本 | 备份来自更新版本的 App | 提示用户更新 App |
| JSON.parse 失败 | 文件内容不是合法 JSON | 提示文件损坏 |
| IndexedDB 写入失败 | 存储空间不足或权限问题 | 向用户展示错误详情 |

UI 层（Settings 页面）捕获所有异常并通过 toast 通知用户。

---

## 7. 开发注意事项

### 修改数据结构时的备份兼容性

每次修改 `Transaction`、`Position`、`Fund` 或 Settings 的结构时，必须：

1. 在 `src/lib/migrations.ts` 添加新的 Migration（实现 `upgradePayload`）。
2. 增加 `BACKUP_VERSION`（与 `DB_VERSION` 保持同步）。
3. 在 `src/lib/backup.ts` 中确认 `exportData` 正确导出新字段。
4. 为新迁移添加测试（`src/lib/backup.test.ts` 和 `src/lib/migrations.test.ts`）。

### 测试备份迁移

```typescript
// src/lib/backup.test.ts 示例
it('imports v2 backup and migrates to v4', async () => {
  const v2Payload = {
    version: 2,
    appName: 'CryptoFolio',
    transactions: [...],
    positions: [{ id: '1', type: undefined }], // v2 可能没有 type
    funds: undefined,
    settings: { pairConfigs: [{ dataSource: 'Binance' }] },
  };

  await importData(new File([JSON.stringify(v2Payload)], 'backup.json'));

  // 验证 positions 都有了 type
  const positions = await db.positions.toArray();
  expect(positions[0].type).toBe('PRIMARY');

  // 验证 pairConfigs 字段名已迁移
  const settings = JSON.parse(localStorage.getItem('crypto-folio-settings')!);
  expect(settings.state.pairConfigs[0].dataProvider).toBe('Binance');
  expect(settings.state.pairConfigs[0].dataSource).toBeUndefined();
});
```
