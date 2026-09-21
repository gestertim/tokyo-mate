interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <div className="travel-japanese-search-bar">
      <label htmlFor="travel-japanese-search-input">搜尋繁中或日文關鍵字</label>
      <input
        id="travel-japanese-search-input"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="例如：護照、トイレ"
      />
      {query.trim() === '' && <p className="travel-japanese-search-hint">輸入繁中或日文關鍵字以搜尋</p>}
    </div>
  );
}
