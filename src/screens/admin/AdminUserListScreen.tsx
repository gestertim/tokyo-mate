import { useCallback, useState } from 'react';
import { loadAdminUsers } from '../../services/admin-api';
import { AdminLoading, useAdminData } from './useAdminData';
export const adminStatusLabel: Record<string, string> = { pending: '待審核', approved: '已核准', rejected: '已拒絕', revoked: '已撤銷', expired: '已到期' };
export function AdminUserListScreen({ onSelect }: { onSelect: (subject: string) => void }) {
  const [offset, setOffset] = useState(0);
  const load = useCallback((signal: AbortSignal) => loadAdminUsers(offset, signal), [offset]);
  const { data, error, refresh } = useAdminData(load);
  return <section aria-label="管理使用者清單"><h2>使用者清單</h2>
    {!data ? <AdminLoading error={error} /> : <>
      {data.items.length === 0 && <p>目前沒有使用者資料。</p>}
      <ul>{data.items.map((u) => <li key={u.identitySubject}>
        <button onClick={() => onSelect(u.identitySubject)}>{u.displayName ?? u.maskedContact ?? u.identitySubject}</button>
        {' '}{adminStatusLabel[u.status]}／{u.tier === 'tier2' ? '第二級' : u.tier === 'tier1' ? '第一級' : '尚未核准'}
        {u.daily && <p>日已用 US${u.daily.usedEstimatedUsd}／預留 US${u.daily.reservedEstimatedUsd}／剩餘 US${u.daily.remainingEstimatedUsd}</p>}
        {u.weekly && <p>週已用 US${u.weekly.usedEstimatedUsd}／預留 US${u.weekly.reservedEstimatedUsd}／剩餘 US${u.weekly.remainingEstimatedUsd}</p>}
      </li>)}</ul>
      <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>上一頁</button>
      <button disabled={data.nextOffset === null} onClick={() => setOffset(data.nextOffset ?? 0)}>下一頁</button>
    </>}
    <button onClick={refresh}>重新確認使用者</button>
  </section>;
}
