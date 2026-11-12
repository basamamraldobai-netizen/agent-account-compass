<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Excel import/matching logic lives in pure functions in src/lib/wakilio/engine.ts (tested); UI in src/components/wakilio. Data persists per signed-in user in Lovable Cloud; useWakilioStore diffs state changes and syncs them, so UI code keeps the simple setState API.
- Keep the shared WAKILIO store provider and workspace shell in the _authenticated layout (all app pages require sign-in, rows are owner-scoped by RLS) so dashboard, imports, agents and suggestions share existing records and aliases across navigation.
- Express workspace styling through semantic global tokens and the shared Button variants to keep the reference design consistent without coupling it to Excel engine logic.
- Public landing (with the live login card) owns `/`; the signed-in workspace home is `/dashboard`, so signed-out visitors land on marketing and signed-in users are redirected in.
- Derive shared-receipt person rows in the pure accounting engine, retaining original Cloud transactions and stable person keys; this preserves re-import identity and allows existing saved receipts to use the same processing. Uncertain later allocations remain unassigned to passports, with the receipt counted once in agent totals and disclosed in details. Manual allocations are stored separately (keyed by the source transaction id) and applied by the engine only when checkAllocation confirms the shares add up exactly, so imported rows are never modified and an allocation can be removed to revert.
- Agent rename and multi-name merge both go through pure alias rewrites in engine.ts (renameAgent/mergeAgents) so every alias follows the canonical name without cycles, and raw Excel names stay untouched for unmerge.
- Tracked saves (Excel imports) pass { track: fileName } to the store's setState; the store reports per-batch progress as `sync`, so the progress window reflects real saved rows rather than a timer.
- Passport statement ordering uses a tested display-only Arabic collation helper; keep accounting and transaction chronology unchanged when ordering visible rows.
- Agent summaries and shared receipts are computed once in WakilioProvider (useWakilioSummary) so pages and the sidebar counter stay consistent and avoid repeated recalculation.
- Agents-list smart search is a pure, tested module (src/lib/wakilio/agent-search.ts) that pre-normalizes fields once per summary change, so large files stay fast and match reasons stay consistent; it is scoped to the agents list only.
