import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ClipboardCheck, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { getAdminSubmissionsServerFn } from "../api/submissions";
import type { AdminSubmission } from "../server/admin.server";

const PAGE_SIZE = 50;
const STAGE_NAMES: Record<number, string> = {
  1: "Network Investigation",
  2: "Access Investigation",
  3: "Evidence Analysis",
  4: "Witness Investigation",
  5: "Incident Response",
};

export function AdminPortal({ authToken }: { authToken?: string | undefined }) {
  const [entries, setEntries] = useState<AdminSubmission[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stageFilter, setStageFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(
    async (reset: boolean, offset = 0) => {
      if (!authToken) {
        setEntries([]);
        setTotalCount(0);
        setError("Sign in with an administrator account to review responses.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await getAdminSubmissionsServerFn({
          data: {
            authToken,
            offset: reset ? 0 : offset,
            stageId: stageFilter ? Number(stageFilter) : null,
            search: appliedSearch,
          },
        });
        if (!response.authorized) {
          setEntries([]);
          setTotalCount(0);
          setError(response.message || "Administrator access is required.");
          return;
        }
        setEntries((current) => (reset ? response.entries : [...current, ...response.entries]));
        setTotalCount(response.totalCount);
      } catch {
        setError("Could not load participant responses. Please retry.");
      } finally {
        setLoading(false);
      }
    },
    [authToken, appliedSearch, stageFilter],
  );

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border border-border bg-card p-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-primary">
            <ShieldCheck className="h-5 w-5" /> ADMIN RESPONSE REVIEW
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Private review of participant submissions and their recorded answers.
          </p>
        </div>
        <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
          <ClipboardCheck className="h-3.5 w-3.5" /> ADMIN ONLY
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-card p-4">
        <form onSubmit={submitSearch} className="flex min-w-60 flex-1 gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search investigator username</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={80}
              placeholder="Search investigator"
              className="w-full border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="border border-primary/50 px-3 py-2 font-mono text-[10px] uppercase text-primary hover:bg-primary/10"
          >
            Search
          </button>
        </form>

        <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
          Stage
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="border border-border bg-background px-2 py-2 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="">All stages</option>
            {Object.entries(STAGE_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {id}. {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void loadPage(true)}
          disabled={loading}
          className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{totalCount} recorded submissions</span>
        <span>
          Showing {entries.length} / {totalCount}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[760px] text-left font-mono text-xs">
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Investigator</th>
              <th className="p-3">Stage</th>
              <th className="p-3">Score</th>
              <th className="p-3">Result</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Recorded response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id} className="align-top hover:bg-muted/20">
                <td className="p-3 font-semibold text-foreground">{entry.username}</td>
                <td className="p-3">
                  {entry.stage_id}. {STAGE_NAMES[entry.stage_id] || "Unknown stage"}
                </td>
                <td className="p-3 font-bold">{entry.score} / 100</td>
                <td className="p-3">
                  <span className={entry.completion_status ? "text-emerald-400" : "text-warning"}>
                    {entry.completion_status ? "PASSED" : "IN PROGRESS"}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(entry.submitted_at).toLocaleString()}
                </td>
                <td className="p-3">
                  <details className="max-w-[32rem]">
                    <summary className="cursor-pointer text-primary hover:text-primary/80">
                      View answers and score breakdown
                    </summary>
                    <div className="mt-3 space-y-3">
                      <ResponseData title="Participant answers" value={entry.payload} />
                      <ResponseData title="Scoring breakdown" value={entry.breakdown} />
                    </div>
                  </details>
                </td>
              </tr>
            ))}
            {!entries.length && !loading && !error && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  No submissions match these filters.
                </td>
              </tr>
            )}
            {!entries.length && loading && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  Loading participant submissions…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {entries.length < totalCount && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadPage(false, entries.length)}
            disabled={loading}
            className="border border-border px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {loading
              ? "Loading…"
              : `Load next ${Math.min(PAGE_SIZE, totalCount - entries.length)} submissions`}
          </button>
        </div>
      )}
    </section>
  );
}

function ResponseData({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-border bg-background p-3 text-[11px] leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2) ?? "No data recorded."}
      </pre>
    </div>
  );
}
