# Finvu 2026 v2 — Kompletný redesign brief

Robím veľký redesign appky **Finvu** (Slovak family finance tracker, React + Vite + TypeScript). Hi-fi mockup je v jednom súbore `Finvu 2026 v2.html` (3428 riadkov, React JSX inline). Implementuj všetko do reálneho codebase v `finance-tracker/src/`. UI je v slovenčine, čísla `1 250,00 €` (sk-SK), dátumy DM Mono v kompaktoch.

**Pravidlá:**
- Nepoužívaj nový dizajn systém — drž sa CSS premenných z mockupu (`--bg`, `--bg2..4`, `--text`, `--text2`, `--text3`, `--violet`, `--green`, `--red`, `--warning`, `--orange`, `--border`, `--border2`, `--card-shadow`, `--shadow-elevated`).
- Fonty: **DM Sans** (UI), **DM Mono** (čísla, dátumy, kbd).
- Border-radius scale: 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 (vyššie = väčšie kontajnery).
- Žiadne emoji v UI texte okrem ikon kategórií a status indikátorov. Ikony preferuj inline SVG (`strokeWidth: 1.8–2`).
- Po každej route urob commit a screenshot pre porovnanie s mockupom.
- Pred zmenou DB schema alebo pridaním nového endpointu sa spýtaj.

---

## 0 · Globálne základy

### Theme tokeny (`src/styles/tokens.css` alebo `index.css`)

```css
:root, [data-theme="dark"] {
  --bg:#0d0b18; --bg2:#13101f; --bg3:#1a1630; --bg4:#211d3a;
  --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.12);
  --text:#f0eeff; --text2:#a89ec9; --text3:#6b6387;
  --violet:#8B5CF6; --violet2:#7C3AED; --violet-glow:rgba(139,92,246,0.2);
  --green:#34d399; --red:#f87171; --warning:#FBBF24; --orange:#FB923C;
  --card-shadow:0 4px 24px rgba(0,0,0,0.4);
  --shadow-elevated:0 8px 40px rgba(0,0,0,0.5);
  --sidebar-w:200px; --sidebar-cw:56px; --topbar-h:56px;
}
[data-theme="light"] {
  --bg:#fafaf9; --bg2:#ffffff; --bg3:#f4f4f3; --bg4:#e7e7e5;
  --border:rgba(24,24,27,0.06); --border2:rgba(24,24,27,0.10);
  --text:#18181b; --text2:#52525b; --text3:#a1a1aa;
  --violet:#7C3AED; --violet2:#6D28D9; --violet-glow:rgba(124,58,237,0.10);
  --green:#16a34a; --red:#dc2626; --warning:#d97706; --orange:#ea580c;
  --card-shadow:0 1px 2px rgba(24,24,27,0.04),0 4px 16px rgba(24,24,27,0.04);
  --shadow-elevated:0 8px 32px rgba(24,24,27,0.10),0 2px 6px rgba(24,24,27,0.05);
}
```

Theme prepínanie cez `document.documentElement.setAttribute('data-theme', ...)`, persistované v localStorage. **Light theme overhaul** — nahradiť doterajší fialový light bg za neutral `#fafaf9` / `#ffffff`. Všetky moduly musia v light vyzerať čisto a high-contrast.

### Globálne animácie (do CSS)

```
fadeUp (0→10px, 0.3s) + stagger .s1–.s6 (40ms*n)
slideUp (sheets)
modalIn (scale 0.95→1, 0.2s)
spin / float / glowPulse / sparkle / shimmer
toastIn (cubic-bezier overshoot)
toastOut / flame / pulseRing / paletteIn / blink / ripple
```

Helper triedy: `.fu` (fadeUp), `.su` (slideUp), `.mi` (modalIn), `.kbd` (keyboard hint pill), `.skel` (shimmer skeleton), `.cursor` (blinking caret), `.ripple` (button ripple).

### Globálne utility / hooks

| Helper | Účel |
|---|---|
| `fmt(n)` | `1 250,00 €` (sk-SK locale, 2 decimals) |
| `fmtShort(n)` | `1,2 k€` pre čísla ≥ 1000 |
| `getCat(id)` | lookup kategórie |
| `todayISO()` | dnes YYYY-MM-DD |
| `MONTHS` | slovenské názvy mesiacov |
| `getGreeting()` | čas-závislé `{text, emoji}` (Dobré ráno / deň / večer / noc) |
| `useCountUp(target, duration=900)` | eased count-up (cubic-out), používaj pre všetky veľké totals |

---

## 1 · App shell & layout

### `AppShell` / `App`

- `<ToastProvider>` wrapper → `<App>`.
- State: `loggedIn`, `page`, `collapsed`, `theme`, `month`, `year`, `isDesktop`, `showAdd`, `showProfile`, `paletteOpen`, `varExpenses`, `fixedExp`, `incomes`, `dashView` (`'personal' | 'family'`), `confetti`, `notifications`, `tweaks`.
- Layout (desktop): `[AppNav | 12px gap | <main>{Topbar, route}</main>]`.
- Mobile: `<main>` full-width + fixed `<BottomNav>` (cap 72px).
- Globálny shortcut: `⌘K` / `Ctrl+K` → toggle Command Palette.
- Routy: `dashboard | income | variable-expenses | fixed-expenses | categories | household | savings | settings`. Ak nie je prihlásený → `<LoginPage>`.

### Side navigation — `AppNav`

- Width: `200px` expanded / `56px` collapsed, smooth `cubic-bezier(0.4,0,0.2,1)` width transition.
- Logo + brand block ("Finvu" + DM Mono uppercase "Financie pod kontrolou").
- Toggle button: 24×24 floating circle na pravom okraji (`right:-12px`, vertical center), s chevron L/R.
- Položky:
  1. Prehľad (dashboard icon)
  2. Príjmy
  3. **Výdavky** — collapsable submenu (Variabilné · Fixné · Kategórie). Keď expanded, submenu sa rolluje (max-height transition 0.25s); keď collapsed, submenu sa otvára ako **floating popup na hover** (`position:fixed`, mountnutý na `submenuY` z `getBoundingClientRect()`).
  4. Sporenie (piggy ikona) — **NOVÁ položka**
  5. Domácnosť
- Bottom (oddelené border-top): Nastavenia.
- Active state: `rgba(139,92,246,0.12)` bg + violet text + violet icon.

### Top bar — `Topbar`

Height 56px, `flex` row, `padding: 0 20px`, `background: var(--bg2)`, bottom border.

**Desktop layout (zľava doprava):**
1. **Title block** (`.dt-only`): `titles[page]` (15px, weight 700, letter-spacing -0.2px) + datum line (DM Mono 10.5px, `dayName` = "štvrtok, 1. mája").
2. **`<StreakBadge count={7}/>`** — pill s 🔥 flame animáciou (orange gradient).
3. Flex spacer.
4. **Dashboard toggle „Moje / Rodinné"** — segmented control, len na `page==='dashboard'`. Pills 24px high, violet keď active.
5. **`<MonthSwitcher>`** — len na pages s mesiacom (`dashboard | income | variable-expenses | fixed-expenses`). DM Mono `Apríl 2026`, 26px chev buttons.
6. **`+ Pridať` button** — violet primary, 6px×13px padding, gradient shadow `0 3px 12px rgba(139,92,246,0.35)`, hover translateY(-1px). Otvorí `<AddModal page={page}/>` s default type podľa aktívnej stránky.
7. **Theme toggle** — 34px square, sun/moon SVG.
8. **`<NotificationCenter>`** — bell + count badge.
9. **Avatar** (34px) — otvorí `<ProfileModal>`.

Separátory medzi sekciami: `1px × 22px` border lines.

**Mobile layout (`.mb-only`):** Logo + greeting (`g.emoji g.text, FirstName!`) + dayName, ostatné iconography vpravo. Topbar je sticky.

### Bottom navigation — `BottomNav` (mobile)

- 4 tabs: Prehľad, Príjmy, **Výdavky** (otvára mini-sheet so 3 sub-options vznášajúcim sa nad navom), Nastavenia.
- Každý tab: 32×32 icon wrapper (active = violet glow bg) + 9.5px label pod ním.
- Fixed bottom, `safe-area-inset-bottom` padding, top shadow.

---

## 2 · Globálne komponenty

### `ToastProvider` + `useToast()`

- Stack v `top:14, right:14`, max-width 340px, gap 8px.
- 4 kindy: `success` (green bg), `error` (red), `warning` (amber), `info` (violet). Ikona vľavo (`✓ ⚠ ⚡ ℹ`).
- `padding:11px 14px`, `borderRadius:11`, `backdrop-filter:blur(8px)`, animation `toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)`.
- Auto-dismiss po 3.6s default.
- API: `toast('msg', {kind, duration})`.

### Command Palette (`⌘K`)

- Modal s blur backdrop `rgba(8,6,14,0.65) + blur(6px)`, paddingTop `15vh`.
- Box: 580px max-width, `--bg2`, border 1px `--border2`, radius 16, shadow `0 24px 64px rgba(0,0,0,0.55)`, animation `paletteIn 0.18s`.
- Header: search ikona + input "Hľadať alebo vykonať akciu…" + `esc` kbd hint.
- 3 sekcie (s uppercase 9.5px titles): **Navigácia** (8 dest), **Akcie** (Pridať výdavok / príjem, Prepnúť tému), **Transakcie** (fuzzy search ak query ≥ 2 znaky, max 5 výsledkov).
- Klávesy: `↑↓` pohyb (auto-scroll), `↵` vybrať, `esc` close. Hover updates `selIdx`.
- Selected row: violet left-border 2px + violet bg tint.
- Footer: kbd hints (`↑↓ pohyb`, `↵ vybrať`, `⌘K otvoriť`).
- Empty state: 🔍 + "Žiadne výsledky pre {query}".

### `NotificationCenter`

- 34px bell button v topbare. Unread badge: red pill top-right, animation `pulseRing 2s` infinite, DM Mono.
- Dropdown 340px, `--bg2`, radius 14, shadow, animation `fadeUp 0.18s`. Outside-click close (`mousedown` listener).
- Header: "Notifikácie" + "Označiť ako prečítané" link (ak unread > 0).
- Row: 32×32 colored icon tile + title + body (text3, lineHeight 1.4) + DM Mono time + 7px violet dot pre unread. Unread bg `rgba(139,92,246,0.06)`.
- Mock data (pridaj v API/init):
  ```
  - ⚠️ Limit Zábava 95% — 76€ zo 80€
  - 🏠 Nájomné zajtra — 650€
  - 💰 Výplata pripísaná — +1250€
  - 🎯 Cieľ úspor 30% — gratulácia
  ```
- Empty state: 🔕 + "Žiadne notifikácie".

### `Confetti` (canvas)

- 140 particles, gravity 0.45, life decay 0.005/frame, 180 frames.
- 6 colors `[violet, green, amber, red, light-violet, cyan]`.
- Spustí sa pri:
  - dosiahnutí cieľa úspor 100 %
  - pridaní príjmu ≥ 500 €
  - (môžeš pridať: 7-day streak milestone, first transaction of month)
- `position:fixed`, inset 0, `pointer-events:none`, z-index 700.

### `StreakBadge`

- Pill: `padding:4px 9px`, gradient `linear-gradient(135deg, rgba(251,146,60,0.18), rgba(248,113,113,0.15))`, border `rgba(251,146,60,0.3)`.
- DM Mono 11px, color `#FB923C`, weight 700.
- `flame` keyframe animuje 🔥.
- Title attr: "Sledujete financie {N} dní v rade!"

### `SwipeableRow` (mobile)

- Touch wrapper okolo transaction rows.
- Threshold `-60px` → trigger `onDelete`.
- Pod riadkom: gradient red reveal `linear-gradient(90deg, transparent, rgba(248,113,113,0.2) 60%, rgba(248,113,113,0.35))` + "Vymazať" label fade-in.
- `transition:transform 0.25s cubic-bezier(0.4,0,0.2,1)` pri release.

### `SparklineMini`

- SVG, default 110×24. Min/max normalized line + gradient area fill (0.28 → 0).
- Unique gradient ID per render (`spm-` + random).

### `MonthSwitcher`

- DM Mono `Január 2026`, prev/next chev buttons (26×26), bg `--bg3`, border `--border2`, radius 11, padding 3px.

---

## 3 · Sporenie (NOVÁ STRÁNKA) — `SavingsPage`

**Pridaj Drizzle schema + API endpoints:**

```ts
// schema
savingsGoals: { id, householdId, userId, name, icon, color, target, saved, deadline, monthlyAuto }
savingsTransactions: { id, goalId, label, date, amount, kind: 'in'|'out' }

// hooks
useSavingsGoals() / useCreateSavingsGoal() / useUpdateSavingsGoal() / useDepositSavings()
```

**Layout:**

1. **Hero card** — teal/cyan gradient `linear-gradient(135deg, #082626 0%, #0d4d4d 45%, #082626 100%)`, radius 24, padding `24px 26px 20px`. Atmosphere blob top-right + diagonal sheen overlay. Piggy ikona top-right 38px tile.
   - Header chip: `SPORENIE · {N} aktívnych cieľov`.
   - Display: 46px light-weight celkové úspory (DM Sans, letter-spacing -1.8px), 22px decimals, € suffix. Right pill: `{overallPct}% z {totalTarget}`.
   - Progress bar 8px high, teal gradient `#5eead4 → #34d399`, glow shadow.
   - Bottom strip (border-top 1px white/10%): **Mesačne** (+autoSave) | **Zostáva spolu** | **% z príjmov**.

2. **Section header** `Vaše ciele` + `+ Nový cieľ` button (teal gradient + shadow).

3. **Goal cards grid** (auto-fill 280px, gap 14):
   - 56px decorative blob top-right tinted goal color.
   - Header: 48px icon tile + name + DM Mono `do {deadline}` + 56×56 progress ring vpravo (4px stroke, ring color = goal color, `transition: stroke-dasharray 0.9s`).
   - Body: `{saved} / {target}` (DM Mono, 18 + 12px).
   - Footer line: `Zostáva {remaining} · auto +{monthly}/mes.` ALEBO ak complete → checkmark icon + zelený "✓ Cieľ dosiahnutý!" + spustí confetti.
   - Klik → `setSelectedGoal(g.id)`. Selected: border `1.5px goal.color`, shadow `0 0 0 3px {color}1f`.

4. **Selected goal detail** (2-col grid, `goal-detail` class collapsing to 1-col on mobile):
   - Vľavo: 56px icon + name (20px weight 700) + 2×2 mini stat grid (Mesačne / Mesiacov / Termín / Zostáva, bg `--bg3` radius 12) + actions row (`+ Vložiť` goal-color primary, `edit` ghost, `Pauza` ghost).
   - Vpravo: 200×200 big ring (84r, 14px stroke, drop-shadow glow). Center: 48px DM Mono `{goalPct}` + "% naplnené" label.

5. **Sub-grid** (1fr 1fr): **Auto-save pravidlá** + **Posledné príspevky** (auto-transfer log z `SAVINGS_TXN`).

Confetti fire na 100 % milestone.

---

## 4 · Dashboard (`/dashboard`)

State: `activeTab` (`income | expenses` for right panel), `activeIdx` (donut hover), `donutFilter`.

**Desktop layout** (`.dt-layout` grid `1fr 280px`, gap 24):

### Left column

1. **Greeting row** — `{emoji} {greeting}, Ján!` (20px 700) + DM Mono today date.

2. **Hero balance card** — purple wallet (`linear-gradient(135deg, #1a1235 0%, #3d2a82 45%, #1a1235 100%)`):
   - Atmosphere: 2 radial blobs (violet top-right 280px, green bottom-left 200px) + diagonal sheen.
   - **Credit-card chip ornament** top-right (38×28 gold gradient).
   - Brand row: `FINVU · Hlavný účet`.
   - Big balance: editorial typography — `+` sign (14px green/red) + 46px light-weight integer + 22px `,decimals` + 22px `€`. Letter-spacing -1.8px.
   - Right pill: `+{savRate}% úspora` (green) alebo `−v mínuse` (red).

3. **Stat cards bento** (`.stat-grid` grid `1.1fr 1fr 1fr`, gap 14):
   - **Úspora ring tile** — 60×60 progress ring (22r, 5px stroke, violet) + `{savRate}%` center, "Výborne / Dobre / Pokračujte / Pozor" hodnotenie.
   - **Príjmy sparkline tile** — `↑ 12,4%` pill (green) + 20px DM Mono total + `<SparklineMini data={CHART_DATA.map(d=>d.income)} color="--green"/>` 150×24.
   - **Výdavky sparkline tile** — `↑ 3,1%` pill (amber) + total + sparkline (red).

4. **Mini stat strip** — "Transakcií tento mesiac" 36px violet icon + DM Mono count.

5. **Area charts grid** (2 cols, gap 14):
   - "Príjmy za 6 mes." (green) a "Výdavky za 6 mes." (red).
   - SVG `viewBox 280×100+16`, dots r=3, area fill linear-gradient stop 0.22 → 0.01. Month labels under (DM Mono 10px).

6. **Pie/donut card** "Výdavky podľa kategórie":
   - 160×160 donut (R=68, r=46), slice hover scale (R+5), click → `donutFilter` (dim ostatné, badge "Filter: {name}" so close icon).
   - Center: ak hover → category emoji + amount; inak `fmtShort(totalVar)` + "celkom".
   - Legend riadky vľavo: top 5 kategórií s color dot + name + percent.

### Right rail (sticky 280px)

V `var(--bg2)` outer container, radius 20:

1. **Nadchádzajúce platby** — z `fixedExp`. Per row: name + `Dnes / Zajtra / Za N dní` + DM Mono red amount.
2. **Rozpočty** — top 4 kategórie s budget. Progress bar 6px, color `red ≥ 90, amber ≥ 70, green` jinak. "Nastaviť limity →" link.
3. **Posledné transakcie** — tab `Príjmy / Výdavky` (drive by `activeTab` from left). 5 najnovších. "Všetky →" link na full page.
4. **ForecastCard** — predikcia konca mesiaca:
   - 72×72 ring (32r, 6px stroke), progress = `dayOfMonth / daysInMonth`.
   - Center: `{progress}%` + "mesiaca".
   - Vpravo: "Predpokladaný zostatok" + `predictedBalance = totalIncome - dailyAvg * daysInMonth` (green/red, 18px DM Mono) + "Tempo: {dailyAvg}/deň".

**Mobile layout** (`.mb-layout`): stack všetko vertikálne (`heroCard, miniStats, areaCharts, pieCard, rightPanel`).

**dashView toggle:** `family` mode kombinuje totals zo všetkých členov domácnosti (volaj `useHousehold()` ak existuje, alebo pripočítaj z `members` mock array).

**Optional bonus — AI Insights card** (ak chceš pridať pod hero):
- Volá Anthropic API endpoint (pridaj `apps/api/insights` POST endpoint s tvojím Claude API key, NIE z frontendu).
- Prompt v slovenčine, vracia 1–2 vetnú akčnú radu, max 180 znakov.
- Fallback array 4 tipov ak API zlyhá.
- Refresh button so spin animáciou.

---

## 5 · Príjmy (`/income`) — `IncomePage`

1. **Hero card** — green gradient `#0a2920 0% → #0f4d2f 45% → #0a2920 100%`. Trending-up ikona top-right.
   - Header chip: `PRÍJMY · Apríl 2026`.
   - 46px total s `+` prefix (light green).
   - Bottom strip: `↻ Opakujúce: {recurring}` a `1× Jednorazové: {oneTime}`.

2. **3 KPI tiles** (`stat-grid`):
   - Počet príjmov (📋 violet)
   - Priemerný príjem (⚖️ green)
   - Najväčší príjem (🏆 amber)

3. **Zdroje príjmu** — ak `> 1 source`. Stacked horizontal bars per source (`Zamestnávateľ, Klient A, XTB…`), 5px high, 5 rotujúcich farieb, fmt suma + percent.

4. **Všetky príjmy list** — radius 14 rows, `💰` icon, name (s "OPAKUJÚCE" violet badge ak recurring), source + DM Mono date, trash hover button, `+{amount}` v zelenej DM Mono 15px.

Empty state: floating 💰 + "Žiadne príjmy" + hint.

---

## 6 · Variabilné výdavky (`/variable-expenses`) — `VariableExpensesPage`

1. **Hero card** — red wallet `#2a0d10 0% → #5e1a22 45% → #2a0d10 100%`. Receipt ikona top-right.
   - `VARIABILNÉ VÝDAVKY · Apríl 2026` chip.
   - 46px `−` prefix amount.
   - Bottom strip: `Priemer: {avg}` | `Najväčší: {max}` + inline MonthSwitcher right.

2. **Search bar** — focus state `1.5px var(--violet)` + glow `0 0 0 3px rgba(139,92,246,0.08)`. Clear button vpravo + count "N výsl." DM Mono.

3. **Filter chips** — `Všetky` + per-category, radius 99, active `rgba(139,92,246,0.14)` + violet text.

4. **Grouped by date** — header row per day:
   - Vľavo: 18px DM Mono day number + dayName (`var(--text2)`, capitalize) + month name (DM Mono 10px).
   - Stred: 1px hairline divider.
   - Vpravo: `{N} tx` pill + DM Mono `−{daySum}`.
   - Rows pod tým, gap 6.

5. **Tx rows** — `<TxRow>` wrapped v `<SwipeableRow>` na mobile. Hover reveals trash. Cat color tile + name + DM Mono date + amount.

Empty state: floating 💸 + "Žiadne výdavky" + hint.

---

## 7 · Fixné výdavky (`/fixed-expenses`) — `FixedExpensesPage`

1. **Hero card** — amber gradient `#2a1d05 → #5d3f10 45% → #2a1d05`. Lock ikona top-right.
   - 46px total + `€/mes.` suffix.
   - Bottom strip: `Ročne: {yearly}` · `Splátok: {count}` · `{N} dní do konca mesiaca`.

2. **Kalendár mesiaca** — grid `repeat(31, 1fr)`, gap 2, aspect-ratio 1. Per day:
   - Žiadna platba → `--bg3`.
   - Malé (`<20€`) → `rgba(124,58,237,0.5)`.
   - Stredné (`20–100€`) → `rgba(251,191,36,0.55)`.
   - Veľké (`≥100€`) → `rgba(248,113,113,0.6)`.
   - Today → 1.5px violet outline + violet text.
   - Past days → opacity 0.55.
   - Hover scale 1.18, tooltip s názvami platieb.
   - Legend pod gridom (4 swatches).

3. **Nadchádzajúce (N)** — section title uppercase 11px. Per row:
   - 48×48 date tile (DM Mono day + MMM uppercase abbreviation, `rgba(251,191,36,0.12)` bg).
   - Label + "Dnes / Zajtra / o N dní · opakujúce".
   - Trash hover button.
   - DM Mono `−{amount}` 15px.
   - Ak `daysUntil ≤ 3` → 3px amber left-border accent.

4. **Zaplatené (N)** — opacity 0.7, line-through amount, green checkmark icon v date tile.

Empty state: 🔒 floating + "Žiadne fixné výdavky".

---

## 8 · Kategórie (`/categories`) — `CategoriesPage`

State: `order` (id array, persistovať do DB cez `updateCategoryOrder`), `dragId`, `overId`, `view` (`grid | list`).

1. **Hero card** — violet wallet rovnaký gradient ako Dashboard.
   - `KATEGÓRIE · {N} aktívnych · Apríl 2026` chip.
   - "Minuté z rozpočtu" label + 46px total + pill `{pct}% z {totalBudget}`.
   - 8px overall progress bar (violet gradient s glow shadow).
   - 3-col footer strip: **Spolu limit** | **Zostáva** | **Pri limite** (count of cats ≥ 90 %).

2. **Toolbar** — segmented `Mriežka / Zoznam` toggle + hint text "Karty môžete uchopiť a presúvať pre zmenu poradia".

3. **Grid view** — `repeat(auto-fill, minmax(290px, 1fr))`, gap 12.
   - Card radius 20, decorative blob top-right tinted cat color, drag handle dots top-right (opacity 0.4).
   - 48×48 icon tile (`{color}1a` bg, `{color}44` border).
   - Name + "Limit {budget}" alebo "Bez limitu".
   - DM Mono 18px spent + `{pct}%` colored pill.
   - 6px progress bar, color `red≥90 / amber≥70 / cat.color`.
   - **HTML5 drag** (`draggable`, `onDragStart/End/Over/Leave/Drop`). Dragging: opacity 0.4, scale 0.97. Drop target: violet border + `0 0 0 3px rgba(139,92,246,0.18)` ring.
   - Hover: translateY(-2px) + elevated shadow.

4. **List view** — radius 14 rows, drag handle vľavo, 38×38 icon, name + limit text, 120×6 progress bar vpravo, DM Mono amount.

Persist order to backend cez `setOrder(...)`. Use optimistic update + invalidate.

---

## 9 · Domácnosť (`/household`) — `HouseholdPage`

Mock data (replace API):
```
Ján Novák · Správca · violet · 1250 príjem · 683 výdavky · cieľ Núdzový fond
Mária Nováková · Člen · green · 950 / 420 · cieľ Dovolenka
```

1. **Hero card** — violet gradient, header chip `DOMÁCNOSŤ · Rodina Novákovcov`. **Avatar stack** top-right (overlapping `marginLeft:-12px`).
   - 46px `{totBalance}` (green/red).
   - 3-col bottom strip: **Spolu príjmy** | **Spolu výdavky** | **Členov**.

2. **Sekcia title** `Členovia` + `+ Pozvať člena` ghost button (dashed border).

3. **Member cards grid** (`auto-fill 330px`):
   - 52px avatar s online dot (green, border `--bg2`).
   - Name (15px 600) + role pill (Správca = violet, Člen = gray) + "· cieľ {goal}".
   - **Mini 3-stat row**: Príjmy (green tint) / Výdavky (red tint) / Saldo (violet tint), each centered, DM Mono.
   - **Stacked horizontal bar** (8px high, radius 99) — distribution across categories, 5 colors `[green, blue, amber, pink, violet]`.
   - Legend pod barom: dot + cat name + DM Mono percent.

4. **Activity feed** card:
   - Header `Aktivita` + green "● Live" pill.
   - Per row: 28px avatar + `{who}` (bold) + `{action}` (gray) + `{what}` (semi-bold) + DM Mono `{time}` + amount (green/red if non-zero).
   - Hairline borders between rows.

---

## 10 · Nastavenia (`/settings`) — `SettingsPage`

State: `section` (`appearance | finance | notif | security | data | about`), + per-section toggles (`compact, biometric, notif, weeklyDigest, budgetAlerts, autoLock, accentSwatch`).

1. **Hero card** — dark violet gradient `#0d0b18 → #1a1535 45% → #0d0b18`. Cog ikona top-right.
   - Chip `NASTAVENIA · Prispôsobte si Finvu`.
   - "Vitajte späť, Ján 👋" headline (22px light).

2. **2-col layout** (`settings-grid`, 220px + 1fr, collapses to 1-col mobile):

### Left rail tabs

Sticky, `var(--bg2)` radius 16. Per tab: ikona + label, active state has violet vertical accent bar (3px) on left + violet text + tinted bg.

### Content panel — Cards (`<Card title icon>{rows}</Card>`)

**Appearance section:**
- **Téma** card — 3 picker cards (`Tmavý / Svetlý / Systémový`) with miniature mock backgrounds. Active card: violet border + ring shadow.
- **Kompaktný režim** toggle.
- **Akcentová farba** — 8 colored swatches (36px circles), active = scale 1.12 + double ring + checkmark.

**Finance section:** Mena / Date format / Week start segmented / Language selectors.

**Notif section:** Push toggle / Budget alerts / Weekly digest / Reminders (fixed due / monthly goal).

**Security section:**
- **Prihlásenie** card: PIN setup button / Biometria toggle / Auto-lock select.
- **Aktívne relácie** card: list devices s "TÁTO" green badge na aktuálnej + "Odhlásiť" red button na ostatných.
- **Deaktivácia** card (danger): Vymazať tx / Reset app / Deaktivovať / **Zmazať účet** (red solid button).

**Data section:** Export (3 buttons JSON/CSV/PDF) / Import CSV from banks / Cloud backup toggle / Sync frequency / Last backup time.

**About section:** Logo + version + DM Mono build number + links (Webová stránka, Zásady, Podmienky, Licencie).

Footer pod gridom: `Finvu v2.0.0 · 2026 · Financie pod kontrolou` (DM Mono 11px center).

**Toggle component:** `42×24` rounded pill, `var(--violet)` on, white knob 18px with shadow.

**Row component:** Label + optional description (text3) + control on right, optional bottom border.

---

## 11 · Login (`/login`) — `LoginPage`

- Full screen centered, max-width 400px.
- Radial violet glow behind card (`top:15%, 500×500, opacity 0.12`).
- Logo 72px + "Finvu" 28px 700 + DM Mono "FINANCIE POD KONTROLOU" subtitle.
- Card radius 24, padding 26, elevated shadow.
- Inputs 50px tall, focus state violet border + violet glow ring.
- Submit button: violet gradient `135deg #8B5CF6 → #6D28D9`, shadow `0 4px 20px rgba(139,92,246,0.4)`, spinner v loading state.
- "alebo" divider (2 hairlines + label).
- Google sign-in: ghost button s Google G logo, `--bg3` background.
- "Nemáte účet? Registrovať sa →" link pod tým.

---

## 12 · AddModal (Pridať záznam)

Modal overlay `rgba(8,6,14,0.7) + blur(6px)`, z-index 200. Card max-width 480, radius 22, max-height 90vh, autoFocus na note input.

**Header:** Icon tile (color podľa typu) + title (`Nový {type}`) + close X.

**Type tabs** — len ak nie je opened z konkrétnej stránky (page-aware locking). 4 tabs: 💰 Príjem / 💸 Výdavok / 🔒 Fixný výdavok / 🏷️ Kategória. Active: bg `--bg2` + colored text.

**Common form fields** podľa typu:

- **Suma** field — bg `rgba(139,92,246,0.06)`, € prefix 22px violet DM Mono, value input 30px DM Mono. Skryté pre `category` typ.
- **Poznámka / Názov** — `inputSt` style (48px, radius 12, focus violet glow).
- **Kategória chips** (variable expense) — pill list z `CATS`, active state colored bg + outline.
- **Deň v mesiaci** (fixed) — number input 1–31.
- **Dátum** (income / variable) — date input.
- **Opakujúci príjem** toggle (income) — 44×24 violet switch.

**Category form (`type==='category'`):**
- Názov text input.
- **Ikona grid** — 16 emoji buttons (38×38), active outline + tinted bg.
- **Farba grid** — 8 colored 32px circles, active scale 1.12 + double ring + check.
- Voliteľný **Mesačný limit**.

**Footer:** Zrušiť ghost + Save button (`flex:2`, height 48, violet gradient + shadow, disabled state gray bg). Disabled iff no amount (or no name for category).

Save → call `toast()` + close. Pri kategórii append do CATS + `setExtraCats`. Pri prekročení 90 % limitu → warning toast.

---

## 13 · ProfileModal

Modal max-width 520, radius 24, 3 zones:

1. **Hero header gradient** `#1a1235 → #3d2a82 50% → #1a1235`. Atmosphere blob + sheen.
   - 72px avatar (gradient or photo or selected emoji) s biely-glow ring `0 0 0 3px rgba(255,255,255,0.15)`. Avatar editor pip (camera icon, 26px circle, `--bg2` bg, border `#3d2a82`).
   - Name (inline editable — click pencil → input replaces h2).
   - Email subtitle.
   - 👑 Pro badge (gold pill) + "Člen od {month}".
   - **Avatar emoji picker** — horizontal scroll row, 12 emojis + "no emoji" fallback (initial letter), top border hairline.

2. **Stats strip** (4 cols, divided by hairlines):
   - Transakcie / Úspory (green DM Mono) / Streak (orange + 🔥) / Sledovanie (violet, `N dní`).

3. **Tabs**: Profil / Účet / Úspechy (icons + labels), active bottom 2px violet border.

4. **Tab content scrollable:**

**Profile tab:**
- "Osobné údaje" group bg `--bg3` radius 13:
  - Meno (text)
  - Email + verified badge
  - Telefón
  - Krajina (🇸🇰 Slovensko)
- "Predvolené stránka" select.

**Account tab:**
- "Plán a fakturácia" gold gradient card: 👑 Finvu Pro + obnova date + Spravovať button.
- "Bezpečnosť" stack: Zmeniť heslo / 2FA / Pripojené zariadenia (každý s icon + label + hint subtitle + chev right).

**Achievements tab:**
- "Získané (3 z 8)" title + grid 2-col cards:
  - 8 achievements: 🎯 Prvý krok, 🔥 Týždeň v rade, 💰 Sporiteľ, 📊 Analytik, 🏆 Mesačný cieľ, ⚡ Rýchly, 👥 Tímový hráč, 💎 Veterán.
  - Locked → opacity 0.55, grayscale icon.
  - Unlocked → violet-tinted border + colored icon bg.

5. **Footer:** `Uložiť zmeny` button + `Odhlásiť` red ghost button.

---

## 14 · TxRow shared component

Reusable transaction row. Props: `t` (transaction), `compact` (bool), `onDelete` (fn).
- Hover bg `--bg3` + border `--border2`, transition 0.15s.
- Left: 44×44 (or 38×38 compact) colored icon tile (`💰` income, `cat.icon` expense, fallback `📦`).
- Middle: note/label (text, 14px or 13px compact) + DM Mono date + opt cat name.
- Right: hover-revealed trash button + DM Mono amount (green income, red expense).

---

## 15 · Tweaks panel

`TWEAK_DEFAULTS`:
```
{
  "theme": "dark",
  "accentColor": "#8B5CF6",
  "sidebarCollapsed": false
}
```

Tweaks:
- `TweakColor` accentColor — curated swatches `[violet, blue, green, pink]`.
- `TweakRadio` theme (`dark | light`).
- `TweakToggle` sidebarCollapsed.

Persist do localStorage `__tweaks_v1`.

---

## 16 · Mobile responsiveness

CSS breakpoint `1024px`:

```css
@media (min-width: 1024px) {
  .dt-only { display: flex !important }
  .mb-only { display: none !important }
  .dt-layout { display: grid !important; grid-template-columns: minmax(0,1fr) 280px }
  .mb-layout { display: none !important }
  .stat-grid { display: grid !important }
}
@media (max-width: 1023px) {
  .dt-only { display: none !important }
  .mb-only { display: flex !important }
  .dt-layout { display: none !important }
  .mb-layout { display: flex !important }
  .stat-grid { grid-template-columns: 1fr !important }
  .goal-detail { grid-template-columns: 1fr !important }
  .settings-grid { grid-template-columns: 1fr !important }
}
```

`isDesktop` state v `App` via `window.innerWidth >= 1024` + resize listener.

---

## 17 · A11y, micro-interactions a copy

- Focus rings: `0 0 0 3px rgba(139,92,246,0.1)` na všetkých inputs + buttons.
- ARIA labels na ikon-only buttons (trash, edit, close, theme toggle, notifications).
- Keyboard nav v Command Palette (↑↓ Enter Esc).
- Ripple effect na primary buttons (expanding white circle on click, `.ripple` class).
- Hover translateY(-1px) na primary CTA, translateY(-2px) na cards.
- `text-wrap: pretty` na všetkých textových blokoch.
- Číselné totals vždy cez `useCountUp` pri prvom mount alebo zmene mesiaca.
- DM Mono pre: dáta, počty, amounts, percent, dátumy v kompaktoch, kbd hints.
- DM Sans pre: titulky, body text, labels.
- Slovenčina + sk-SK formátovanie; dlhý dátum formát `štvrtok, 1. mája 2026`.

---

## 18 · Migrácia codebase — odporúčaný postup

1. **Tokens & globals first** — pridaj nové CSS premenné do `index.css`, animation keyframes + utility triedy.
2. **Shared primitives** — `Logo`, `Avatar`, `MonthSwitcher`, `SparklineMini`, `StreakBadge`, `TxRow`, `Toggle`, `Row`, `Card`. Mapuj 1:1 do `src/components/`.
3. **Globálne providery** — `ToastProvider`, `useToast`, `CommandPalette`, `NotificationCenter`, `Confetti`, `SwipeableRow`.
4. **Shell** — `AppNav`, `Topbar`, `BottomNav` + theme persistance + `⌘K` handler.
5. **Routy v poradí priority:**
   1. **Sporenie** (úplne nová — pridaj schema, migrácia, API endpointy, hooks).
   2. **Dashboard** (refresh layout, sparklines, donut, forecast).
   3. **Variabilné výdavky** (hero, search, group by date, swipe-to-delete).
   4. **Fixné výdavky** (hero, calendar strip, upcoming/past split).
   5. **Príjmy** (hero, KPI tiles, source breakdown).
   6. **Kategórie** (hero, drag-to-reorder, grid/list toggle).
   7. **Domácnosť** (hero + avatar stack, member cards, activity feed).
   8. **Nastavenia** (hero, left-rail tabs, 6 sekcií).
   9. **Login** + **ProfileModal**.
6. **AddModal** — page-aware locking.
7. **Tweaks** + persistence.
8. **Mobile**: BottomNav + responsive breakpoints + `.mb-only / .dt-only`.

Po každej route → screenshot porovnanie s mockupom + commit. Pýtaj sa pred zmenou DB schema, pridaním endpointu, alebo zmenou i18n kľúčov. Drž sa Drizzle migrations workflow.

---

**Reference:** zdrojový mockup `Finvu 2026 v2.html` (3428 riadkov) obsahuje všetok JSX inline ako React komponenty. Otvor v prehliadači a klikni cez všetky routy, stránky majú aj light/dark mode. Mock data konštanty (`CATS`, `VAR_EXPENSES`, `FIXED_EXP`, `INCOMES`, `SAVINGS_GOALS`, `SAVINGS_TXN`, `CHART_DATA`) sú referencia, v reálnej appke ich nahraď fetchom z `apps/api/`.
