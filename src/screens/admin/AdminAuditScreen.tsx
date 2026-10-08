import { useCallback, useState } from 'react';
import { loadAdminAudit } from '../../services/admin-api';
import { useAdminData, AdminLoading } from './useAdminData';
import { adminActionLabel } from './AdminMutationPanel';
export function AdminAuditScreen() {
  const [offset, setOffset] = useState(0);
  const load = useCallback((signal: AbortSignal) => loadAdminAudit(offset, signal), [offset]);
  const { data, error, refresh } = useAdminData(load);
  return <section aria-label="管理稽核紀錄"><h2>稽核紀錄</h2>
    {!data ? <AdminLoading error={error} /> : <>
      {data.items.length === 0 && <p>目前沒有稽核紀錄。</p>}
      <ul>{data.items.map((a) => <li key={a.auditId}>
        <h3>{adminActionLabel[a.action]}</h3><p>{a.createdAt}／管理者 {a.adminSubject}／目標 {a.targetIdentitySubject}</p>
        <p>操作鍵 {a.idempotencyKey}／稽核 {a.auditId}／原因 {a.reasonCode}</p>
        <p>前狀態 {a.before.status ?? '—'}／{a.before.tier ?? '—'}；後狀態 {a.after.status ?? '—'}／{a.after.tier ?? '—'}</p>
        {a.weekWindowKey && <p>本次 US${a.amountEstimatedUsd}／{a.weekWindowKey}／到期 {a.expiresAt}／全六端點共用；
          追加 ID {a.topUpId ?? '—'}；
          操作後同週累計 US${((a.after.cumulativeWeeklyTopUpMicroUsd ?? 0) / 1_000_000).toFixed(2)}</p>}
      </li>)}</ul>
      <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>上一頁</button>
      <button disabled={data.nextOffset === null} onClick={() => setOffset(data.nextOffset ?? 0)}>下一頁</button>
    </>}<button onClick={refresh}>重新確認稽核紀錄</button>
  </section>;
}
