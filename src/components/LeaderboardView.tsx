import { useEffect, useState } from "react";
import { getLeaderboardServerFn } from "../api/submissions";
import { Trophy, Shield, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

type LeaderboardEntry = {
  username: string;
  total_score: number;
  stages_completed: number;
  case_concluded: boolean;
  last_activity_at: string;
};

export function LeaderboardView() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await getLeaderboardServerFn();
      setConnected(response.connected);
      setEntries((response.entries as LeaderboardEntry[]) || []);
      setMessage(response.message || "");
    } catch {
      setConnected(false);
      setMessage("Failed to reach server leaderboard endpoint.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-primary">
            <Trophy className="h-5 w-5" />
            OPERATIONAL LEADERBOARD — CASE 07
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Authoritative, server-validated investigator rankings across all five forensic stages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
              connected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-warning/40 bg-warning/10 text-warning"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-warning animate-pulse"
              }`}
            />
            {connected ? "DATABASE SYNCED" : "OFFLINE / LOCAL"}
          </div>

          <button
            onClick={loadLeaderboard}
            disabled={loading}
            className="flex items-center gap-1.5 border border-border px-3 py-1 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> REFRESH
          </button>
        </div>
      </div>

      {!connected && (
        <div className="border border-border bg-background p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-mono text-warning">
            <AlertCircle className="h-4 w-4" />
            LIVE LEADERBOARD NOTICE
          </div>
          <p className="mt-1 leading-relaxed">
            {message ||
              "Supabase database credentials are not yet configured in environment variables."}
            <br />
            Scores for local runs are validated on the server, but public rankings will populate
            once Supabase keys are configured and the SQL migration has been applied.
          </p>
        </div>
      )}

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-left font-mono text-xs">
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Investigator</th>
              <th className="p-3">Stages Cleared</th>
              <th className="p-3">Total Score</th>
              <th className="p-3">Investigation Status</th>
              <th className="p-3">Last Submission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length > 0 ? (
              entries.map((entry, idx) => (
                <tr key={entry.username} className="hover:bg-muted/20">
                  <td className="p-3 font-bold text-primary">#{idx + 1}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      {entry.username}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold">{entry.stages_completed}</span> / 5 Stages
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-foreground">{entry.total_score}</span> / 500 Pts
                  </td>
                  <td className="p-3">
                    {entry.case_concluded ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> CONCLUDED
                      </span>
                    ) : (
                      <span className="text-[10px] text-warning">ACTIVE INQUIRY</span>
                    )}
                  </td>
                  <td className="p-3 text-[11px] text-muted-foreground">
                    {entry.last_activity_at
                      ? new Date(entry.last_activity_at).toLocaleTimeString()
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {loading
                    ? "Loading leaderboard rankings..."
                    : "No verified participant submissions recorded yet. Complete stages to earn your place on the board."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
