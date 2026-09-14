interface TravelAnswerProps {
  travelAnswer: {
    conclusion: string;
    action: string | string[];
    caution?: string[];
    phrase?: { japanese: string; pronunciation?: string; meaning?: string };
  };
}

export function TravelAnswer({ travelAnswer }: TravelAnswerProps) {
  const actionList = Array.isArray(travelAnswer.action) ? travelAnswer.action : [travelAnswer.action];

  return (
    <article aria-live="polite">
      <h3>結論</h3>
      <p>{travelAnswer.conclusion}</p>

      <h3>怎麼做</h3>
      <ol>
        {actionList.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {travelAnswer.caution && travelAnswer.caution.length > 0 && (
        <>
          <h3>注意事項</h3>
          <ul>
            {travelAnswer.caution.map((item) => (
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
