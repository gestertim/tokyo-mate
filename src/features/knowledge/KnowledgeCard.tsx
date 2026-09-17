import { useState } from 'react';
import { AudioPlayer } from '../../components/AudioPlayer';
import type { KnowledgeEntry } from '../../types/knowledge';

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
}

type CopyStatus = 'idle' | 'success' | 'error';

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function nonEmptyItems(items: string[] | undefined): string[] {
  return Array.isArray(items) ? items.filter((item) => item.trim().length > 0) : [];
}

function nonEmptyText(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function ListSection({ title, items }: { title: string; items: string[] | undefined }) {
  const visibleItems = nonEmptyItems(items);
  if (visibleItems.length === 0) return null;

  return (
    <section className="knowledge-card-section">
      <h4>{title}</h4>
      <ul>
        {visibleItems.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function TextSection({ title, value }: { title: string; value: string | undefined }) {
  const text = nonEmptyText(value);
  if (!text) return null;

  return (
    <section className="knowledge-card-section">
      <h4>{title}</h4>
      <p>{text}</p>
    </section>
  );
}

export function KnowledgeCard({ entry }: KnowledgeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const detailsId = `knowledge-card-details-${safeId(entry.id)}`;
  const practicalJapanese = Array.isArray(entry.content.practicalJapanese)
    ? entry.content.practicalJapanese.filter((phrase) => phrase.japanese.trim().length > 0 && phrase.meaning.trim().length > 0)
    : [];

  async function copyJapanese(japanese: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(japanese);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <article className="knowledge-card">
      <div className="knowledge-card-header">
        <div>
          <h3>{entry.title}</h3>
          <p>{entry.summary}</p>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {entry.title}{isExpanded ? ' 收合' : ' 展開'}
        </button>
      </div>

      <div id={detailsId} className="knowledge-card-details" hidden={!isExpanded}>
        {isExpanded && (
          <>
            <ListSection title="適合對象" items={entry.content.recommendedFor} />
            <ListSection title="亮點" items={entry.content.highlights} />
            <ListSection title="怎麼逛" items={entry.content.howToExplore} />
            <ListSection title="必吃必買" items={entry.content.mustTryOrBuy} />
            <ListSection title="交通提示" items={entry.content.transportTips} />
            <TextSection title="建議停留時間" value={entry.content.stayDuration} />
            <TextSection title="日夜差異" value={entry.content.dayNightDifference} />
            <ListSection title="注意事項" items={entry.content.importantNotes} />
            {practicalJapanese.length > 0 && (
              <section className="knowledge-card-section knowledge-card-japanese">
                <h4>實用日文</h4>
                <ul>
                  {practicalJapanese.map((phrase) => (
                    <li key={phrase.japanese}>
                      <p lang="ja">{phrase.japanese}</p>
                      <p>{phrase.meaning}</p>
                      <div className="knowledge-card-japanese-actions">
                        <button type="button" onClick={() => void copyJapanese(phrase.japanese)}>
                          複製 {phrase.japanese}
                        </button>
                        <AudioPlayer text={phrase.japanese} language="ja" />
                      </div>
                    </li>
                  ))}
                </ul>
                {copyStatus !== 'idle' && (
                  <p role="status" aria-live="polite">
                    {copyStatus === 'success' ? '已複製實用日文。' : '無法複製，請手動選取日文。'}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </article>
  );
}