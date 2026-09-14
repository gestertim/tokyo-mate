interface EditableTranscriptProps { value: string; onChange: (value: string) => void; onSubmit: () => void; }
export function EditableTranscript({ value, onChange, onSubmit }: EditableTranscriptProps) {
  return <div><label>辨識文字<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label><button type="button" onClick={onSubmit}>確認翻譯</button></div>;
}