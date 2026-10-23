"use strict";

const STORAGE_KEY = "quizArenaQuiz_v1";
const ADMIN_CODE = "0210-Youtube-pikagori-yukke"; // GitHub Pages上ではコードを完全に秘密にできません。
const DEFAULT_QUIZ = {
  title: "サンプルクイズ",
  joinCode: "QUIZ2026",
  questions: [{
    text: "日本の首都はどこ？",
    image: "",
    options: ["大阪", "札幌", "東京", "京都"],
    correct: 2,
    seconds: 20
  }]
};

let quiz = loadQuiz();
let playerName = "";
let isAdmin = false;
let currentQuestionIndex = 0;
let score = 0;
let correctCount = 0;
let answersLog = [];
let answered = false;
let timerId = null;
let timeLeft = 20;

const $ = (selector) => document.querySelector(selector);

function loadQuiz() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredCloneSafe(DEFAULT_QUIZ);
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.questions)) return structuredCloneSafe(DEFAULT_QUIZ);
    if (typeof parsed.joinCode !== "string") parsed.joinCode = "QUIZ2026";
    return parsed;
  } catch {
    return structuredCloneSafe(DEFAULT_QUIZ);
  }
}
function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2400);
}
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  const target = $(`#${name}-screen`);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderHome() {
  $("#welcome-name").textContent = playerName || "ゲスト";
  $("#home-quiz-title").textContent = quiz.title || "クイズに挑戦しよう！";
  $("#question-count").textContent = quiz.questions.length;
  $("#home-join-code").textContent = quiz.joinCode || "未設定";
  $("#home-message").textContent = quiz.questions.length ? "準備ができたらスタート！" : "管理者が問題を作成するまでお待ちください。";
}
function requireAdmin() {
  if (isAdmin) return true;
  showToast("クイズの作成・編集は管理者のみ利用できます。");
  showScreen("home");
  return false;
}
function renderEditor() {
  if (!requireAdmin()) return;
  $("#quiz-title").value = quiz.title || "";
  $("#creator-join-code").value = quiz.joinCode || "";
  const list = $("#question-list");
  list.innerHTML = "";
  quiz.questions.forEach((question, index) => {
    const card = document.createElement("article");
    card.className = "question-editor";
    card.innerHTML = `
      <div class="question-editor-header">
        <h3>問題 ${index + 1}</h3>
        <button class="delete-question" type="button" data-delete="${index}">削除</button>
      </div>
      <label>問題文</label>
      <textarea rows="2" data-field="text" data-index="${index}" placeholder="問題文を入力">${escapeHTML(question.text)}</textarea>
      <label>画像URL（任意）</label>
      <input type="url" data-field="image" data-index="${index}" value="${escapeHTML(question.image || "")}" placeholder="https://example.com/image.jpg">
      <div class="editor-grid">
        ${[0,1,2,3].map((optionIndex) => `
          <div>
            <label>選択肢 ${optionIndex + 1}</label>
            <div class="option-field">
              <input type="radio" name="correct-${index}" data-correct="${index}" value="${optionIndex}" ${Number(question.correct) === optionIndex ? "checked" : ""} aria-label="選択肢 ${optionIndex + 1} を正解にする">
              <input type="text" data-option="${optionIndex}" data-index="${index}" value="${escapeHTML((question.options || [])[optionIndex] || "")}" placeholder="選択肢 ${optionIndex + 1}">
            </div>
          </div>`).join("")}
      </div>
      <label>制限時間</label>
      <select data-field="seconds" data-index="${index}">
        ${[5,10,15,20,30,45,60,90].map((seconds) => `<option value="${seconds}" ${Number(question.seconds || 20) === seconds ? "selected" : ""}>${seconds} 秒</option>`).join("")}
      </select>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-field]").forEach((element) => {
    element.addEventListener("input", () => {
      const i = Number(element.dataset.index);
      const field = element.dataset.field;
      if (field === "seconds") quiz.questions[i][field] = Number(element.value);
      else quiz.questions[i][field] = element.value;
    });
    element.addEventListener("change", () => {
      const i = Number(element.dataset.index);
      const field = element.dataset.field;
      if (field === "seconds") quiz.questions[i][field] = Number(element.value);
      else quiz.questions[i][field] = element.value;
    });
  });
  list.querySelectorAll("[data-option]").forEach((element) => {
    element.addEventListener("input", () => {
      const i = Number(element.dataset.index);
      const optionIndex = Number(element.dataset.option);
      quiz.questions[i].options[optionIndex] = element.value;
    });
  });
  list.querySelectorAll("[data-correct]").forEach((element) => {
    element.addEventListener("change", () => {
      quiz.questions[Number(element.dataset.correct)].correct = Number(element.value);
    });
  });
  list.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      quiz.questions.splice(Number(button.dataset.delete), 1);
      renderEditor();
    });
  });
}
function addQuestion() {
  if (!requireAdmin()) return;
  quiz.questions.push({ text: "", image: "", options: ["", "", "", ""], correct: 0, seconds: 20 });
  renderEditor();
  const cards = document.querySelectorAll(".question-editor");
  cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
}
function saveQuiz() {
  if (!requireAdmin()) return false;
  quiz.title = $("#quiz-title").value.trim() || "タイトル未設定のクイズ";
  quiz.joinCode = $("#creator-join-code").value.trim();
  if (!quiz.joinCode) {
    showToast("参加コードを決めて入力してください。");
    $("#creator-join-code").focus();
    return false;
  }
  const cards = [...document.querySelectorAll(".question-editor")];
  cards.forEach((card, i) => {
    const text = card.querySelector('[data-field="text"]');
    const image = card.querySelector('[data-field="image"]');
    const seconds = card.querySelector('[data-field="seconds"]');
    if (!quiz.questions[i]) return;
    quiz.questions[i].text = text?.value ?? quiz.questions[i].text;
    quiz.questions[i].image = image?.value.trim() ?? quiz.questions[i].image;
    quiz.questions[i].seconds = Number(seconds?.value || 20);
    quiz.questions[i].options = [0,1,2,3].map((n) => card.querySelector(`[data-option="${n}"][data-index="${i}"]`)?.value ?? "");
    const checked = card.querySelector(`[data-correct="${i}"]:checked`);
    if (checked) quiz.questions[i].correct = Number(checked.value);
  });
  if (!quiz.questions.length) {
    showToast("問題を1問以上追加してください。");
    return false;
  }
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    if (!q.text.trim() || q.options.some((option) => !String(option).trim())) {
      showToast(`問題 ${i + 1} の問題文と4つの選択肢を入力してください。`);
      return false;
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quiz));
    renderHome();
    showToast("クイズを保存しました！");
    return true;
  } catch {
    showToast("保存できませんでした。ブラウザーの設定を確認してください。");
    return false;
  }
}
function startQuiz() {
  if (!quiz.questions.length) {
    showToast("クイズがありません。管理者に問題作成を依頼してください。");
    return;
  }
  if (isAdmin && $("#editor-screen").classList.contains("active")) {
    if (!saveQuiz()) return;
  }
  currentQuestionIndex = 0;
  score = 0;
  correctCount = 0;
  answersLog = [];
  showScreen("play");
  renderQuestion();
}
function renderQuestion() {
  clearInterval(timerId);
  answered = false;
  const question = quiz.questions[currentQuestionIndex];
  if (!question) return showResults();
  const total = quiz.questions.length;
  $("#play-question-number").textContent = `問題 ${currentQuestionIndex + 1} / ${total}`;
  $("#play-quiz-title").textContent = quiz.title;
  $("#play-question-title").textContent = question.text;
  $("#quiz-progress").style.width = `${(currentQuestionIndex / total) * 100}%`;
  const image = $("#question-image");
  if (question.image) {
    image.src = question.image;
    image.hidden = false;
    image.onerror = () => { image.hidden = true; };
  } else {
    image.removeAttribute("src");
    image.hidden = true;
  }
  $("#answer-feedback").textContent = "";
  $("#next-question").hidden = true;
  const answers = $("#play-answers");
  answers.innerHTML = "";
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-option";
    button.textContent = `${["A", "B", "C", "D"][index]}　${option}`;
    button.addEventListener("click", () => chooseAnswer(index));
    answers.appendChild(button);
  });
  timeLeft = Number(question.seconds) || 20;
  $("#quiz-timer").textContent = timeLeft;
  timerId = setInterval(() => {
    timeLeft -= 1;
    $("#quiz-timer").textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerId);
      chooseAnswer(-1);
    }
  }, 1000);
}
function chooseAnswer(selectedIndex) {
  if (answered) return;
  answered = true;
  clearInterval(timerId);
  const question = quiz.questions[currentQuestionIndex];
  const isCorrect = selectedIndex === Number(question.correct);
  if (isCorrect) {
    correctCount += 1;
    score += Math.max(100, timeLeft * 100);
  }
  answersLog.push({ question: question.text, selectedIndex, correctIndex: Number(question.correct), options: [...question.options], isCorrect });
  const buttons = [...$("#play-answers").querySelectorAll("button")];
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === Number(question.correct)) button.classList.add("correct");
    if (index === selectedIndex && !isCorrect) button.classList.add("incorrect");
  });
  $("#answer-feedback").textContent = selectedIndex === -1
    ? `時間切れ！ 正解は「${question.options[question.correct]}」`
    : isCorrect ? `正解！ +${Math.max(100, timeLeft * 100)} 点` : `不正解。正解は「${question.options[question.correct]}」`;
  $("#next-question").textContent = currentQuestionIndex === quiz.questions.length - 1 ? "結果を見る" : "次の問題へ";
  $("#next-question").hidden = false;
  $("#quiz-progress").style.width = `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`;
}
function showResults() {
  clearInterval(timerId);
  showScreen("results");
  const total = quiz.questions.length;
  const percentage = total ? Math.round((correctCount / total) * 100) : 0;
  $("#results-title").textContent = `${playerName || "プレイヤー"}さんの結果`;
  $("#final-score").textContent = `${score.toLocaleString()} 点`;
  $("#final-correct").textContent = `${correctCount} / ${total}`;
  $("#final-percentage").textContent = `${percentage}%`;
  const review = $("#answer-review");
  review.innerHTML = "";
  answersLog.forEach((answer, i) => {
    const item = document.createElement("article");
    item.className = `review-item ${answer.isCorrect ? "was-correct" : "was-wrong"}`;
    const selected = answer.selectedIndex < 0 ? "時間切れ" : answer.options[answer.selectedIndex];
    item.innerHTML = `<strong>${i + 1}. ${escapeHTML(answer.question)}</strong>
      <p>あなたの回答：${escapeHTML(selected)}</p>
      <p>正解：${escapeHTML(answer.options[answer.correctIndex])}</p>
      <p>${answer.isCorrect ? "✅ 正解" : "❌ 不正解"}</p>`;
    review.appendChild(item);
  });
}
function joinWithName(event) {
  event.preventDefault();
  const name = $("#player-name").value.trim();
  const joinCode = $("#join-code").value.trim();
  const adminCode = $("#admin-code").value.trim();

  if (!name) {
    showToast("ニックネームを入力してください。");
    $("#player-name").focus();
    return;
  }

  playerName = name;
  isAdmin = adminCode === ADMIN_CODE;

  if (isAdmin) {
    $("#start-quiz").hidden = false;
    $("#edit-quiz").hidden = false;
    renderHome();
    showScreen("home");
    showToast("管理者としてログインしました。");
    return;
  }

  if (adminCode) showToast("管理者コードが違います。参加コードを確認してください。");

  if (!joinCode || joinCode !== (quiz.joinCode || "QUIZ2026")) {
    showToast("参加コードが違います。主催者に確認してください。");
    $("#join-code").focus();
    return;
  }

  $("#start-quiz").hidden = true;
  $("#edit-quiz").hidden = true;
  renderHome();
  showScreen("home");
}
function init() {
  $("#join-form").addEventListener("submit", joinWithName);
  $("#start-quiz").addEventListener("click", () => {
    if (!requireAdmin()) return;
    if (!quiz.questions.length) quiz.questions.push({ text: "", image: "", options: ["", "", "", ""], correct: 0, seconds: 20 });
    renderEditor();
    showScreen("editor");
  });
  $("#edit-quiz").addEventListener("click", () => { if (requireAdmin()) { renderEditor(); showScreen("editor"); } });
  $("#add-question").addEventListener("click", addQuestion);
  $("#save-quiz").addEventListener("click", () => { if (saveQuiz()) renderEditor(); });
  $("#play-quiz").addEventListener("click", startQuiz);
  $("#play-home-quiz").addEventListener("click", startQuiz);
  $("#editor-home").addEventListener("click", () => { renderHome(); showScreen("home"); });
  $("#next-question").addEventListener("click", () => {
    if (!answered) return;
    currentQuestionIndex += 1;
    if (currentQuestionIndex >= quiz.questions.length) showResults();
    else renderQuestion();
  });
  $("#restart-quiz").addEventListener("click", startQuiz);
  $("#back-home").addEventListener("click", () => { renderHome(); showScreen("home"); });
  $("#change-player").addEventListener("click", () => {
    $("#player-name").value = playerName;
    $("#admin-code").value = "";
    $("#join-code").value = "";
    showScreen("name");
  });
  renderHome();
  showScreen("name");
}
document.addEventListener("DOMContentLoaded", init);
