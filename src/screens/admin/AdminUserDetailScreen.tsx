import { useCallback, useRef } from 'react';
import { loadAdminUserDetail } from '../../services/admin-api';
import { AdminLoading, useAdminData } from './useAdminData';
import { AdminMutationPanel } from './AdminMutationPanel';
import { adminStatusLabel } from './AdminUserListScreen';
interface Props { subject: string; reviewId?: string; reviewKind?: 'paid_access' | 'weekly_top_up' }
export function AdminUserDetailScreen({ subject, reviewId, reviewKind }: Props) {
  const load = useCallback((signal: AbortSignal) => loadAdminUserDetail(subject, signal), [subject]);
  const { data, error, refresh } = useAdminData(load);
  const refreshButton = useRef<HTMLButtonElement>(null);
  return <section aria-label="管理使用者詳情"><h2>使用者詳情</h2>
    {!data ? <AdminLoading error={error} /> : <>
      <h3>{data.displayName ?? data.maskedContact ?? data.identitySubject}</h3>
      <p>{adminStatusLabel[data.status]}／{data.tier ?? '尚未核准'}</p>
      {([['日', data.daily], ['週', data.weekly]] as const).map(([label, w]) => <section key={label} aria-label={`${label}估算額度`}>
        <h3>{label}估算額度</h3><p>上限 US${w.limitEstimatedUsd}；已用 US${w.usedEstimatedUsd}；
          預留 US${w.reservedEstimatedUsd}；剩餘 US${w.remainingEstimatedUsd}</p><p>重置時間：{w.resetAt}</p>
      </section>)}
      <h3>本週六端點用量摘要</h3><ul>{data.endpointUsage.map((e) =>
        <li key={e.endpoint}>{e.endpoint}：{e.requestCount} 次／估算 US${e.estimatedUsd}</li>)}</ul>
      {data.topUps.length === 100 && <p>此頁最多顯示 100 筆本週追加。其他追加可由稽核紀錄取得 ID，手動指定撤銷；並非追加次數上限。</p>}
      <AdminMutationPanel key={`${data.identitySubject}:${reviewId ?? ''}`} user={data} reviewId={reviewId} reviewKind={reviewKind}
        onComplete={() => { refreshButton.current?.focus(); refresh(); }} />
    </>}
    <button ref={refreshButton} onClick={refresh}>重新確認詳情</button>
  </section>;
}
