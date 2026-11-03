# Claude UI implementation

User explicitly requested direct implementation by Claude Opus 5.5 at medium effort. The installed CLI edited an isolated public-source worktree, restricted to UI files. The returned model usage identified `claude-opus-5-5`. No backend, credentials or product model changes were delegated.

## Implementation handoff

I've finished the redesign, but none of it has been run. I didn't typecheck, build or open it in a browser, and `node_modules` isn't installed in this worktree. Please run `npm run typecheck` and look at screenshots before deploying.

I only changed the files you allowed. No logic, data or wording about claims was touched, and the Meta-only setup is unchanged. Everything new on screen (counts, checklists, timeline markers) comes from state the app already has.

**Files changed**
- `web/components/workspace.tsx` (rewritten)
- `web/components/training-studio.tsx` (edited)
- `web/components/evidence-tag.tsx` (adds "Reviewer self-attestation" and "Demonstration only" tags)
- `web/components/decision-test.tsx` (page title is now a proper top-level heading)
- `web/app/globals.css` (one new block appended at the end)

**Overview and navigation**
- **New Overview screen.** It's the default for first-time visitors. It has the main headline, a five-step strip (Observe → Infer → Ask → Freeze → Validate) linking to each view, a key to the evidence tags, and four start cards: zipper review, training guide, analyze your own video, and open a saved review.
- **Returning users** land on their last view, which is now saved in the browser; otherwise they go to Review if a saved workspace exists.
- **Grouped sidebar:** "Analyze a video" (Review, Expert questions, References, Revision history) and "Teach and test" (Training guide, Decision test). The guide now has its own icon. On narrow screens the groups flatten into one row.
- **Mode tag in the top bar** on analysis views: "Synthetic · scripted data" or "Model analysis · needs expert review". It's hidden on phones, where the page heading still states it.
- **Focus moves to the new page heading** when you change views, so screen readers announce the change.

**Review screen**
- **Three columns:** list of observed actions on the left, video and observed evidence in the centre, inferred reasoning on the right. Below 1280px the list moves under the video; below 850px everything stacks.
- **Action list** uses arrow keys and Home/End, keeps the selected row in view, and marks actions linked to a rule.
- **Marker strip under the video** shows each action and a playhead. Clicking a marker selects the action. While the video plays, the selection follows it, but only while playing, so it never overrides a manual choice.
- **Selected action panel** sits right under the video, with previous/next buttons and "Play from mm:ss". Visible evidence, speaker testimony and model inference each get a different left-edge rule (solid, dotted, dashed), so they differ by shape, not just colour.
- **Principle cards:** the "Ask the expert" box comes first and opens that question's text box directly. The reasoning is cut to three lines with a "Read full reasoning" button. Alternatives, reference check (with counts of exact and unvalidated citations) and applicability are collapsible rows. The disclaimer footnote stays pinned at the bottom of the column.
- **Status pill** shows the real count of open expert questions; there's no hardcoded text left.
- **Crash fix:** the screen no longer breaks if the selected action index is out of range.

**Training guide**
- **Toolbar:** Save session stays visible; New guide, Open and Restore previous moved into a "More" menu.
- **Messages:** errors, notices and progress now share one status line instead of stacked boxes. Errors can be dismissed.
- **Prepare stage** has two columns. The right column is a sticky panel with the readiness checklist (each item jumps to its section), a training/questions/validation split bar, and the Propose button. The note about the two Meta requests stays visible next to the button.
- **Case rows** now show a number, the split, and whether the outcome is labelled. Validation outcomes always show as "Reserved", so nothing leaks before freezing.
- **Progress:** the rules stage shows rules proposed, rules that fit known cases, answers recorded and revisions used (out of 3). Validation shows a bar of how many reference outcomes are entered. The frozen guide shows its demo or attestation tag plus a "Frozen" badge.
- **Public demo:** server operations are disabled exactly as before. The only change is that the setup notes now say "disabled in this public demo" instead of telling visitors to add an API key.

**Risks to check**
- **Brief flash on load.** The server always renders the Overview first, so returning users may see it for a moment before their saved view appears.
- **Starting view changed.** First-time visitors now land on Overview instead of Review. If your demo video or tests assume they open on Review, update them, or start from the sidebar.
- **Unverified icons.** I couldn't confirm that `Compass`, `GraduationCap`, `ChevronDown`, `RotateCcw` and `Lock` exist in lucide 0.577. They're long-standing icons, but typecheck will confirm.
- **Pinned elements:** the action list and disclaimer stick in place because I removed the old `overflow:hidden` on the review grid. Check that the rounded corners still look clean.
- **The "More" menu** is a native disclosure element, so clicking outside doesn't close it; it closes after picking an option.
- **Cases are still collapsible rows, not a table.** I didn't convert them, to avoid touching form state.
- **Minimum text size** is now 11px everywhere I found smaller sizes.
- **Reduced motion** is still honoured: smooth scrolling and transitions turn off with the existing setting.

Parent review and verification are recorded in subsequent commit history.
