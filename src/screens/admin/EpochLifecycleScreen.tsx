import { useRef, useState } from 'react';
import { AdminApiError, submitEpochLifecycleStep } from '../../services/admin-api';
import type { EpochLifecycleAction, EpochLifecycleInput } from '../../../api/_lib/epoch-lifecycle';

export function EpochLifecycleScreen() {
  const [action, setAction] = useState<EpochLifecycleAction>('review_uncertain');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [nextVersion, setNextVersion] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [inspected, setInspected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const command = useRef<EpochLifecycleInput | null>(null);
  async function submit(step: 'inspect' | 'confirm') {
    if (busy) return;
    if (!command.current) {
      command.current = { operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
        step: 'inspect', action, target, reasonCode: reason, dryRun,
        ...(evidence ? { evidenceRef: evidence } : {}), ...(nextVersion ? { nextVersion } : {}) };
    }
    if (step === 'confirm' && command.current.step === 'inspect') {
      if (!inspected) return;
      command.current = { ...command.current, step: 'confirm', idempotencyKey: crypto.randomUUID() };
    }
    setBusy(true); setMessage('');
    try {
      const result = await submitEpochLifecycleStep(command.current);
      if (step === 'inspect') setInspected(true);
      setMessage(`已記錄${step === 'inspect' ? '第一步檢視' : dryRun ? '第二步 dry-run' : '第二步本機確認'}；稽核識別：${result.auditId}。人工覆核不代表帳務結案，不會釋額或重送。`);
    } catch (error) {
      setMessage(error instanceof AdminApiError ? error.message : '結果未知，請以相同步驟手動確認；不會自動重送。');
    } finally { setBusy(false); }
  }
  return <section aria-label="本機 epoch 生命週期分步稽核">
    <h2>本機 epoch 生命週期分步稽核</h2>
    <p>僅限 TEST_ONLY；正式清除、輪替與撤銷未批准。每一步後端重新驗證管理者、原操作識別、理由及可信證據。正常輪替90天、保存30天僅為可配置本機參數。</p>
    <fieldset disabled={busy || command.current !== null}>
      <label>操作<select value={action} onChange={(e) => setAction(e.target.value as EpochLifecycleAction)}>
        <option value="review_uncertain">uncertain 帳務覆核</option><option value="cleanup">保存收斂／清除 dry-run</option>
        <option value="retire_epoch">epoch 退役</option><option value="rotate_key">正常 key 輪替</option>
        <option value="revoke_key">洩漏 key 撤銷</option><option value="retire_key">key 引用歸零退役</option>
      </select></label>
      <label>原操作／epoch／family:version 識別<input value={target} maxLength={256} autoComplete="off"
        onChange={(e) => setTarget(e.target.value)} /></label>
      <label>理由代碼<input value={reason} maxLength={128} onChange={(e) => setReason(e.target.value)} /></label>
      <label>可信證據 reference<input value={evidence} maxLength={128} autoComplete="off"
        onChange={(e) => setEvidence(e.target.value)} /></label>
      <label>已載入的下一 key version（不輸入 secret）<input value={nextVersion} maxLength={128}
        onChange={(e) => setNextVersion(e.target.value)} /></label>
      <label><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />僅 dry-run</label>
    </fieldset>
    <button disabled={busy || inspected || !target || !reason} onClick={() => submit('inspect')}>第一步：檢視並稽核</button>
    <button disabled={busy || !inspected} onClick={() => submit('confirm')}>第二步：重新授權並手動確認</button>
    <button disabled={busy} onClick={() => { command.current = null; setInspected(false); setMessage('請明確輸入下一個操作。原操作不會自動重送。'); }}>明確建立下一個管理操作</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
