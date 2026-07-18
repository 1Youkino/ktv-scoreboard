const STORAGE_KEY = "ktv-scoreboard-v1";

const state = loadState();
let editingEntryId = null;
let pendingAction = null;
let toastTimer = null;

const elements = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  playerForm: document.querySelector("#playerForm"),
  playerName: document.querySelector("#playerName"),
  playerChips: document.querySelector("#playerChips"),
  playerCount: document.querySelector("#playerCount"),
  singerCountLabel: document.querySelector("#singerCountLabel"),
  scoreForm: document.querySelector("#scoreForm"),
  scoreFormTitle: document.querySelector("#scoreFormTitle"),
  scorePlayer: document.querySelector("#scorePlayer"),
  songName: document.querySelector("#songName"),
  scoreValue: document.querySelector("#scoreValue"),
  submitScoreButton: document.querySelector("#submitScoreButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  historyEmpty: document.querySelector("#historyEmpty"),
  scoreList: document.querySelector("#scoreList"),
  entryCountLabel: document.querySelector("#entryCountLabel"),
  rankingEmpty: document.querySelector("#rankingEmpty"),
  rankingList: document.querySelector("#rankingList"),
  summaryPlayers: document.querySelector("#summaryPlayers"),
  summarySongs: document.querySelector("#summarySongs"),
  summaryAverage: document.querySelector("#summaryAverage"),
  shareButton: document.querySelector("#shareButton"),
  resetButton: document.querySelector("#resetButton"),
  toast: document.querySelector("#toast"),
  confirmDialog: document.querySelector("#confirmDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMessage: document.querySelector("#dialogMessage"),
  dialogConfirmButton: document.querySelector("#dialogConfirmButton"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.players) && Array.isArray(saved?.entries)) {
      return saved;
    }
  } catch (error) {
    console.warn("无法读取本地计分数据", error);
  }
  return { players: [], entries: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
}

function switchView(viewName) {
  elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewName));
  elements.views.forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}View`));
  if (viewName === "ranking") renderRanking();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPlayers() {
  const previousSelection = elements.scorePlayer.value;
  elements.playerCount.textContent = state.players.length;
  elements.singerCountLabel.textContent = `${state.players.length} 人`;

  elements.playerChips.innerHTML = state.players
    .map(
      (player) => `
        <span class="player-chip">
          ${escapeHtml(player.name)}
          <button type="button" data-remove-player="${player.id}" title="删除 ${escapeHtml(player.name)}" aria-label="删除 ${escapeHtml(player.name)}">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>
          </button>
        </span>`,
    )
    .join("");

  if (state.players.length === 0) {
    elements.scorePlayer.innerHTML = '<option value="">先添加歌手</option>';
    elements.scorePlayer.disabled = true;
    elements.submitScoreButton.disabled = true;
  } else {
    elements.scorePlayer.innerHTML = state.players
      .map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`)
      .join("");
    elements.scorePlayer.disabled = false;
    elements.submitScoreButton.disabled = false;
    elements.scorePlayer.value = state.players.some((player) => player.id === previousSelection)
      ? previousSelection
      : state.players[0].id;
  }
}

function renderEntries() {
  const entries = [...state.entries].sort((a, b) => b.createdAt - a.createdAt);
  elements.entryCountLabel.textContent = `${entries.length} 首`;
  elements.historyEmpty.classList.toggle("is-hidden", entries.length > 0);
  elements.scoreList.classList.toggle("is-hidden", entries.length === 0);
  elements.scoreList.innerHTML = entries
    .map((entry) => {
      const player = state.players.find((item) => item.id === entry.playerId);
      if (!player) return "";
      return `
        <article class="score-entry">
          <div>
            <p class="entry-song">${escapeHtml(entry.song)}</p>
            <p class="entry-player">${escapeHtml(player.name)}</p>
          </div>
          <div class="entry-score">${formatScore(entry.score)}<small>分</small></div>
          <div class="entry-actions">
            <button type="button" data-edit-entry="${entry.id}" title="修改成绩" aria-label="修改 ${escapeHtml(entry.song)} 的成绩">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
            </button>
            <button type="button" data-remove-entry="${entry.id}" title="删除成绩" aria-label="删除 ${escapeHtml(entry.song)} 的成绩">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg>
            </button>
          </div>
        </article>`;
    })
    .join("");
}

function getRanking() {
  const ranking = state.players
    .map((player) => {
      const scores = state.entries.filter((entry) => entry.playerId === player.id).map((entry) => entry.score);
      const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
      return { ...player, count: scores.length, average };
    })
    .filter((player) => player.count > 0)
    .sort((a, b) => b.average - a.average || b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));

  let lastAverage = null;
  let lastRank = 0;
  return ranking.map((player, index) => {
    if (lastAverage === null || Math.abs(player.average - lastAverage) > 0.0001) lastRank = index + 1;
    lastAverage = player.average;
    return { ...player, rank: lastRank };
  });
}

function renderRanking() {
  const ranking = getRanking();
  const allScores = state.entries.map((entry) => entry.score);
  const overallAverage = allScores.length
    ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
    : null;

  elements.summaryPlayers.textContent = state.players.length;
  elements.summarySongs.textContent = state.entries.length;
  elements.summaryAverage.textContent = overallAverage === null ? "—" : formatScore(Math.round(overallAverage * 10) / 10);
  elements.rankingEmpty.classList.toggle("is-hidden", ranking.length > 0);
  elements.rankingList.classList.toggle("is-hidden", ranking.length === 0);
  elements.rankingList.innerHTML = ranking
    .map(
      (player) => `
        <li class="rank-row">
          <span class="rank-number">${player.rank}</span>
          <div>
            <p class="rank-name">${escapeHtml(player.name)}</p>
            <p class="rank-meta">已唱 ${player.count} 首</p>
          </div>
          <div class="rank-average">
            <strong>${formatScore(Math.round(player.average * 10) / 10)}</strong>
            <span>平均分</span>
          </div>
        </li>`,
    )
    .join("");
}

function renderAll() {
  renderPlayers();
  renderEntries();
  renderRanking();
}

function resetScoreForm() {
  editingEntryId = null;
  elements.scoreForm.reset();
  elements.scoreFormTitle.textContent = "录入成绩";
  elements.submitScoreButton.lastChild.textContent = " 保存成绩";
  elements.cancelEditButton.classList.add("is-hidden");
  if (state.players.length) elements.scorePlayer.value = state.players[0].id;
}

function editEntry(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  editingEntryId = entryId;
  elements.scorePlayer.value = entry.playerId;
  elements.songName.value = entry.song;
  elements.scoreValue.value = entry.score;
  elements.scoreFormTitle.textContent = "修改成绩";
  elements.submitScoreButton.lastChild.textContent = " 更新成绩";
  elements.cancelEditButton.classList.remove("is-hidden");
  document.querySelector(".score-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  elements.songName.focus({ preventScroll: true });
}

function openConfirm({ title, message, confirmText = "确认删除", action }) {
  pendingAction = action;
  elements.dialogTitle.textContent = title;
  elements.dialogMessage.textContent = message;
  elements.dialogConfirmButton.textContent = confirmText;
  elements.confirmDialog.showModal();
}

function buildShareText() {
  const ranking = getRanking();
  if (!ranking.length) return "";
  const lines = ranking.map(
    (player) => `${player.rank}. ${player.name}  ${formatScore(Math.round(player.average * 10) / 10)}分（${player.count}首）`,
  );
  return ["K歌排名", "", ...lines].join("\n");
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));

elements.playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.playerName.value.trim();
  if (!name) return;
  if (state.players.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    showToast("这个名字已经添加过了");
    return;
  }
  const player = { id: makeId(), name };
  state.players.push(player);
  saveState();
  renderAll();
  elements.scorePlayer.value = player.id;
  elements.playerForm.reset();
  showToast(`已添加 ${name}`);
});

elements.playerChips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-player]");
  if (!button) return;
  const player = state.players.find((item) => item.id === button.dataset.removePlayer);
  if (!player) return;
  const scoreCount = state.entries.filter((entry) => entry.playerId === player.id).length;
  const message = scoreCount
    ? `“${player.name}”的 ${scoreCount} 条成绩也会一起删除。`
    : `“${player.name}”将从歌手列表中删除。`;
  openConfirm({
    title: `删除 ${player.name}？`,
    message,
    action: () => {
      state.players = state.players.filter((item) => item.id !== player.id);
      state.entries = state.entries.filter((entry) => entry.playerId !== player.id);
      if (editingEntryId && !state.entries.some((entry) => entry.id === editingEntryId)) resetScoreForm();
      saveState();
      renderAll();
      showToast("歌手已删除");
    },
  });
});

elements.scoreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const playerId = elements.scorePlayer.value;
  const song = elements.songName.value.trim();
  const score = Number(elements.scoreValue.value);
  if (!state.players.some((player) => player.id === playerId)) {
    showToast("请先选择歌手");
    return;
  }
  if (!song) return;
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    showToast("分数需在 0 到 100 之间");
    elements.scoreValue.focus();
    return;
  }

  if (editingEntryId) {
    const entry = state.entries.find((item) => item.id === editingEntryId);
    if (entry) Object.assign(entry, { playerId, song, score });
    showToast("成绩已更新");
  } else {
    state.entries.push({ id: makeId(), playerId, song, score, createdAt: Date.now() });
    showToast("成绩已保存");
  }
  saveState();
  resetScoreForm();
  renderAll();
  elements.songName.focus();
});

elements.cancelEditButton.addEventListener("click", resetScoreForm);

elements.scoreList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-entry]");
  if (editButton) {
    editEntry(editButton.dataset.editEntry);
    return;
  }
  const removeButton = event.target.closest("[data-remove-entry]");
  if (!removeButton) return;
  const entry = state.entries.find((item) => item.id === removeButton.dataset.removeEntry);
  if (!entry) return;
  openConfirm({
    title: "删除这条成绩？",
    message: `“${entry.song}”的 ${formatScore(entry.score)} 分将被删除。`,
    action: () => {
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      if (editingEntryId === entry.id) resetScoreForm();
      saveState();
      renderAll();
      showToast("成绩已删除");
    },
  });
});

elements.resetButton.addEventListener("click", () => {
  if (!state.players.length && !state.entries.length) {
    showToast("目前没有可清空的数据");
    return;
  }
  openConfirm({
    title: "清空全部数据？",
    message: "全部歌手和成绩都会被删除，此操作无法撤销。",
    confirmText: "全部清空",
    action: () => {
      state.players = [];
      state.entries = [];
      resetScoreForm();
      saveState();
      renderAll();
      switchView("scoring");
      showToast("数据已清空");
    },
  });
});

elements.confirmDialog.addEventListener("close", () => {
  if (elements.confirmDialog.returnValue === "confirm" && pendingAction) pendingAction();
  pendingAction = null;
});

elements.shareButton.addEventListener("click", async () => {
  const text = buildShareText();
  if (!text) {
    showToast("还没有可分享的排名");
    return;
  }
  try {
    if (navigator.share) {
      await navigator.share({ title: "K歌排名", text });
    } else {
      await navigator.clipboard.writeText(text);
      showToast("排名已复制");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("分享失败，请稍后重试");
  }
});

renderAll();
