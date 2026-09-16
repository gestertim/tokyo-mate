interface EmergencyGuide {
  immediateAction: string[];
  nextAction: string[];
  phrase?: string[];
  importantNotice?: string;
}

interface EmergencyAnswerCardProps {
  guide: EmergencyGuide;
}

export function EmergencyAnswerCard({ guide }: EmergencyAnswerCardProps) {
  const immediateActionList = Array.isArray(guide.immediateAction) ? guide.immediateAction : [];
  const nextActionList = Array.isArray(guide.nextAction) ? guide.nextAction : [];
  const phraseList = Array.isArray(guide.phrase) ? guide.phrase : [];

  return (
    <article aria-live="polite" aria-labelledby="emergency-answer-heading">
      <h3 id="emergency-answer-heading">緊急指引</h3>
      <section>
        <h4>現在先做</h4>
        <ul>
          {immediateActionList.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section>
        <h4>接著行動</h4>
        <ul>
          {nextActionList.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      {phraseList.length > 0 && (
        <section>
          <h4>實用日文</h4>
          <ul>
            {phraseList.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}
      {guide.importantNotice && <p>{guide.importantNotice}</p>}
    </article>
  );
}
