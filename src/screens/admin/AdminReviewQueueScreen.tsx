import { useCallback, useState } from 'react';
import { loadAdminReviews, type AdminReview } from '../../services/admin-api';
import { AdminLoading, useAdminData } from './useAdminData';
export function AdminReviewQueueScreen({ onReview }: { onReview: (review: AdminReview) => void }) {
  const [offset, setOffset] = useState(0);
  const load = useCallback((signal: AbortSignal) => loadAdminReviews(offset, signal), [offset]);
  const { data, error, refresh } = useAdminData(load);
  return <section aria-label="管理待審核事項"><h2>待審核事項</h2>
    {!data ? <AdminLoading error={error} /> : <>
      {data.items.length === 0 && <p>目前沒有待審核事項。</p>}
      <ul>{data.items.map((r) => <li key={r.reviewId}>{r.kind === 'paid_access' ? '付費資格申請' : '本週追加申請'}：
        {r.targetIdentitySubject}／{r.createdAt}
        {r.reasonCode && <p>申請原因：{r.reasonCode === 'paid_feature_access' ? '申請付費功能資格' :
          r.reasonCode === 'weekly_limit_review' ? '本週額度已滿' : '本週剩餘不足預留門檻'}</p>}
        {r.weekWindowKey && <p>申請週：{r.weekWindowKey}</p>}
        {r.tier !== undefined && <p>目前等級：{r.tier ?? '尚未核准'}</p>}
        {r.weekly && <p>週已用 US${r.weekly.usedEstimatedUsd}／預留 US${r.weekly.reservedEstimatedUsd}／剩餘 US${r.weekly.remainingEstimatedUsd}</p>}
        <button onClick={() => onReview(r)}>檢視並審核</button></li>)}</ul>
      <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>上一頁</button>
      <button disabled={data.nextOffset === null} onClick={() => setOffset(data.nextOffset ?? 0)}>下一頁</button>
    </>}<button onClick={refresh}>重新確認待審核事項</button>
  </section>;
}
