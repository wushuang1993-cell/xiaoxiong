const TODAY_STORAGE_KEY = "bear-app-v23-2026-06-21";
const ASSET_VERSION = "20260621-watercolor-2";
const today = new Date();
const TODAY_MONTH = today.getMonth() + 1;
const TODAY_DAY = today.getDate();
let authApi = null;

const state = {
  view: "bears",
  selectedDay: 21,
  selectedPerson: "闪闪鱼",
  currentUser: "闪闪鱼",
  auth: {
    ready: false,
    configured: false,
    user: null,
    email: "",
    message: "",
  },
  draw: null,
  drawUsed: false,
  drawRound: 0,
  pendingExchange: null,
  exchangeDraft: null,
  approvalOffer: null,
  editingRule: null,
  editingBear: null,
  editingMember: null,
  people: [
    { name: "闪闪鱼", mark: "闪", wishBear: "史迪奇", coins: 9, avatar: "fish", image: "assets/shanshanyu.png" },
    { name: "杰尼龟", mark: "杰", wishBear: "卢卡斯", coins: 8, avatar: "turtle", image: "assets/jienigui.png" },
  ],
  bears: [
    { name: "史迪奇", color: "#92cfff", image: "assets/stitch.png", active: true },
    { name: "拖拉机", color: "#9fd493", image: "assets/tractor.png", active: true },
    { name: "芭芭拉", color: "#ffc2d0", image: "assets/barbara.png", active: true },
    { name: "卢卡斯", color: "#e0a547", image: "assets/lucas.png", active: true },
    { name: "马里奥", color: "#c9935e", image: "assets/mario.png", active: true },
    { name: "爱丽丝", color: "#b5e2dd", image: "assets/alice.png", active: true },
  ],
  logs: {
    10: [{ type: "咖啡", person: "闪闪鱼", delta: 0 }],
    11: [{ type: "奶茶", person: "杰尼龟", delta: 0 }],
    14: [{ type: "咖啡", person: "闪闪鱼", delta: 0 }],
    17: [{ type: "做家务", person: "杰尼龟", detail: "洗衣服", delta: 1 }],
    19: [{ type: "价值家务", person: "闪闪鱼", detail: "设计封面图", delta: 3 }],
    20: [{ type: "扣分", person: "杰尼龟", detail: "未完成基础家务", delta: -1 }],
    21: [],
  },
  rules: {
    drink: [
      { label: "咖啡", value: "+0 金币" },
      { label: "奶茶", value: "+0 金币" },
    ],
    base: [
      { label: "做饭", value: "+1 金币" },
      { label: "洗衣服", value: "+1 金币" },
      { label: "倒垃圾", value: "+1 金币" },
    ],
    bonus: [
      { label: "帮对方设计封面图", value: "+3 金币" },
      { label: "帮对方提供工作建议", value: "+2 金币" },
      { label: "运动", value: "+1 金币" },
    ],
    penalty: [{ label: "未完成基础家务", value: "-1 金币" }],
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function saveToday() {
  localStorage.setItem(
    TODAY_STORAGE_KEY,
    JSON.stringify({
      draw: state.draw,
      drawUsed: state.drawUsed,
      drawRound: state.drawRound,
      pendingExchange: state.pendingExchange,
      currentUser: state.currentUser,
      people: state.people.map(({ name, mark, wishBear, coins, avatar, image }) => ({
        name,
        mark,
        wishBear,
        coins,
        avatar,
        image,
      })),
      bears: state.bears,
      rules: state.rules,
      logs: state.logs,
    }),
  );
}

function loadToday() {
  try {
    const saved = JSON.parse(localStorage.getItem(TODAY_STORAGE_KEY) || "null");
    if (!saved) return;
    state.draw = saved.draw || null;
    state.drawUsed = Boolean(saved.drawUsed && saved.draw);
    state.drawRound = saved.drawRound || 0;
    state.pendingExchange = saved.pendingExchange || null;
    state.currentUser = saved.currentUser || state.currentUser;
    state.logs = saved.logs || state.logs;
    if (Array.isArray(saved.bears) && saved.bears.length >= 2) {
      state.bears = saved.bears.map((bear) => ({ ...bear, active: bear.active !== false }));
    }
    if (saved.rules?.base && saved.rules?.bonus && saved.rules?.penalty) {
      state.rules = {
        drink: saved.rules.drink || state.rules.drink,
        base: saved.rules.base,
        bonus: saved.rules.bonus,
        penalty: saved.rules.penalty,
      };
    }
    if (Array.isArray(saved.people)) {
      saved.people.forEach((savedPerson) => {
        const person = personByName(savedPerson.name);
        if (!person) return;
        person.wishBear = savedPerson.wishBear || person.wishBear;
        person.coins = Number.isFinite(savedPerson.coins) ? savedPerson.coins : person.coins;
        person.image = savedPerson.image || person.image;
        person.avatar = savedPerson.avatar || person.avatar;
      });
    }
  } catch {
    localStorage.removeItem(TODAY_STORAGE_KEY);
  }
}

function personByName(name) {
  return state.people.find((person) => person.name === name);
}

function otherPerson(name) {
  return state.people.find((person) => person.name !== name);
}

function bearByName(name) {
  return state.bears.find((bear) => bear.name === name);
}

function activeBears() {
  const active = state.bears.filter((bear) => bear.active !== false).slice(0, 6);
  return active.length ? active : state.bears.slice(0, 1);
}

function runDraw(seedText) {
  const random = seededRandom(hashString(seedText));
  const first = state.people[0];
  const second = state.people[1];
  const remaining = activeBears().map((bear) => bear.name);
  const firstBears = [];
  const firstTarget = Math.ceil(remaining.length / 2);

  while (firstBears.length < firstTarget && remaining.length) {
    const weighted = remaining.map((bearName) => {
      let weight = 1;
      if (first.wishBear !== second.wishBear && bearName === first.wishBear) weight = 1.25;
      if (first.wishBear !== second.wishBear && bearName === second.wishBear) weight = 0.75;
      return { bearName, weight };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * total;
    let picked = weighted[0].bearName;
    for (const item of weighted) {
      cursor -= item.weight;
      if (cursor <= 0) {
        picked = item.bearName;
        break;
      }
    }
    firstBears.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }

  return {
    seed: seedText,
    checksum: hashString(`${seedText}:${firstBears.join("|")}:${remaining.join("|")}`)
      .toString(16)
      .toUpperCase()
      .slice(0, 8),
    assignments: {
      [first.name]: firstBears,
      [second.name]: remaining,
    },
  };
}

function drawInitial() {
  if (state.drawUsed) {
    showToast("今天已经抽过签");
    return;
  }
  state.drawRound = 1;
  state.draw = runDraw("bear-2026-06-21-free");
  state.drawUsed = true;
  saveToday();
  renderAll();
  announceWishHit("今日小熊已抽签");
}

function paidRedraw(personName) {
  const person = personByName(personName);
  if (!state.drawUsed) {
    showToast("先完成今天的抽签");
    return;
  }
  if (person.coins < 3) {
    showToast(`${person.name}金币不够`);
    return;
  }
  state.drawRound += 1;
  state.draw = runDraw(`bear-2026-06-21-paid-${state.drawRound}`);
  addLog(21, { type: "重新抽签", person: person.name, detail: "小熊摇奖", delta: -3 });
  saveToday();
  renderAll();
  announceWishHit(`${person.name}已重新抽签`);
}

function applyApprovedExchange() {
  const pending = state.pendingExchange;
  if (!pending || !state.draw || !pending.offerBear) return;
  const applicant = personByName(pending.applicant);
  const approver = otherPerson(pending.applicant);
  const mine = state.draw.assignments[applicant.name];
  const theirs = state.draw.assignments[approver.name];
  const targetIndex = theirs.indexOf(pending.targetBear);
  const offerIndex = mine.indexOf(pending.offerBear);
  if (targetIndex < 0 || offerIndex < 0) return;
  const outgoing = mine[offerIndex];
  mine[offerIndex] = pending.targetBear;
  theirs[targetIndex] = outgoing;
  addLog(21, {
    type: "兑换小熊",
    person: applicant.name,
    detail: `用${pending.offerBear}换${pending.targetBear}`,
    delta: -2,
  });
  state.pendingExchange = null;
  saveToday();
  renderAll();
  showToast(`${approver.name}已同意兑换`);
}

function addLog(day, log) {
  if (!state.logs[day]) state.logs[day] = [];
  state.logs[day].push(log);
  const person = personByName(log.person);
  if (person && log.delta) person.coins += log.delta;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1700);
}

function formatTodayDate() {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${today.getFullYear()}年${TODAY_MONTH}月${TODAY_DAY}日 | ${weekdays[today.getDay()]}`;
}

function wishWinners() {
  if (!state.draw?.assignments) return [];
  return state.people.filter((person) => {
    const assigned = state.draw.assignments[person.name] || [];
    return assigned.includes(person.wishBear);
  });
}

function announceWishHit(fallbackMessage) {
  const winners = wishWinners();
  if (!winners.length) {
    showToast(fallbackMessage);
    return;
  }
  const names = winners.map((person) => `${person.name}抽到${person.wishBear}`).join("，");
  showWishCelebration(names);
}

function showWishCelebration(message) {
  const layer = $("#wishCelebration");
  $("#celebrationText").textContent = message;
  layer.classList.remove("hidden");
  layer.classList.remove("play");
  requestAnimationFrame(() => layer.classList.add("play"));
  clearTimeout(showWishCelebration.timer);
  showWishCelebration.timer = setTimeout(() => {
    layer.classList.add("hidden");
    layer.classList.remove("play");
  }, 2600);
}

function miniBear(name) {
  const bear = bearByName(name) || state.bears[0];
  return `
    <span class="mini-bear image-badge" style="--badge-color:${bear.color}">
      <img src="${assetUrl(bear.image)}" alt="${bear.name}" loading="lazy" />
    </span>
  `;
}

function bearChip(name) {
  const bear = bearByName(name) || state.bears[0];
  return `
    <div class="bear-chip">
      <span class="bear-dot image-dot" style="--badge-color:${bear.color}">
        <img src="${assetUrl(bear.image)}" alt="${bear.name}" loading="lazy" />
      </span>
      <span>${name}</span>
    </div>
  `;
}

function personAvatar(person, size = "") {
  return `
    <span class="avatar ${person.avatar === "turtle" ? "turtle" : ""} ${size}">
      <img src="${assetUrl(person.image)}" alt="${person.name}" loading="lazy" />
    </span>
  `;
}

function assetUrl(path) {
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${path}?v=${ASSET_VERSION}`;
}

function renderScreens() {
  $$(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === `screen-${state.view}`);
  });
  $$(".bottom-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.view);
  });
}

function renderCurrentUser() {
  const current = personByName(state.currentUser);
  const pill = $("#currentUserPill");
  if (!current || !pill) return;
  pill.innerHTML = `
    ${personAvatar(current)}
    <span>${current.name}</span>
    <small>${state.auth.user ? "已登录" : "本地"}</small>
  `;
}

function renderBearScreen() {
  $("#todayDateLine").textContent = formatTodayDate();
  $("#drawStatus").textContent = state.drawUsed ? "今日已抽签" : "今日未抽签";
  renderCurrentUser();
  renderHeroBear();

  $("#drawColumns").innerHTML = state.people.map(drawPersonCard).join("");
  $("#drawAction").innerHTML = state.drawUsed
    ? ""
    : `<button class="primary-button" id="startDraw" type="button">开始抽签</button>`;
  renderPending();
}

function renderHeroBear() {
  const pool = activeBears();
  const index = hashString("hero-bear-2026-06-21") % pool.length;
  const bear = pool[index];
  const image = $("#heroBear");
  if (!image) return;
  image.src = assetUrl(bear.image);
  image.alt = `今日背景小熊：${bear.name}`;
}

function drawPersonCard(person) {
  const assigned = state.draw?.assignments[person.name] || [];
  const tone = person.name === "闪闪鱼" ? "fish" : "turtle";
  return `
    <article class="draw-person ${tone}">
      <div class="person-head vertical">
        ${personAvatar(person, "large")}
        <small>${person.coins} 金币</small>
      </div>
      <div class="bear-stack">
        ${
          assigned.length
            ? assigned.map(bearChip).join("")
            : `<div class="empty-chip">未分配</div><div class="empty-chip">未分配</div><div class="empty-chip">未分配</div>`
        }
      </div>
      ${
        assigned.length
          ? `<div class="person-actions">
              <button class="cost-button redraw ${tone}" data-redraw-person="${person.name}" type="button">重抽</button>
              <button class="cost-button exchange ${tone}" data-exchange-person="${person.name}" type="button">兑换</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderPending() {
  const card = $("#pendingCard");
  if (!state.pendingExchange) {
    card.classList.add("hidden");
    card.innerHTML = "";
    return;
  }
  const pending = state.pendingExchange;
  const approver = otherPerson(pending.applicant);
  const applicant = personByName(pending.applicant);
  const bear = bearByName(pending.targetBear);
  const canApprove = state.currentUser === approver.name;
  card.classList.remove("hidden");
  card.innerHTML = `
    <div class="pending-main">
      <span class="pending-icon" style="--badge-color:${bear.color}">
        <img src="${assetUrl(bear.image)}" alt="${bear.name}" loading="lazy" />
      </span>
      <div class="pending-copy">
        <strong>申请兑换${pending.targetBear}</strong>
        <small>${applicant.name}发起 · ${approver.name}选择交换小熊</small>
      </div>
    </div>
    ${
      canApprove
        ? `<button class="pending-approve" id="approveExchange" type="button">同意</button>`
        : `<button class="pending-approve muted" disabled type="button">等待</button>`
    }
  `;
}

function renderCalendar() {
  $("#calendarTitle").textContent = `${TODAY_MONTH}月${TODAY_DAY}日`;
  $("#calendarPersonSwitch").innerHTML = state.people
    .map(
      (person) => `
        <button class="${person.name === state.selectedPerson ? "active" : ""}" data-calendar-person="${person.name}" type="button">
          <strong>${person.name}</strong>
          <small>${person.coins} 金币</small>
        </button>
      `,
    )
    .join("");

  $("#quickActions").innerHTML = renderActionSections();

  const selectedLogs = (state.logs[TODAY_DAY] || []).filter((log) => log.person === state.selectedPerson);
  $("#dayLog").innerHTML = renderTodayWorkSummary(selectedLogs);
}

function renderStats() {
  const leading = 1;
  const days = [];
  for (let i = 0; i < leading; i += 1) days.push(`<div class="day-cell empty"></div>`);
  for (let day = 1; day <= 30; day += 1) {
    const logs = state.logs[day] || [];
    const dots = logs
      .slice(0, 3)
      .map((log) => `<span class="tag-dot ${tagClass(log.type)}"></span>`)
      .join("");
    days.push(`
      <button class="day-cell ${day === state.selectedDay ? "active" : ""}" data-day="${day}" type="button">
        ${day}
        <span class="day-tags">${dots}</span>
      </button>
    `);
  }
  $("#monthGrid").innerHTML = days.join("");
  renderSelectedDayLedger();
}

function renderSelectedDayLedger() {
  const selectedLogs = state.logs[state.selectedDay] || [];
  const total = selectedLogs.reduce((sum, log) => sum + Number(log.delta || 0), 0);
  $("#selectedDayLedger").innerHTML = `
    <div class="history-head">
      <div>
        <p class="date-line">${TODAY_MONTH}月${state.selectedDay}日</p>
        <h2>当天积分</h2>
      </div>
      <span>${total > 0 ? "+" : ""}${total}</span>
    </div>
    ${state.people.map((person) => dayPersonHistory(person, selectedLogs)).join("")}
  `;
}

function renderActionSections() {
  const groups = [
    ["家务", "base"],
    ["增值家务", "bonus"],
    ["扣分", "penalty"],
    ["饮品", "drink"],
  ];
  return groups
    .map(([title, group]) => {
      const items = state.rules[group] || [];
      if (!items.length) return "";
      return `
        <section class="action-section ${group}">
          <h3>${title}</h3>
          <div class="action-grid">
            ${items
              .map((item) => {
                const delta = ruleAmount(item);
                return `
                  <button class="action-tile ${delta < 0 ? "penalty" : ""}" data-log-type="${title}" data-log-detail="${item.label}" data-log-delta="${delta}" type="button">
                    ${item.label}
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function dayPersonHistory(person, logs) {
  const personLogs = logs.filter((log) => log.person === person.name);
  const rows = personLogs.map((log) => ({ ...log, day: state.selectedDay }));
  const net = rows.reduce((sum, log) => sum + Number(log.delta || 0), 0);
  return `
    <section class="person-history">
      <div class="person-ledger-head">
        ${personAvatar(person)}
        <div>
          <strong>${person.name}</strong>
          <small>${rows.length ? `${net > 0 ? "+" : ""}${net}` : "0"}</small>
        </div>
      </div>
      <div class="ledger-list">
        ${
          rows.length
            ? rows.map(scoreRow).join("")
            : `<div class="ledger-empty">这一天没有积分变化</div>`
        }
      </div>
    </section>
  `;
}

function renderTodayWorkSummary(logs) {
  const net = logs.reduce((sum, log) => sum + Number(log.delta || 0), 0);
  const workLogs = logs.filter((log) => log.type !== "饮品");
  const summary = `
    <section class="today-summary">
      <div>
        <small>今日完成</small>
        <strong>${workLogs.length} 项</strong>
      </div>
      <div>
        <small>积分变化</small>
        <strong class="${net < 0 ? "negative" : ""}">${net > 0 ? "+" : ""}${net}</strong>
      </div>
    </section>
  `;
  const rows = logs.length
    ? logs.map(logRow).join("")
    : `<div class="log-row"><div class="log-main"><span class="log-dot"></span><div><strong>今天还没有记录</strong><div class="log-meta">点击上面的类目记录</div></div></div></div>`;
  return `${summary}<div class="today-work-list">${rows}</div>`;
}

function scoreRow(log) {
  const positive = log.delta > 0;
  return `
    <div class="score-row ${positive ? "plus" : "minus"}">
      <div>
        <strong>${log.detail || log.type}</strong>
        <small>${log.type}</small>
      </div>
      <span>${positive ? "+" : ""}${log.delta}</span>
    </div>
  `;
}

function ledgerRow(log) {
  const positive = log.delta > 0;
  return `
    <div class="ledger-row ${positive ? "plus" : "minus"}">
      <span class="ledger-avatar">${positive ? "+" : "-"}</span>
      <div class="ledger-main">
        <strong>${TODAY_MONTH}月${log.day}日</strong>
        <small>${log.person} · ${log.type}${log.detail ? ` · ${log.detail}` : ""}</small>
      </div>
      <span class="ledger-delta">${positive ? "+" : ""}${log.delta}</span>
    </div>
  `;
}

function tagClass(type) {
  if (type === "饮品") return "drink";
  if (type === "扣分") return "penalty";
  if (type === "增值家务") return "bonus";
  return "";
}

function logRow(log) {
  return `
    <div class="log-row">
      <div class="log-main">
        <span class="log-dot ${tagClass(log.type)}"></span>
        <div>
          <strong>${log.type}</strong>
          <div class="log-meta">${log.person}${log.detail ? ` · ${log.detail}` : ""}</div>
        </div>
      </div>
      <span class="coin-delta ${log.delta < 0 ? "negative" : ""}">
        ${log.delta > 0 ? "+" : ""}${log.delta || ""}
      </span>
    </div>
  `;
}

function ruleAmount(item) {
  const match = String(item.value || "").match(/[-+]?\d+/);
  return match ? Number(match[0]) : 0;
}

function ruleValue(amount) {
  return `${amount > 0 ? "+" : ""}${amount} 金币`;
}

function ruleTypeMeta(group, amount) {
  const names = { drink: "饮品", base: "基础家务", bonus: "增值家务", penalty: "扣分" };
  return `${names[group] || "规则"} · ${ruleValue(amount)}`;
}

function ruleRowType(group, amount) {
  if (group === "penalty" || amount < 0) return "minus";
  return "plus";
}

function allRuleRows() {
  return Object.entries(state.rules).flatMap(([group, items]) =>
    items.map((item, index) => ({
      group,
      index,
      title: item.label,
      amount: ruleAmount(item),
    })),
  );
}

function renderRules() {
  const ruleRows = allRuleRows();
  $("#rulesList").innerHTML = `
    <section class="settings-block">
      <div class="settings-title">
        <div>
          <strong>小熊目录</strong>
          <small>管理小熊档案、头像和参与开关</small>
        </div>
      </div>
      <button class="settings-entry" id="openBearArchiveFromEntry" type="button">
        <div>
          <strong>小熊目录</strong>
          <small>${activeBears().length} 只参与 · 最多 6 只</small>
        </div>
        <span>›</span>
      </button>
    </section>

    <section class="settings-block">
      <div class="settings-title">
        <div>
          <strong>规则设置</strong>
          <small>设置类型、加减方向和金币数量</small>
        </div>
        <button class="add-button" data-add-rule type="button">+</button>
      </div>
      ${ruleRows
        .map((row) => {
          const type = ruleRowType(row.group, row.amount);
          return `
            <button class="rule-row ${type}" data-edit-rule="${row.group}:${row.index}" type="button">
              <span class="rule-mark">${type === "minus" ? "-" : "+"}</span>
              <div>
                <strong>${row.title}</strong>
                <small>${ruleTypeMeta(row.group, row.amount)}</small>
              </div>
              <span class="rule-amount">${ruleValue(row.amount)}</span>
            </button>
          `;
        })
        .join("")}
    </section>
    `;
}

function renderWishEditor() {
  const person = personByName(state.currentUser);
  $("#wishSheetTitle").textContent = `${person.name}的心愿小熊`;
  $("#wishEditor").innerHTML = `
        <div>
          <button class="secondary-button random-wish" data-random-wish="${person.name}" type="button">随机选择心愿小熊</button>
          <div class="exchange-options">
            ${state.bears
              .map(
                (bear) => `
                  <button class="option-button ${bear.name === person.wishBear ? "active" : ""}" data-wish-person="${person.name}" data-wish-bear="${bear.name}" type="button">
                    ${miniBear(bear.name)}
                    <span>${bear.name}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
        </div>
      `;
}

function renderIdentitySettings() {
  $("#identityList").innerHTML = `
    ${renderAuthPanel()}
    <div class="identity-section-title">
      <strong>当前操作身份</strong>
      <small>切换后，新增记录会记在对应的人下面。</small>
    </div>
    ${state.people
    .map(
      (person) => `
        <div class="identity-row">
          <button class="identity-main ${person.name === state.currentUser ? "active" : ""}" data-current-user="${person.name}" type="button">
            ${personAvatar(person, "large")}
            <span>${person.name}</span>
          </button>
          <button class="avatar-edit-button" data-edit-member="${person.name}" type="button">换头像</button>
        </div>
      `,
    )
    .join("")}
  `;
}

function renderAuthPanel() {
  if (!state.auth.ready) {
    return `
      <section class="auth-panel">
        <strong>登录状态</strong>
        <small>正在检查后端配置...</small>
      </section>
    `;
  }

  if (!state.auth.configured) {
    return `
      <section class="auth-panel local">
        <div>
          <strong>本地原型模式</strong>
          <small>${state.auth.message || "配置 Supabase 环境变量后，可以用邮箱登录。"}</small>
        </div>
      </section>
    `;
  }

  if (state.auth.user) {
    return `
      <section class="auth-panel signed-in">
        <div>
          <strong>已登录</strong>
          <small>${state.auth.email}</small>
        </div>
        <button class="small-action" id="authSignOut" type="button">退出</button>
      </section>
    `;
  }

  return `
    <section class="auth-panel">
      <div>
        <strong>邮箱登录</strong>
        <small>闪闪鱼和杰尼龟分别使用自己的邮箱登录。</small>
      </div>
      <input id="loginEmailInput" type="email" placeholder="输入邮箱" autocomplete="email" />
      <button class="primary-button compact" id="sendLoginLink" type="button">发送登录链接</button>
    </section>
  `;
}

function renderBearArchive() {
  $("#bearArchiveList").innerHTML = state.bears
    .map((bear, index) => {
      const active = bear.active !== false;
      return `
        <div class="archive-row">
          <button class="archive-main" data-edit-bear="${index}" type="button">
              ${miniBear(bear.name)}
              <div>
                <strong>${bear.name}</strong>
              <small>${active ? "参与" : "已关闭"}</small>
              </div>
            </button>
          <button class="switch-toggle ${active ? "active" : ""}" data-toggle-bear="${index}" type="button" aria-label="${bear.name}参与开关">
            <span></span>
          </button>
        </div>
      `;
    })
    .join("");
}

function uniqueBearName(baseName, exceptIndex = -1) {
  const trimmed = baseName.trim() || "新小熊";
  let name = trimmed;
  let count = 2;
  while (state.bears.some((bear, index) => index !== exceptIndex && bear.name === name)) {
    name = `${trimmed}${count}`;
    count += 1;
  }
  return name;
}

function replaceBearName(oldName, newName) {
  state.people.forEach((person) => {
    if (person.wishBear === oldName) person.wishBear = newName;
  });
  if (state.draw?.assignments) {
    Object.values(state.draw.assignments).forEach((assigned) => {
      assigned.forEach((bearName, index) => {
        if (bearName === oldName) assigned[index] = newName;
      });
    });
  }
  if (state.pendingExchange?.targetBear === oldName) state.pendingExchange.targetBear = newName;
  if (state.exchangeDraft?.targetBear === oldName) state.exchangeDraft.targetBear = newName;
  if (state.approvalOffer === oldName) state.approvalOffer = newName;
}

function openRuleEditor(token = "") {
  if (token) {
    const [group, indexText] = token.split(":");
    const index = Number(indexText);
    const item = state.rules[group]?.[index];
    if (!item) return;
    state.editingRule = { group, index };
    $("#ruleSheetTitle").textContent = "编辑金币规则";
    $("#ruleNameInput").value = item.label;
    $("#ruleGroupInput").value = group;
    $("#ruleAmountInput").value = ruleAmount(item);
    $("#deleteRule").classList.remove("hidden");
  } else {
    state.editingRule = null;
    $("#ruleSheetTitle").textContent = "新增金币规则";
    $("#ruleNameInput").value = "";
    $("#ruleGroupInput").value = "bonus";
    $("#ruleAmountInput").value = 1;
    $("#deleteRule").classList.add("hidden");
  }
  $("#ruleSheet").classList.remove("hidden");
}

function saveRuleEditor() {
  const label = $("#ruleNameInput").value.trim() || "新规则";
  const group = $("#ruleGroupInput").value;
  const amount = Number($("#ruleAmountInput").value || 0);
  const item = { label, value: ruleValue(amount) };
  if (!state.rules[group]) state.rules[group] = [];
  if (state.editingRule) {
    const previous = state.editingRule;
    if (previous.group === group) {
      state.rules[group][previous.index] = item;
    } else {
      state.rules[previous.group].splice(previous.index, 1);
      state.rules[group].push(item);
    }
  } else {
    state.rules[group].push(item);
  }
  state.editingRule = null;
  closeSheet("ruleSheet");
  saveToday();
  renderAll();
  showToast("金币规则已保存");
}

function deleteRuleEditor() {
  if (!state.editingRule) return;
  const { group, index } = state.editingRule;
  state.rules[group].splice(index, 1);
  state.editingRule = null;
  closeSheet("ruleSheet");
  saveToday();
  renderAll();
  showToast("金币规则已删除");
}

function openBearEditor(indexText = "") {
  const isNew = indexText === "";
  state.editingBear = isNew ? null : Number(indexText);
  const bear = isNew ? null : state.bears[state.editingBear];
  $("#bearSheetTitle").textContent = isNew ? "新增小熊" : "编辑小熊";
  $("#bearNameInput").value = bear?.name || "";
  $("#bearImageInput").value = "";
  $("#deleteBear").classList.toggle("hidden", isNew);
  $("#bearSheet").classList.remove("hidden");
}

async function saveBearEditor() {
  const index = state.editingBear;
  const isNew = index === null;
  const current = isNew ? null : state.bears[index];
  const name = uniqueBearName($("#bearNameInput").value || "新小熊", isNew ? -1 : index);
  const file = $("#bearImageInput").files?.[0];
  const image = file ? await fileToDataUrl(file) : current?.image || "assets/alice.png";
  if (isNew) {
    const colors = ["#92cfff", "#9fd493", "#ffc2d0", "#e0a547", "#c9935e", "#b5e2dd", "#e8c7ff"];
    state.bears.push({ name, color: colors[state.bears.length % colors.length], image, active: activeBears().length < 6 });
  } else {
    const oldName = current.name;
    current.name = name;
    current.image = image;
    replaceBearName(oldName, name);
  }
  state.editingBear = null;
  closeSheet("bearSheet");
  saveToday();
  renderAll();
  showToast("小熊档案已保存");
}

function deleteBearEditor() {
  const index = state.editingBear;
  if (index === null) return;
  if (state.bears.length <= 2) {
    showToast("至少保留两只小熊");
    return;
  }
  const removed = state.bears[index];
  const replacement = state.bears[index === 0 ? 1 : 0];
  state.bears.splice(index, 1);
  replaceBearName(removed.name, replacement.name);
  state.editingBear = null;
  closeSheet("bearSheet");
  saveToday();
  renderAll();
  showToast("小熊已删除");
}

function openMemberEditor(name) {
  const person = personByName(name);
  if (!person) return;
  state.editingMember = name;
  $("#memberSheetTitle").textContent = `${name}头像`;
  $("#memberPreview").innerHTML = `
    ${personAvatar(person, "large")}
    <strong>${person.name}</strong>
  `;
  $("#memberImageInput").value = "";
  $("#memberSheet").classList.remove("hidden");
}

async function saveMemberEditor() {
  const person = personByName(state.editingMember);
  const file = $("#memberImageInput").files?.[0];
  if (!person || !file) {
    showToast("请选择头像图片");
    return;
  }
  person.image = await fileToDataUrl(file);
  state.editingMember = null;
  closeSheet("memberSheet");
  saveToday();
  renderAll();
  showToast("头像已更新");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openApprovalSheet() {
  const pending = state.pendingExchange;
  if (!pending || !state.draw) return;
  const approver = otherPerson(pending.applicant);
  const applicant = personByName(pending.applicant);
  const applicantBears = state.draw.assignments[applicant.name] || [];
  state.approvalOffer = applicantBears.includes(state.approvalOffer) ? state.approvalOffer : applicantBears[0];
  $("#approvalNote").textContent = `${applicant.name}想要${pending.targetBear}。请选择你想换走${applicant.name}的哪只小熊。`;
  renderApprovalOptions(applicantBears);
  $("#approvalSheet").classList.remove("hidden");
}

function renderApprovalOptions(applicantBears) {
  $("#approvalOptions").innerHTML = `
    <div class="option-group">
      <h3>我要换走</h3>
      ${applicantBears
        .map(
          (bearName) => `
            <button class="option-button ${bearName === state.approvalOffer ? "active" : ""}" data-approval-offer="${bearName}" type="button">
              ${miniBear(bearName)}
              <span>${bearName}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function openExchangeSheet(personName) {
  if (!state.draw) return;
  const applicant = personByName(personName);
  const opponent = otherPerson(personName);
  const opponentBears = state.draw.assignments[opponent.name];
  const nextTarget = state.exchangeDraft?.applicant === applicant.name ? state.exchangeDraft.targetBear : opponentBears[0];
  state.exchangeDraft = { applicant: applicant.name, targetBear: nextTarget };
  $("#exchangeNote").textContent = `选择想申请兑换的对方小熊。`;
  renderExchangeOptions(opponentBears);
  $("#exchangeSheet").classList.remove("hidden");
}

function renderExchangeOptions(opponentBears) {
  $("#exchangeOptions").innerHTML = `
    <div class="option-group">
      <h3>想要的小熊</h3>
      ${opponentBears
        .map(
          (bearName) => `
            <button class="option-button ${bearName === state.exchangeDraft.targetBear ? "active" : ""}" data-exchange-target="${bearName}" type="button">
              ${miniBear(bearName)}
              <span>${bearName}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function closeSheet(id) {
  $(`#${id}`).classList.add("hidden");
}

function renderAll() {
  renderScreens();
  renderBearScreen();
  renderCalendar();
  renderStats();
  renderRules();
  renderWishEditor();
  renderIdentitySettings();
  renderBearArchive();
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      state.view = viewButton.dataset.view;
      renderAll();
      return;
    }

    if (event.target.closest("[data-open-wish]") || event.target.closest("#wishToggle")) {
      $("#wishSheet").classList.remove("hidden");
      return;
    }

    if (event.target.closest("#currentUserPill")) {
      $("#identitySheet").classList.remove("hidden");
      return;
    }

    if (
      event.target.closest("#openBearArchive") ||
      event.target.closest("#openBearArchiveFromRules") ||
      event.target.closest("#openBearArchiveFromEntry")
    ) {
      $("#bearArchiveSheet").classList.remove("hidden");
      return;
    }

    const close = event.target.closest("[data-close-sheet]");
    if (close) {
      closeSheet(close.dataset.closeSheet);
      return;
    }

    const startDraw = event.target.closest("#startDraw");
    if (startDraw) {
      drawInitial();
      return;
    }

    const redraw = event.target.closest("[data-redraw-person]");
    if (redraw) {
      paidRedraw(redraw.dataset.redrawPerson);
      return;
    }

    const exchange = event.target.closest("[data-exchange-person]");
    if (exchange) {
      openExchangeSheet(exchange.dataset.exchangePerson);
      return;
    }

    const exchangeTarget = event.target.closest("[data-exchange-target]");
    if (exchangeTarget) {
      state.exchangeDraft.targetBear = exchangeTarget.dataset.exchangeTarget;
      const opponent = otherPerson(state.exchangeDraft.applicant);
      renderExchangeOptions(state.draw.assignments[opponent.name]);
      return;
    }

    const confirmExchange = event.target.closest("#confirmExchange");
    if (confirmExchange) {
      const applicant = personByName(state.exchangeDraft.applicant);
      if (applicant.coins < 2) {
        showToast(`${applicant.name}金币不够`);
        return;
      }
      state.pendingExchange = { ...state.exchangeDraft };
      state.exchangeDraft = null;
      closeSheet("exchangeSheet");
      saveToday();
      renderAll();
      showToast("兑换申请已发出");
      return;
    }

    const approveExchange = event.target.closest("#approveExchange");
    if (approveExchange) {
      const approver = otherPerson(state.pendingExchange?.applicant);
      if (!approver || state.currentUser !== approver.name) {
        showToast(`请切换为${approver?.name || "对方"}后同意`);
        return;
      }
      openApprovalSheet();
      return;
    }

    const approvalOffer = event.target.closest("[data-approval-offer]");
    if (approvalOffer) {
      state.approvalOffer = approvalOffer.dataset.approvalOffer;
      const applicant = personByName(state.pendingExchange?.applicant);
      renderApprovalOptions(state.draw.assignments[applicant.name]);
      return;
    }

    const confirmApproval = event.target.closest("#confirmApproval");
    if (confirmApproval) {
      if (!state.pendingExchange || !state.approvalOffer) return;
      state.pendingExchange.offerBear = state.approvalOffer;
      state.approvalOffer = null;
      closeSheet("approvalSheet");
      applyApprovedExchange();
      return;
    }

    const currentUser = event.target.closest("[data-current-user]");
    if (currentUser) {
      state.currentUser = currentUser.dataset.currentUser;
      saveToday();
      renderAll();
      showToast(`已切换为${state.currentUser}`);
      return;
    }

    const sendLogin = event.target.closest("#sendLoginLink");
    if (sendLogin) {
      const email = $("#loginEmailInput")?.value.trim();
      if (!email) {
        showToast("先输入邮箱");
        return;
      }
      if (!authApi?.sendLoginLink) {
        showToast("登录模块还没准备好");
        return;
      }
      try {
        await authApi.sendLoginLink(email);
        showToast("登录链接已发送");
      } catch (error) {
        showToast(error.message || "发送失败");
      }
      return;
    }

    const authSignOut = event.target.closest("#authSignOut");
    if (authSignOut) {
      try {
        await authApi?.signOut?.();
        showToast("已退出登录");
      } catch (error) {
        showToast(error.message || "退出失败");
      }
      return;
    }

    const addRule = event.target.closest("[data-add-rule]");
    if (addRule) {
      openRuleEditor();
      return;
    }

    const editRule = event.target.closest("[data-edit-rule]");
    if (editRule) {
      openRuleEditor(editRule.dataset.editRule);
      return;
    }

    const saveRule = event.target.closest("#saveRule");
    if (saveRule) {
      saveRuleEditor();
      return;
    }

    const deleteRule = event.target.closest("#deleteRule");
    if (deleteRule) {
      deleteRuleEditor();
      return;
    }

    const addBear = event.target.closest("[data-add-bear]");
    if (addBear) {
      openBearEditor();
      return;
    }

    const editBear = event.target.closest("[data-edit-bear]");
    if (editBear) {
      openBearEditor(editBear.dataset.editBear);
      return;
    }

    const saveBear = event.target.closest("#saveBear");
    if (saveBear) {
      await saveBearEditor();
      return;
    }

    const deleteBear = event.target.closest("#deleteBear");
    if (deleteBear) {
      deleteBearEditor();
      return;
    }

    const toggleBear = event.target.closest("[data-toggle-bear]");
    if (toggleBear) {
      const index = Number(toggleBear.dataset.toggleBear);
      const bear = state.bears[index];
      if (!bear) return;
      const active = bear.active !== false;
      if (!active && activeBears().length >= 6) {
        showToast("最多开启 6 只小熊");
        return;
      }
      const currentlyActive = activeBears().length;
      if (active && currentlyActive <= 1) {
        showToast("至少保留 1 只参与");
        return;
      }
      bear.active = !active;
      saveToday();
      renderAll();
      showToast(`${bear.name}${bear.active ? "已开启" : "已关闭"}`);
      return;
    }

    const editMember = event.target.closest("[data-edit-member]");
    if (editMember) {
      openMemberEditor(editMember.dataset.editMember);
      return;
    }

    const saveMember = event.target.closest("#saveMember");
    if (saveMember) {
      await saveMemberEditor();
      return;
    }

    const randomWish = event.target.closest("[data-random-wish]");
    if (randomWish) {
      const person = personByName(randomWish.dataset.randomWish);
      const random = seededRandom(Date.now() + hashString(person.name));
      const nextBear = state.bears[Math.floor(random() * state.bears.length)].name;
      person.wishBear = nextBear;
      saveToday();
      renderAll();
      showToast(`${person.name}随机选到${nextBear}`);
      return;
    }

    const day = event.target.closest("[data-day]");
    if (day) {
      state.selectedDay = Number(day.dataset.day);
      renderAll();
      return;
    }

    const calendarPerson = event.target.closest("[data-calendar-person]");
    if (calendarPerson) {
      state.selectedPerson = calendarPerson.dataset.calendarPerson;
      renderAll();
      return;
    }

    const action = event.target.closest("[data-log-type]");
    if (action) {
      const delta = Number(action.dataset.logDelta);
      addLog(TODAY_DAY, {
        type: action.dataset.logType,
        person: state.selectedPerson,
        detail: action.dataset.logDetail,
        delta,
      });
      saveToday();
      renderAll();
      showToast(`${state.selectedPerson}已记录${action.dataset.logType}`);
      return;
    }

    const wish = event.target.closest("[data-wish-person]");
    if (wish) {
      const person = personByName(wish.dataset.wishPerson);
      if (person.wishBear === wish.dataset.wishBear) return;
      if (person.coins < 1) {
        showToast(`${person.name}金币不够`);
        return;
      }
      person.coins -= 1;
      person.wishBear = wish.dataset.wishBear;
      addLog(21, {
        type: "心愿小熊",
        person: person.name,
        detail: wish.dataset.wishBear,
        delta: 0,
      });
      saveToday();
      renderAll();
      showToast(`${person.name}修改心愿小熊`);
    }
  });
}

async function bootAuth() {
  try {
    const auth = await import("./src/auth.js");
    authApi = auth;
    await auth.watchAuth((snapshot) => {
      state.auth = { ready: true, ...snapshot };
      renderAll();
    });
  } catch (error) {
    state.auth = {
      ready: true,
      configured: false,
      user: null,
      email: "",
      message: "请通过 Vite 本地地址或部署地址使用登录功能。",
    };
    renderAll();
  }
}

loadToday();
bindEvents();
renderAll();
bootAuth();
