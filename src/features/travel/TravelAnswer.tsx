interface TravelAnswerProps {
  travelAnswer: {
    conclusion: string;
    action: string | string[];
    caution?: string[];
    phrase?: { japanese: string; pronunciation?: string; meaning?: string };
  };
}

export function TravelAnswer({ travelAnswer }: TravelAnswerProps) {
  const actionList = Array.isArray(travelAnswer.action)
    ? travelAnswer.action
    : typeof travelAnswer.action === 'string' && travelAnswer.action.trim().length > 0
      ? [travelAnswer.action]
      : [];
  const cautionList = Array.isArray(travelAnswer.caution) ? travelAnswer.caution : [];

  return (
    <article aria-live="polite" aria-labelledby="travel-answer-heading">
      <h3 id="travel-answer-heading">結論</h3>
      <p>{travelAnswer.conclusion}</p>

      <h3>怎麼做</h3>
      <ol>
        {actionList.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {cautionList.length > 0 && (
        <>
          <h3>注意事項</h3>
          <ul>
            {cautionList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {travelAnswer.phrase && (
        <>
          <h3>實用日文</h3>
          <p>{travelAnswer.phrase.japanese}</p>
          {travelAnswer.phrase.meaning && <p>{travelAnswer.phrase.meaning}</p>}
        </>
      )}
    </article>
  );
}
