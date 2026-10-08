import { useState } from 'react';
import { AdminOverviewScreen } from './AdminOverviewScreen';
import { AdminUserListScreen } from './AdminUserListScreen';
import { AdminUserDetailScreen } from './AdminUserDetailScreen';
import { AdminReviewQueueScreen } from './AdminReviewQueueScreen';
import { AdminAuditScreen } from './AdminAuditScreen';
import { EpochLifecycleScreen } from './EpochLifecycleScreen';
import type { AdminReview } from '../../services/admin-api';
export function AdminDashboardScreen({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState('overview');
  const [authorized, setAuthorized] = useState(false);
  const [subject, setSubject] = useState('');
  const [review, setReview] = useState<AdminReview | null>(null);
  return <section aria-label="獨立管理者區域">
    {authorized && <nav aria-label="管理頁面">
      {([['overview', '總覽'], ['users', '使用者'], ['reviews', '待審核'], ['audit', '稽核'], ['epochs', '本機 epoch 稽核']] as const).map(([key, label]) =>
        <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => { setReview(null); setPage(key); }}>{label}</button>)}
    </nav>}
    {page === 'overview' && <AdminOverviewScreen onBack={onBack} onAuthorized={() => setAuthorized(true)} />}
    {page === 'users' && <AdminUserListScreen onSelect={(s) => { setSubject(s); setReview(null); setPage('detail'); }} />}
    {page === 'reviews' && <AdminReviewQueueScreen onReview={(r) => { setSubject(r.targetIdentitySubject); setReview(r); setPage('detail'); }} />}
    {page === 'detail' && <AdminUserDetailScreen key={`${subject}:${review?.reviewId ?? ''}`} subject={subject}
      reviewId={review?.reviewId} reviewKind={review?.kind} />}
    {page === 'audit' && <AdminAuditScreen />}
    {page === 'epochs' && <EpochLifecycleScreen />}
    <p>此區顯示估算成本與內部額度，非供應商實際帳單。管理者自身亦受日／週額度及原子預留限制。
      沒有週追加累計上限，無法僅靠個人週額度保證整站帳單上限。異動不會自動重送。</p>
    {page !== 'overview' && <button onClick={onBack}>返回公開內容</button>}
  </section>;
}
