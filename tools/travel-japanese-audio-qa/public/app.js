const state = {
  phrases: [],
  results: new Map(),
  currentIndex: 0,
};

const elements = {
  sourceNote: document.querySelector('#source-note'),
  reviewedCount: document.querySelector('#reviewed-count'),
  passCount: document.querySelector('#pass-count'),
  failCount: document.querySelector('#fail-count'),
  pendingCount: document.querySelector('#pending-count'),
  completionMessage: document.querySelector('#completion-message'),
  phraseList: document.querySelector('#phrase-list'),
  warning: document.querySelector('#warning'),
  phraseId: document.querySelector('#phrase-id'),
  phraseStatus: document.querySelector('#phrase-status'),
  phraseCategory: document.querySelector('#phrase-category'),
  wavPath: document.querySelector('#wav-path'),
  japanese: document.querySelector('#japanese'),
  traditionalChinese: document.querySelector('#traditional-chinese'),
  audio: document.querySelector('#audio'),
  audioError: document.querySelector('#audio-error'),
  playPause: document.querySelector('#play-pause'),
  restart: document.querySelector('#restart'),
  pass: document.querySelector('#pass'),
  fail: document.querySelector('#fail'),
  note: document.querySelector('#note'),
  previous: document.querySelector('#previous'),
  next: document.querySelector('#next'),
  export: document.querySelector('#export'),
  saveStatus: document.querySelector('#save-status'),
};

function stopAudio() {
  elements.audio.pause();
  elements.audio.currentTime = 0;
  elements.playPause.textContent = '播放';
}

function getCurrentPhrase() {
  return state.phrases[state.currentIndex];
}

function getResult(id) {
  return state.results.get(id) ?? { id, status: 'PENDING', note: '', reviewedAt: '' };
}

function statusClass(status) {
  return status.toLowerCase();
}

function calculateStats() {
  const results = Array.from(state.results.values());
  return results.reduce(
    (stats, result) => {
      stats.total += 1;
      stats[result.status.toLowerCase()] += 1;
      if (result.status !== 'PENDING') {
        stats.reviewed += 1;
      }
      return stats;
    },
    { total: 0, reviewed: 0, pass: 0, fail: 0, pending: 0 },
  );
}

function renderStats() {
  const stats = calculateStats();
  elements.reviewedCount.textContent = `${stats.reviewed} / ${stats.total}`;
  elements.passCount.textContent = stats.pass;
  elements.failCount.textContent = stats.fail;
  elements.pendingCount.textContent = stats.pending;

  const complete = stats.total === 108 && stats.pass === 108 && stats.fail === 0 && stats.pending === 0;
  elements.completionMessage.textContent = complete ? '108 句人工聽檢完成' : '人工聽檢尚未完成';
  elements.completionMessage.className = `completion ${complete ? 'complete' : 'pending'}`;
}

function renderPhraseList() {
  elements.phraseList.replaceChildren(
    ...state.phrases.map((phrase, index) => {
      const result = getResult(phrase.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === state.currentIndex ? 'active' : '';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === state.currentIndex));
      button.innerHTML = `<span>${phrase.id}</span><span class="item-status ${statusClass(result.status)}">${result.status}</span>`;
      button.addEventListener('click', () => navigateTo(index));
      return button;
    }),
  );
}

function renderCurrentPhrase() {
  const phrase = getCurrentPhrase();
  if (!phrase) {
    return;
  }

  const result = getResult(phrase.id);
  elements.phraseId.textContent = phrase.id;
  elements.phraseStatus.textContent = result.status;
  elements.phraseStatus.className = `status-pill ${statusClass(result.status)}`;
  elements.phraseCategory.textContent = phrase.category;
  elements.wavPath.textContent = phrase.wavPath;
  elements.japanese.textContent = phrase.japanese;
  elements.traditionalChinese.textContent = phrase.traditionalChinese;
  elements.note.value = result.note;
  elements.audio.src = phrase.wavUrl;
  elements.audioError.hidden = true;
  elements.previous.disabled = state.currentIndex === 0;
  elements.next.disabled = state.currentIndex === state.phrases.length - 1;
  renderPhraseList();
}

function renderAll() {
  renderStats();
  renderCurrentPhrase();
}

function navigateTo(index) {
  if (index < 0 || index >= state.phrases.length || index === state.currentIndex) {
    return;
  }

  stopAudio();
  state.currentIndex = index;
  renderCurrentPhrase();
}

async function saveCurrent(status) {
  const phrase = getCurrentPhrase();
  elements.saveStatus.textContent = '儲存中...';

  const response = await fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: phrase.id, status, note: elements.note.value }),
  });

  if (!response.ok) {
    elements.saveStatus.textContent = '儲存失敗';
    return;
  }

  const payload = await response.json();
  state.results = new Map(payload.results.map((result) => [result.id, result]));
  elements.saveStatus.textContent = `已儲存 ${phrase.id}`;
  renderAll();
}

async function exportResults() {
  elements.saveStatus.textContent = '匯出中...';
  const response = await fetch('/api/export', { method: 'POST' });
  if (!response.ok) {
    elements.saveStatus.textContent = '匯出失敗';
    return;
  }

  const payload = await response.json();
  elements.saveStatus.textContent = `已更新 ${payload.resultPath} 與 ${payload.summaryPath}`;
}

async function togglePlayback() {
  if (elements.audio.paused) {
    try {
      await elements.audio.play();
      elements.playPause.textContent = '暫停';
    } catch {
      elements.audioError.hidden = false;
    }
  } else {
    elements.audio.pause();
    elements.playPause.textContent = '播放';
  }
}

function restartPlayback() {
  elements.audio.currentTime = 0;
  elements.audio.play()
    .then(() => {
      elements.playPause.textContent = '暫停';
    })
    .catch(() => {
      elements.audioError.hidden = false;
    });
}

async function loadState() {
  const response = await fetch('/api/state');
  const payload = await response.json();
  state.phrases = payload.phrases;
  state.results = new Map(payload.results.map((result) => [result.id, result]));
  elements.sourceNote.textContent = `Dataset 108 phrases / Results: ${payload.source}`;
  if (payload.warning) {
    elements.warning.hidden = false;
    elements.warning.textContent = payload.warning;
  }
  renderAll();
}

elements.playPause.addEventListener('click', togglePlayback);
elements.restart.addEventListener('click', restartPlayback);
elements.pass.addEventListener('click', () => saveCurrent('PASS'));
elements.fail.addEventListener('click', () => saveCurrent('FAIL'));
elements.previous.addEventListener('click', () => navigateTo(state.currentIndex - 1));
elements.next.addEventListener('click', () => navigateTo(state.currentIndex + 1));
elements.export.addEventListener('click', exportResults);
elements.audio.addEventListener('ended', () => {
  elements.playPause.textContent = '播放';
});
elements.audio.addEventListener('error', () => {
  elements.audioError.hidden = false;
});

document.addEventListener('keydown', (event) => {
  if (event.target === elements.note) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    togglePlayback();
  } else if (event.key.toLowerCase() === 'p') {
    saveCurrent('PASS');
  } else if (event.key.toLowerCase() === 'f') {
    saveCurrent('FAIL');
  } else if (event.key === 'ArrowLeft') {
    navigateTo(state.currentIndex - 1);
  } else if (event.key === 'ArrowRight') {
    navigateTo(state.currentIndex + 1);
  }
});

loadState();