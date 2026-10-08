import { useEffect, useRef, useState } from 'react';
import { AccessApiError, loadOwnQuota } from '../services/access-api';
import { loadEpochOperationStatus, loadOperationStatus, loadOwnRequests, submitOwnRequest, withdrawOwnRequest } from '../services/self-service-api';
import type { OperationView, OwnRequestInput, OwnRequestPage, RequestKind } from '../types/self-service';

const reasons = { paid_feature_access: '申請付費功能資格', weekly_limit_review: '本週額度已滿，申請審核追加',
  weekly_floor_review: '本週剩餘不足預留門檻，申請審核追加' };
const statuses = { pending: '待審核', resolved: '已處理', withdrawn: '已撤回' };
export function SelfServiceScreen({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<RequestKind>('paid_access');
  const [reason, setReason] = useState<OwnRequestInput['reasonCode']>('paid_feature_access');
  const [page, setPage] = useState<OwnRequestPage | null>(null);
  const [endpoint, setEndpoint] = useState('assistant');
  const [key, setKey] = useState('');
  const [epochId, setEpochId] = useState('');
  const [epochLookup, setEpochLookup] = useState(false);
  const [operation, setOperation] = useState<OperationView | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const command = useRef<OwnRequestInput | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.abort(); };
  }, []);
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setMessage('');
    try { await action(controller.signal); }
    catch (cause) {
      if (alive.current && !controller.signal.aborted) {
        if (cause instanceof AccessApiError && (cause.code === 'AUTH_REQUIRED' || cause.code === 'ACCESS_NOT_APPROVED')) {
          setPage(null); setOperation(null);
        }
        setError(cause instanceof AccessApiError ? cause.message : '操作結果無法確認，請稍後手動查詢。');
      }
    } finally {
      if (active.current === controller) active.current = null;
      if (alive.current) setBusy(false);
    }
  }
  const list = (offset: number) => run(async (signal) => {
    setPage(null);
    const result = await loadOwnRequests(offset, signal);
    if (alive.current && !signal.aborted) setPage(result);
  });
  const apply = () => run(async (signal) => {
    if (!command.current) {
      let weekWindowKey: string | undefined;
      if (kind === 'weekly_top_up') {
        const quota = await loadOwnQuota(signal);
        weekWindowKey = quota.weekly.weekWindowKey;
        if (!weekWindowKey || !/^\d{4}-W\d{2}$/.test(weekWindowKey))
          throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '目前無法確認當週申請範圍，請稍後手動重試。');
      }
      if (signal.aborted || !alive.current) return;
      command.current = { kind, reasonCode: reason, idempotencyKey: crypto.randomUUID(),
        ...(weekWindowKey ? { weekWindowKey } : {}) };
    }
    const result = await submitOwnRequest(command.current, signal);
    if (alive.current && !signal.aborted) {
      command.current = null;
      setMessage(`申請${statuses[result.status]}；管理者仍須自行決定核准等級或追加。`);
      setPage(null);
    }
  });
  return <section aria-label="本人申請與操作狀態">
    <button onClick={onBack}>返回首頁</button>
    <h2>本人申請與操作狀態</h2>
    <p>僅手動操作；不會在登入時申請、自動查詢或重送付費操作。</p>
    <fieldset disabled={busy || command.current !== null}>
      <legend>提出申請</legend>
      <label>申請類型<select value={kind} onChange={(e) => {
        const next = e.target.value as RequestKind; setKind(next);
        setReason(next === 'paid_access' ? 'paid_feature_access' : 'weekly_limit_review');
      }}><option value="paid_access">付費資格</option><option value="weekly_top_up">本週追加</option></select></label>
      <label>申請原因<select value={reason} onChange={(e) => setReason(e.target.value as OwnRequestInput['reasonCode'])}>
        {Object.entries(reasons).filter(([r]) => kind === 'paid_access' ? r === 'paid_feature_access' : r !== 'paid_feature_access')
          .map(([r, label]) => <option key={r} value={r}>{label}</option>)}
      </select></label>
    </fieldset>
    <button disabled={busy} onClick={apply}>{command.current ? '以相同操作鍵手動確認申請' :
      kind === 'paid_access' ? '申請付費資格' : '申請本週追加'}</button>
    <p>申請不能指定等級或金額；本週追加不提高每日上限，也不保證付費功能立即恢復。</p>
    <h3>本人申請清單</h3>
    <button disabled={busy} onClick={() => list(0)}>查詢本人申請</button>
    {page && <>
      {page.items.length === 0 && <p>目前沒有本人申請。</p>}
      <ul>{page.items.map((r) => <li key={r.reviewId}>
        {r.kind === 'paid_access' ? '付費資格' : '本週追加'}／{statuses[r.status]}／{reasons[r.reasonCode]}／{r.createdAt}
        {r.weekWindowKey && <span>／{r.weekWindowKey}</span>}
        {r.status === 'pending' && <button disabled={busy} onClick={() => run(async (signal) => {
          const result = await withdrawOwnRequest(r.reviewId, signal);
          if (alive.current && !signal.aborted) {
            setPage((previous) => previous && { ...previous, items: previous.items.map((item) => item.reviewId === result.reviewId ? result : item) });
            setMessage('已撤回申請；撤回不會撤銷已核准權利。');
          }
        })}>撤回 {r.reviewId}</button>}
      </li>)}</ul>
      <button disabled={busy || page.nextOffset === null} onClick={() => {
        if (page.nextOffset !== null) void list(page.nextOffset);
      }}>下一頁</button>
    </>}
    <h3>查看操作狀態</h3>
    <p>僅查記帳狀態，不復原內容、不重新執行付費請求。操作鍵不放入網址。</p>
    <label><input type="checkbox" checked={epochLookup} disabled={busy}
      onChange={(e) => { setEpochLookup(e.target.checked); setOperation(null); }} />使用 epoch 操作識別</label>
    {epochLookup && <label>原操作 epoch<input value={epochId} disabled={busy} maxLength={64}
      autoComplete="off" onChange={(e) => { setEpochId(e.target.value); setOperation(null); }} /></label>}
    <label>原操作端點<select disabled={busy} value={endpoint} onChange={(e) => { setEndpoint(e.target.value); setOperation(null); }}>
      {['assistant', 'photo-ocr', 'photo-translate', 'places', 'transcribe', 'speech'].map((v) => <option key={v}>{v}</option>)}
    </select></label>
    <label>原操作識別碼<input disabled={busy} value={key} maxLength={128}
      onChange={(e) => { setKey(e.target.value); setOperation(null); }} autoComplete="off" /></label>
    <button disabled={busy || (epochLookup ? !/^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(epochId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(key) : !/^[A-Za-z0-9_-]{1,128}$/.test(key))} onClick={() => run(async (signal) => {
      setOperation(null);
      const result = epochLookup ? await loadEpochOperationStatus(endpoint, epochId, key, signal) :
        await loadOperationStatus(endpoint, key, signal);
      if (alive.current && !signal.aborted) setOperation(result);
    })}>查看操作狀態</button>
    {operation && <p role="status">{operation.userMessage} 更新時間：{operation.updatedAt} 請確認原畫面，不要自動重送。</p>}
    {busy && <p role="status">正在確認，請勿重複操作。</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
