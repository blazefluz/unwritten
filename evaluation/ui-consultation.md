# UI consultation

Requested by Victor: Claude Opus 5.5, medium effort.
Run through the installed Claude Code CLI with tools disabled; the returned model usage identified `claude-opus-5-5`. Only public UI source was supplied. This is development feedback, not a product model integration.

# Unwritten UI critique and five improvements

## Critique

**The core idea isn't visible in the layout.** The product's thesis is *observed ≠ inferred ≠ testimony ≠ attested*. Right now that distinction lives only in copy: small grey labels like "What is visible", "Inferred principle" and "testimony". Visually, an observed fact and a model guess look identical. A judge skimming for 30 seconds won't see the idea.

**Review view problems:**
- **The selected event is split across both columns.** "What is visible" sits below a 310px scrolling list in the left column. The reasoning for the same event is in the right column. The user's eye has to zig-zag to follow one event.
- **The video gets too little space.** The two columns are nearly equal (1.28fr / 1fr), so the video shares its column with the list and the evidence.
- **The reasoning card is a wall of text.** It shows claim, reasoning, alternatives, explanation, citations, applicability, errors and the expert prompt in sequence. The most important action, "Ask the expert", comes last.
- **The selected-event marker is too faint.** It is a 1px orange line.
- **There are two play buttons.** A custom play button sits next to the native `controls`.
- **"Ready for expert review" is hardcoded.** It shows regardless of state.
- **Text is too small for a projector.** There is a lot of 9–10px type (`.file-type`, `.citation-meta`, `.badge`, `.count`, `.tiny-label`). This hurts legibility in a judge demo and fails practical accessibility.

**Training guide problems:**
- **First-time users land in the hardest place.** The default `view` is `"guide"`, so a first-time user lands on the densest screen.
- **The stage tabs are cosmetic.** All stages are clickable at any time, and nothing shows what's done, current or blocked. They also use `role="tab"` without `tabpanel`, `aria-controls` or arrow-key support.
- **Stage 1 is one long scroll.** It contains guide fields, features and up to 100 `<details>` accordions. Readiness is reported as one sentence: "Add a guide name, task, …". The user has to work out what's missing.
- **The toolbar is crowded.** Four equal-weight buttons (New, Open, Save, Restore previous) compete with the primary flow.
- **Notices stack up.** Error, notice, busy and sample notices all render as similar boxes above the content.

**Navigation and small issues:**
- "Training guide" and "References" share the `BookOpen` icon.
- The nav order doesn't follow the workflow.
- **A crash risk:** `data.events[selected].id` throws if `events` is empty. Guard `event` before computing `linked`.

---

## Five improvements

### 1. Make the type of evidence visible everywhere with a "tier" component

Create one component and use it consistently. It is the visual backbone of the demo.

```tsx
type Tier = "observed" | "testimony" | "inferred" | "attested" | "demo";
const tierLabel = {observed:"Observed", testimony:"Testimony", inferred:"Model inference", attested:"Reviewer attested", demo:"Demonstration only"};
export function TierTag({tier}:{tier:Tier}) {
  return <span className={`tier tier-${tier}`}><span aria-hidden className="tier-mark"/>{tierLabel[tier]}</span>;
}
```

```css
.tier{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:550;letter-spacing:.02em;text-transform:uppercase}
.tier-mark{width:10px;height:10px;border:1.5px solid currentColor}
.tier-observed{color:var(--ink)}        .tier-observed .tier-mark{background:var(--ink)}
.tier-testimony{color:var(--muted)}     .tier-testimony .tier-mark{border-radius:50%}
.tier-inferred{color:var(--accent-ink)} .tier-inferred .tier-mark{border-style:dashed}
.tier-attested{color:var(--green)}      .tier-attested .tier-mark{background:var(--green)}
.tier-demo{color:var(--muted)}          .tier-demo .tier-mark{background:repeating-linear-gradient(45deg,currentColor 0 2px,transparent 2px 4px)}
/* matching block treatment */
.block-observed{border-left:3px solid var(--ink);padding-left:14px}
.block-inferred{border-left:3px dashed var(--accent);padding-left:14px}
.block-testimony{border-left:3px dotted var(--muted);padding-left:14px}
```

The tiers differ in **shape** (solid, dashed, dotted, circle, striped), not just colour, so the system still works for colour-blind users and in greyscale.

Where to apply it:
- **Review:** visible evidence, speaker explanation and each principle card.
- **Guide:** recorded answers, the frozen badge and the validation table headers.

Also replace the scattered `.sample-notice` lines with one **mode chip in the topbar**, computed from the existing `synthetic` and `published` checks:
- "Synthetic · scripted"
- "Published-video pilot · not human-verified"
- "Your analysis"

It stays visible on every view, which is the honesty guarantee judges will look for.

### 2. Restructure Review into Timeline → Observed → Inferred

Use three columns that read left to right in the order of the product's logic.

```css
.review-grid{grid-template-columns:260px minmax(0,1.5fr) minmax(340px,1fr);align-items:start}
.timeline-rail{position:sticky;top:0;max-height:calc(100dvh - 76px);overflow:auto;border-right:1px solid var(--line)}
.event-row.selected:before{width:3px}            /* was 1px */
.observed-card{margin-top:16px}                  /* .block-observed, directly under the video */
@media(max-width:1280px){.review-grid{grid-template-columns:minmax(0,1.3fr) minmax(320px,1fr)}
  .timeline-rail{grid-column:1;grid-row:2;position:static;max-height:320px;border-right:0;border-top:1px solid var(--line)}}
```

Changes by column:
- **Left rail:** the event list moves here as a full-height list with its own scroll. The `max-height:310px` box goes away.
- **Centre:** video, then a timeline strip, then the **observed card** with "What is visible", testimony and uncertainties. The observed facts now sit right under the footage they describe.
- **Right:** the inferred principles only.

Add a **marker strip under the video** built from real data. Use `left: time_start / max(video.duration, lastEvent.time_end) * 100%`. Each marker is a `<button aria-label="Event 3, 01:12">` that calls `pick(i)`. The selected marker is 3px orange, the rest 1px `--line`.

On playback, auto-highlight the event whose range contains `currentTime`. Only do this while `playing`, so it doesn't fight manual selection.

Further fixes:
- **Keyboard:** add ArrowUp/ArrowDown on the rail using a roving `tabIndex`. Keep `aria-pressed`, or switch to `role="listbox"` with `aria-activedescendant`.
- **Play button:** remove the custom one in `.video-footer` and keep the native controls. Keep the timestamp and filename.
- **Status:** replace the hardcoded "Ready for expert review" with a real count, e.g. `{unanswered} of {questions.length} expert questions open`. If none are open, show nothing.

### 3. Turn principle cards into a summary with an action first and details on demand

Restructure each `.principle` card:

```
[TierTag inferred]                       [Model: supported ▾]
Claim (h3, 21px)
Reasoning — clamped to 3 lines  [Read full reasoning]
┌ Ask the expert ─────────────────────────────┐   ← moved up, soft orange bg
│ question text                [Answer →]     │
└─────────────────────────────────────────────┘
Evidence ▸  Alternatives (2) · References (1 exact) · Applicability
```

```css
.reasoning-copy.clamped{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.expert-prompt{order:-1;background:var(--soft);border:0;border-radius:6px;padding:14px 16px;margin:16px 0}
.principle-details{display:flex;gap:18px;border-top:1px solid var(--line);padding-top:14px;font-size:12px}
.principle-details summary{list-style:none;color:var(--muted)} .principle-details [open]>summary{color:var(--accent-ink)}
```

- **Expand toggle:** a `<button aria-expanded>` toggles `clamped`.
- **Evidence row:** alternatives, citations and applicability stay as `<details>`, laid out in one horizontal row. The citation count shows exactness in the summary itself, e.g. "References · 1 exact, 1 unvalidated".
- **Answer button:** it should deep-link. Pass the question ID, e.g. `setView("questions")` plus `setFocusQuestion(h.id)`, then scroll to and focus that textarea.
- **Disclaimer:** keep the existing footnote ("Model assessments need expert review…"), but make it sticky to the bottom of the right column so it's always visible.

### 4. Make the Training guide a gated stepper with a live readiness checklist

**a. Stepper.** Replace the tab bar with a real stepper whose state comes from data that already exists:

```tsx
const status = (s:Stage) =>
  s==="cases"      ? (session.study ? "done" : "current") :
  s==="rules"      ? (!session.study ? "locked" : session.frozen ? "done" : "current") :
  s==="review"     ? (session.frozen ? "done" : active.length ? "current" : "locked") :
  /* validation */   (!session.frozen ? "locked" : session.validation ? "done" : "current");
<ol className="guide-stepper">{stages.map(s => <li key={s.id} data-state={status(s.id)}>
  <button aria-current={stage===s.id?"step":undefined} onClick={()=>setStage(s.id)}>…</button></li>)}</ol>
```

```css
.guide-stepper{display:grid;grid-template-columns:repeat(4,1fr);counter-reset:s;border-top:2px solid var(--line);margin-bottom:28px}
.guide-stepper li{list-style:none;counter-increment:s;margin-top:-2px;border-top:2px solid transparent}
.guide-stepper li[data-state=done]{border-top-color:var(--ink)}
.guide-stepper button[aria-current=step]{color:var(--accent-ink)} .guide-stepper li:has([aria-current]){border-top-color:var(--accent)}
.guide-stepper button::before{content:counter(s,decimal-leading-zero);display:block;font-size:22px;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.guide-stepper [data-state=locked] button{color:#9b9ca2}
```

Locked steps stay clickable, because their existing empty states explain what's needed. They just look secondary. This replaces the incomplete `role="tab"` semantics with `aria-current="step"`, which is correct for a stepper.

**b. Two-column Stage 1.** Use `grid-template-columns:minmax(0,1fr) 300px`. The right column is a **sticky readiness checklist** built from the existing `canPropose` conditions, split into separate checks:
- ✓ Guide name
- ✓ Decision to teach
- ✗ Observable feature (0)
- ✗ Attributed training outcomes 1/2
- ✓ Question case
- ✗ Validation case

Each row is a button that scrolls to the relevant section. The **Propose competing rules** button and the "two Meta requests" disclosure move into this column, so the primary action is always visible. Below it, show a real split bar (`training / questions / validation`) as three flex segments sized by count, labelled with numbers.

**c. Cases as a table, not 100 accordions.** Use one row per case: summary, use-for, one column per feature, outcome, label source. Put it in `.guide-table-wrap` with a sticky first column. Inline `<select>`s keep editing fast. "Edit details" opens the existing field group in an expandable row, `<tr hidden>` toggled with `aria-expanded`.

**d. Session menu.** Collapse New, Open, Save and Restore previous into one "Session" menu button, with Save also kept as a visible secondary. Merge error, notice and busy into one status line under the stepper (`aria-live="polite"`, errors keep `role="alert"`) instead of three stacked boxes.

### 5. Add a first-run Start screen and grouped navigation

**a. Start view.** Add a `"start"` view and make it the default when `localStorage` has no saved workspace or guide. Restored users still land where they were. It holds:
- A one-line promise in the existing voice ("Every expert has a way.").
- A **five-step strip**: Observe → Infer → Ask → Freeze → Validate. Each step is a number, a short label and a one-line description, linked to its view. The same vocabulary appears in the stepper and the nav.
- **Three start cards**, each carrying its honesty tag from improvement 1:

| Card | Tag | Action |
|---|---|---|
| Explore the scripted example | Synthetic · offline | Opens Review on the bundled synthetic workflow |
| Load the cable pilot | Published video · not human-verified | Calls the existing cable-pilot loader |
| Analyze your own video | Requires Meta API | Opens `new`; disabled with the existing setup note when `!ready` |

```css
.start-steps{display:grid;grid-template-columns:repeat(5,1fr);border-top:2px solid var(--ink)}
.start-steps a{padding:16px 16px 0 0;text-decoration:none}
.start-steps b{display:block;font-size:28px;font-weight:500;letter-spacing:-1px;color:var(--accent)}
.start-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
.start-card{border:1px solid var(--line);border-radius:8px;padding:22px;text-align:left;display:grid;gap:10px;background:var(--surface)}
.start-card:hover{border-color:var(--ink)}
@media(max-width:900px){.start-steps,.start-cards{grid-template-columns:1fr}}
```

**b. Grouped nav.** Group the sidebar by workflow:
- **Analyze:** Review, Expert questions, References (`FileText`), Revision history.
- **Teach:** Training guide (`GraduationCap`), Decision test.

Add an "Overview" item for the Start view.

**c. Focus and type scale.**
- On every `setView`, move focus to the new `h1`: `useEffect(() => document.querySelector<HTMLElement>("main h1")?.focus(), [view])`, with `tabIndex={-1}` on the headings. Screen-reader users then hear the page change.
- Set an 11px minimum font size. Bump all 9px and 10px declarations: `.file-type`, `.citation-meta`, `.badge`, `.count`, `.tiny-label`, `.subtle`, `.review-footnote`, `.workspace-footer`. At projector distance this is the cheapest polish win.

---

**Suggested order for the demo:**
1. Improvement 5 (first impression).
2. Improvement 1 (makes the thesis legible).
3. Improvement 2 (the Review screen judges will watch).
4. Improvement 4 (the guide flow).
5. Improvement 3 (polish).

None of these change data, providers, scoring or claims. Every count, checklist item and marker comes from state the app already has.
