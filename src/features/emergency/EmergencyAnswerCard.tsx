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
  return (
    <article aria-live="polite">
      <h3>緊急指引</h3>
      <section>
        <h4>現在先做</h4>
        <ul>
          {guide.immediateAction.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section>
        <h4>接著行動</h4>
        <ul>
          {guide.nextAction.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      {guide.phrase && guide.phrase.length > 0 && (
        <section>
          <h4>實用日文</h4>
          <ul>
            {guide.phrase.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}
      {guide.importantNotice && <p>{guide.importantNotice}</p>}
    </article>
  );
}
