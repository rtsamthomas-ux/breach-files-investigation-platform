import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { AccessInvestigation } from "../components/AccessInvestigation";
import { EvidenceLab } from "../components/EvidenceLab";
import { WitnessInvestigation } from "../components/WitnessInvestigation";
import { IncidentResponse } from "../components/IncidentResponse";
import { LeaderboardView } from "../components/LeaderboardView";
import { AuthModal } from "../components/AuthModal";
import { getSupabaseClient } from "../lib/supabase-client";
import { submitStageServerFn } from "../api/submissions";
import { getCompletedStagePrefix } from "../lib/stage-progress";
import {
  LayoutDashboard,
  Network,
  KeyRound,
  FileSearch,
  Users,
  ShieldAlert,
  Lock,
  ChevronRight,
  Target,
  CheckCircle2,
  CircleDot,
  Fingerprint,
  ArrowLeft,
  Search,
  Bookmark,
  BookmarkCheck,
  Filter,
  Clock3,
  AlertTriangle,
  Send,
  RotateCcw,
  ClipboardList,
  Trophy,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";

const AdminPortal = lazy(() =>
  import("../components/AdminPortal").then((module) => ({ default: module.AdminPortal })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Breach Files - Case 07: The Glasshouse Incident" },
      {
        name: "description",
        content: "Interactive cyber-forensics simulation at NovaCorp.",
      },
      { property: "og:title", content: "The Breach Files - Case 07" },
      {
        property: "og:description",
        content: "Investigate the Glasshouse Incident at NovaCorp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Icon = ComponentType<{ className?: string }>;
type View = "overview" | string;

type Stage = {
  id: number;
  key: string;
  title: string;
  desc: string;
  icon: Icon;
};

type EvidenceCategory = "NETWORK" | "DNS" | "AUTH" | "EXPORT" | "SYSTEM";

type EvidenceRecord = {
  id: string;
  time: string;
  category: EvidenceCategory;
  source: string;
  title: string;
  summary: string;
  detail: string;
  tags: string[];
};

const STAGES: Stage[] = [
  {
    id: 1,
    key: "network",
    title: "Network Investigation",
    desc: "Correlate network, DNS, authentication, and export records.",
    icon: Network,
  },
  {
    id: 2,
    key: "access",
    title: "Access Investigation",
    desc: "Examine who held access to the restricted roadmap.",
    icon: KeyRound,
  },
  {
    id: 3,
    key: "evidence",
    title: "Evidence Analysis",
    desc: "Inspect artifacts tied to the export workflow.",
    icon: FileSearch,
  },
  {
    id: 4,
    key: "witness",
    title: "Witness Investigation",
    desc: "Weigh statements and competing explanations.",
    icon: Users,
  },
  {
    id: 5,
    key: "response",
    title: "Incident Response",
    desc: "Recommend a defensible containment response.",
    icon: ShieldAlert,
  },
];

const EVIDENCE_SUMMARY = [
  { label: "Network events", count: 6, icon: Network },
  { label: "Access records", count: 15, icon: KeyRound },
  { label: "Evidence artifacts", count: 14, icon: FileSearch },
  { label: "Witness interviews", count: 4, icon: Users },
];

const EVIDENCE: EvidenceRecord[] = [
  {
    id: "SCH-01",
    time: "09:32:08",
    category: "SYSTEM",
    source: "ExportBridge scheduler",
    title: "Scheduled job initiated",
    summary: "A scheduled ExportBridge workflow starts.",
    detail:
      "Job ID EB-2041 entered RUNNING state at 09:32:08 UTC. The execution identity is svc-exportbridge. The scheduler record does not identify a person who configured the job or establish who may have changed its parameters.",
    tags: ["scheduled", "service identity"],
  },
  {
    id: "DNS-02",
    time: "09:33:11",
    category: "DNS",
    source: "Internal DNS resolver",
    title: "Internal storage hostname resolved",
    summary: "The worker resolves an internal storage hostname.",
    detail:
      "Host export-worker-03 queried vault-store.novacorp.internal. The resolver returned an internal address. This is consistent with internal service communication; it is not evidence of an external destination.",
    tags: ["internal DNS", "storage"],
  },
  {
    id: "NET-03",
    time: "09:34:26",
    category: "NETWORK",
    source: "Network flow collector",
    title: "Worker connects to internal storage",
    summary: "An internal connection is recorded.",
    detail:
      "A TCP connection from export-worker-03 to the internal storage address lasted 18 seconds. The flow record contains endpoints, timestamps, and byte counts, but no application-level confirmation of which document was read.",
    tags: ["internal traffic", "flow record"],
  },
  {
    id: "APP-04",
    time: "09:36:14",
    category: "EXPORT",
    source: "Application gateway",
    title: "Restricted roadmap requested",
    summary: "A request targets Project Glasshouse.",
    detail:
      "A gateway request associated with svc-exportbridge targets /projects/glasshouse/roadmap. The gateway record confirms the request reached the application layer. By itself, this record does not prove the complete document was returned.",
    tags: ["resource request", "Glasshouse"],
  },
  {
    id: "AUTH-05",
    time: "09:36:18",
    category: "AUTH",
    source: "Identity audit service",
    title: "Service identity token accepted",
    summary: "The application accepts a service identity token.",
    detail:
      "The token subject is svc-exportbridge and the audience is the internal document service. The record does not contain an employee username. Token acceptance shows which identity was presented, not which person initiated the underlying activity.",
    tags: ["service account", "token"],
  },
  {
    id: "DOC-06",
    time: "09:37:02",
    category: "EXPORT",
    source: "Document audit log",
    title: "Successful document read",
    summary: "The roadmap audit entry reports a successful read.",
    detail:
      "The document audit service records READ_SUCCESS for the Glasshouse roadmap under svc-exportbridge. This is stronger evidence of access than the gateway request alone. It does not establish external transmission or malicious intent.",
    tags: ["read success", "audit"],
  },
  {
    id: "NET-07",
    time: "09:37:45",
    category: "NETWORK",
    source: "Network flow collector",
    title: "Short connection to an internal endpoint",
    summary: "A second internal connection is observed.",
    detail:
      "The worker connects to an internal package service. The connection is brief and its byte count is modest. The flow record alone cannot establish whether the roadmap contents were transferred in this connection.",
    tags: ["internal traffic", "incomplete context"],
  },
  {
    id: "DNS-08",
    time: "09:38:02",
    category: "DNS",
    source: "Internal DNS resolver",
    title: "Public domain lookup by another host",
    summary: "A different workstation queries a public domain.",
    detail:
      "The source is design-laptop-12, not export-worker-03. The query is for updates.example.net. The record has no demonstrated link to the Glasshouse workflow. Similar timestamps do not establish that the two activities are related.",
    tags: ["different host", "possible decoy"],
  },
  {
    id: "EXP-09",
    time: "09:39:41",
    category: "EXPORT",
    source: "ExportBridge worker",
    title: "Package staged for processing",
    summary: "The workflow records an export package as staged.",
    detail:
      "Job EB-2041 records PACKAGE_STAGED with package ID PKG-8842. Staging establishes that a package reached a workflow state ready for further processing. This record does not establish that a remote destination received the package.",
    tags: ["package staged", "PKG-8842"],
  },
  {
    id: "NET-10",
    time: "09:39:53",
    category: "NETWORK",
    source: "Egress monitoring",
    title: "No matching transfer in the supplied window",
    summary: "The supplied egress extract has no matching transfer entry.",
    detail:
      "The provided extract covers the monitored egress interfaces from 09:30:00 to 09:45:00 UTC. It contains no flow matching package ID PKG-8842 because the flow collector does not record package IDs. It also contains no obvious large outbound flow correlated to export-worker-03 in this window. This extract alone cannot prove that no transfer occurred through any possible path.",
    tags: ["bounded search", "absence of evidence"],
  },
  {
    id: "AUTH-11",
    time: "09:40:00",
    category: "AUTH",
    source: "Security monitoring",
    title: "Investigation alert generated",
    summary: "Monitoring flags the workflow activity.",
    detail:
      "An alert was generated after the combination of a restricted-resource event and export staging. The alert is a detection signal that warrants investigation. It is not independent proof of theft, an external recipient, or a malicious employee.",
    tags: ["alert", "detection"],
  },
  {
    id: "SYS-12",
    time: "09:40:31",
    category: "SYSTEM",
    source: "ExportBridge worker",
    title: "Job reports successful completion",
    summary: "The workflow ends with a successful status.",
    detail:
      "Job EB-2041 reports COMPLETED. The worker's status refers to its own workflow execution. The supplied log does not define COMPLETED as confirmation of external delivery, and it contains no recipient acknowledgement.",
    tags: ["job status", "semantic ambiguity"],
  },
  {
    id: "NET-13",
    time: "09:41:06",
    category: "NETWORK",
    source: "Proxy summary",
    title: "Large outbound flow from a different system",
    summary: "A large transfer is recorded, but attribution is unclear.",
    detail:
      "A proxy summary reports a large outbound flow from build-cache-02 to a vendor update endpoint. The source host differs from export-worker-03. The record has no package ID, document identifier, or recipient confirmation linking it to PKG-8842.",
    tags: ["large transfer", "different host"],
  },
  {
    id: "AUTH-14",
    time: "09:42:20",
    category: "AUTH",
    source: "Identity audit service",
    title: "Interactive login by an analyst",
    summary: "An analyst signs in to the case-management portal.",
    detail:
      "An interactive login by analyst account analyst.lee is recorded against the internal case-management portal. The supplied event does not show access to the roadmap or control of job EB-2041. A username appearing in the same time window is not enough to attribute the incident to that person.",
    tags: ["interactive login", "attribution"],
  },
  {
    id: "SYS-15",
    time: "09:44:12",
    category: "SYSTEM",
    source: "Configuration audit",
    title: "Workflow configuration changed earlier",
    summary: "A configuration version differs from the previous version.",
    detail:
      "The configuration audit shows ExportBridge version 17 was active during the incident window. A previous version had a different export scope. The supplied record does not include the full change diff, approver identity, or evidence that this version change caused the event. Obtain the full audit history before assigning responsibility.",
    tags: ["configuration", "missing context"],
  },
];

const CATEGORIES = ["ALL", "NETWORK", "DNS", "AUTH", "EXPORT", "SYSTEM"] as const;

function Dashboard() {
  const [completed, setCompleted] = useState(0);
  const [view, setView] = useState<View>("overview");
  const [user, setUser] = useState<{
    id: string;
    email?: string | undefined;
    username?: string | undefined;
    role?: string | undefined;
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const refreshSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          setAuthToken(session.access_token);
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, role")
            .eq("id", session.user.id)
            .maybeSingle();

          setUser({
            id: session.user.id,
            email: session.user.email,
            username: profile?.username || session.user.user_metadata?.["username"],
            role: profile?.role || "participant",
          });

          const { data: progressData } = await supabase
            .from("user_progress")
            .select("completed_stages")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (progressData?.completed_stages && Array.isArray(progressData.completed_stages)) {
            setCompleted(getCompletedStagePrefix(progressData.completed_stages).length);
          }
        }
      } catch (err) {
        console.warn("Auth initialization note:", err);
      }
    };

    void refreshSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Supabase advises deferring auth calls until after the auth callback returns.
        setTimeout(() => void refreshSession(), 0);
        if (event === "PASSWORD_RECOVERY") {
          setShowAuthModal(true);
        }
      } else {
        setUser(null);
        setAuthToken(undefined);
        setCompleted(0);
        setView("overview");
      }
    });

    return () => {
      authSubscription?.subscription?.unsubscribe();
    };
  }, []);

  const unlocked = (id: number) => id <= completed + 1;
  const progress = Math.round((completed / STAGES.length) * 100);
  const current = STAGES[Math.min(completed, STAGES.length - 1)]!;
  const caseConcluded = completed === STAGES.length;

  const open = (nextView: View) => {
    const stage = STAGES.find((item) => item.key === nextView);
    if (stage && !unlocked(stage.id)) return;
    setView(nextView);
  };

  const nav: {
    key: View;
    label: string;
    icon: Icon;
    locked: boolean;
  }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard, locked: false },
    ...STAGES.map((stage) => ({
      key: stage.key,
      label: stage.title,
      icon: stage.icon,
      locked: !unlocked(stage.id),
    })),
    { key: "leaderboard", label: "Leaderboard", icon: Trophy, locked: false },
    ...(user?.role === "admin"
      ? [{ key: "admin", label: "Admin Responses", icon: ShieldCheck, locked: false }]
      : []),
  ];

  const activeStage = STAGES.find((stage) => stage.key === view);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Fingerprint className="h-5 w-5 text-primary" />
          <span className="font-mono text-sm font-bold tracking-widest">BREACH FILES</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => open(item.key)}
              disabled={item.locked}
              className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                view === item.key
                  ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-l-2 border-transparent text-sidebar-foreground hover:bg-sidebar-accent/60"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.locked && <Lock className="h-3 w-3" />}
            </button>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Forensics Terminal v0.3
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 flex-wrap items-center gap-4 border-b border-border px-6 py-3">
          <div className="font-mono text-sm tracking-widest">
            THE BREACH FILES <span className="text-muted-foreground">/ CASE 07</span>
          </div>

          <div className="flex items-center gap-2 rounded-sm border border-primary/40 px-2 py-1 font-mono text-[11px] tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary glow" />
            {caseConcluded ? "CASE CONCLUDED" : "INVESTIGATION ACTIVE"}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 border border-border bg-sidebar px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <UserIcon className="h-3.5 w-3.5 text-primary" />
              <span>
                {user ? user.username || user.email?.split("@")[0] : "INVESTIGATOR LOGIN"}
              </span>
            </button>

            <span className="font-mono text-xs text-muted-foreground">PROGRESS</span>
            <ProgressBar value={progress} className="w-32 sm:w-40" />
            <span className="w-10 font-mono text-xs text-primary">{progress}%</span>
          </div>
        </header>

        <main className="grid-bg flex-1 overflow-auto p-6">
          {view === "leaderboard" ? (
            <div className="mx-auto max-w-6xl space-y-4">
              <button
                onClick={() => setView("overview")}
                className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" /> BACK TO OVERVIEW
              </button>
              <LeaderboardView />
            </div>
          ) : view === "admin" && user?.role === "admin" ? (
            <Suspense
              fallback={
                <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                  Opening administrator response review…
                </div>
              }
            >
              <AdminPortal authToken={authToken} />
            </Suspense>
          ) : activeStage ? (
            <StageView
              stage={activeStage}
              done={activeStage.id <= completed}
              authToken={authToken}
              onBack={() => setView("overview")}
              onComplete={() => {
                setCompleted((value) => Math.max(value, activeStage.id));
                setView("overview");
              }}
            />
          ) : (
            <Overview completed={completed} unlocked={unlocked} open={open} />
          )}
        </main>

        <footer className="flex min-h-9 flex-wrap items-center gap-4 border-t border-border bg-sidebar px-6 py-2 font-mono text-[11px] tracking-wider text-muted-foreground">
          <span>
            STATUS:{" "}
            <span className="text-primary">{caseConcluded ? "CASE CONCLUDED" : "OPEN"}</span>
          </span>
          <span>
            STAGE:{" "}
            <span className="text-foreground">
              {String(current.id).padStart(2, "0")} - {current.title.toUpperCase()}
            </span>
          </span>
          <span className="ml-auto">
            PROGRESS:{" "}
            <span className="text-foreground">
              {completed}/{STAGES.length}
            </span>
          </span>
        </footer>
      </div>

      {showAuthModal && (
        <AuthModal
          user={user}
          onAuthChange={() => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            void supabase.auth.getSession().then(({ data: { session } }) => {
              if (!session) {
                setUser(null);
                setAuthToken(undefined);
                setCompleted(0);
                setView("overview");
                return;
              }
              setAuthToken(session.access_token);
              setUser({
                id: session.user.id,
                email: session.user.email,
                username: session.user.user_metadata?.["username"],
                role: "participant",
              });
              return supabase
                .from("profiles")
                .select("username, role")
                .eq("id", session.user.id)
                .maybeSingle()
                .then(({ data: profile }) => {
                  setUser((current) =>
                    current?.id === session.user.id
                      ? {
                          ...current,
                          username: profile?.username || session.user.user_metadata?.["username"],
                          role: profile?.role || "participant",
                        }
                      : current,
                  );
                })
                .then(() =>
                  supabase
                    .from("user_progress")
                    .select("completed_stages")
                    .eq("user_id", session.user.id)
                    .maybeSingle(),
                )
                .then(({ data: progressData }) => {
                  if (
                    progressData?.completed_stages &&
                    Array.isArray(progressData.completed_stages)
                  ) {
                    setCompleted(getCompletedStagePrefix(progressData.completed_stages).length);
                  } else {
                    setCompleted(0);
                  }
                });
            });
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

function Overview({
  completed,
  unlocked,
  open,
}: {
  completed: number;
  unlocked: (id: number) => boolean;
  open: (view: View) => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="border border-border bg-card p-6">
        <div className="mb-1 font-mono text-xs tracking-widest text-warning">
          CASE 07 - BRIEFING
        </div>

        <h1 className="font-mono text-3xl font-bold tracking-wide">THE GLASSHOUSE INCIDENT</h1>

        <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
          {[
            ["Case ID", "BF-007"],
            ["Organisation", "NovaCorp"],
            ["Classification", "CONFIDENTIAL"],
            ["Incident time", "09:40 UTC"],
          ].map(([label, value]) => (
            <div key={label} className="bg-card px-4 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </dt>
              <dd
                className={`mt-1 font-mono text-sm ${
                  value === "CONFIDENTIAL" ? "text-warning" : ""
                }`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          At 09:40 UTC, a restricted internal project roadmap at NovaCorp was flagged after activity
          involving an export workflow. Reconstruct what happened, separate confirmed facts from
          assumptions, and recommend a defensible response. The evidence may be incomplete or
          misleading when viewed in isolation.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionLabel>Investigation Objectives</SectionLabel>

          <div className="space-y-2">
            {STAGES.map((stage) => {
              const isDone = stage.id <= completed;
              const available = unlocked(stage.id);

              return (
                <div
                  key={stage.id}
                  className={`flex items-center gap-4 border bg-card p-4 transition-colors ${
                    available && !isDone ? "border-primary/50" : "border-border"
                  } ${!available ? "opacity-50" : ""}`}
                >
                  <span className="font-mono text-lg text-muted-foreground">
                    {String(stage.id).padStart(2, "0")}
                  </span>

                  <stage.icon
                    className={`h-5 w-5 ${available ? "text-primary" : "text-muted-foreground"}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{stage.title}</div>
                    <div className="text-xs text-muted-foreground">{stage.desc}</div>
                  </div>

                  <StatusTag state={isDone ? "done" : available ? "open" : "locked"} />

                  <button
                    onClick={() => open(stage.key)}
                    disabled={!available}
                    className="flex items-center gap-1 border border-border px-3 py-1.5 font-mono text-xs tracking-wider transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none"
                  >
                    {available ? "OPEN" : <Lock className="h-3 w-3" />}
                    {available && <ChevronRight className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <Panel title="Mission" icon={Target}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Reconstruct the incident timeline, determine whether restricted data was accessed or
              delivered externally, evaluate competing explanations, and recommend a defensible
              response.
            </p>
          </Panel>

          <div>
            <SectionLabel>
              Evidence Summary <span className="text-warning">- simulated</span>
            </SectionLabel>

            <div className="grid grid-cols-2 gap-2">
              {EVIDENCE_SUMMARY.map((item) => (
                <div key={item.label} className="border border-border bg-card p-3">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="mt-2 font-mono text-2xl text-primary">{item.count}</div>
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>

            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              Counts are simulated case data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageView({
  stage,
  done,
  authToken,
  onBack,
  onComplete,
}: {
  stage: Stage;
  done: boolean;
  authToken?: string | undefined;
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> BACK TO OVERVIEW
      </button>

      {stage.id === 1 ? (
        <NetworkInvestigation done={done} authToken={authToken} onComplete={onComplete} />
      ) : stage.id === 2 ? (
        <AccessInvestigation done={done} authToken={authToken} onComplete={onComplete} />
      ) : stage.id === 3 ? (
        <EvidenceLab done={done} authToken={authToken} onComplete={onComplete} />
      ) : stage.id === 4 ? (
        <WitnessInvestigation done={done} authToken={authToken} onComplete={onComplete} />
      ) : stage.id === 5 ? (
        <IncidentResponse done={done} authToken={authToken} onComplete={onComplete} />
      ) : (
        <Panel
          title={`Stage ${String(stage.id).padStart(2, "0")} - ${stage.title}`}
          icon={stage.icon}
        >
          <p className="text-sm text-muted-foreground">{stage.desc}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            This investigation workspace is under development.
          </p>
        </Panel>
      )}
    </div>
  );
}

function NetworkInvestigation({
  done,
  authToken,
  onComplete,
}: {
  done: boolean;
  authToken?: string | undefined;
  onComplete: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ALL");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("SCH-01");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [timelineIds, setTimelineIds] = useState<string[]>([]);
  const [finding, setFinding] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");
  const [alternative, setAlternative] = useState("");
  const [nextEvidence, setNextEvidence] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverScore, setServerScore] = useState<number | null>(null);
  const [serverPassed, setServerPassed] = useState(false);
  const [serverRejected, setServerRejected] = useState(false);
  const [serverRemarks, setServerRemarks] = useState("");
  const [syncedToSupabase, setSyncedToSupabase] = useState(false);

  const selectedRecord = EVIDENCE.find((record) => record.id === selectedId) ?? EVIDENCE[0]!;

  const filteredEvidence = useMemo(() => {
    const query = search.trim().toLowerCase();

    return EVIDENCE.filter((record) => {
      const matchesCategory = category === "ALL" || record.category === category;
      const matchesBookmark = !showBookmarkedOnly || bookmarks.includes(record.id);
      const searchable = [
        record.id,
        record.time,
        record.category,
        record.source,
        record.title,
        record.summary,
        record.detail,
        ...record.tags,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesBookmark && (!query || searchable.includes(query));
    });
  }, [search, category, bookmarks, showBookmarkedOnly]);

  const timelineRecords = timelineIds
    .map((id) => EVIDENCE.find((record) => record.id === id))
    .filter((record): record is EvidenceRecord => Boolean(record))
    .sort((a, b) => a.time.localeCompare(b.time));

  const reportComplete =
    finding.trim().length > 0 &&
    evidenceIds.trim().length > 0 &&
    alternative.trim().length >= 20 &&
    nextEvidence.trim().length >= 20 &&
    reasoning.trim().length >= 40;

  const toggleBookmark = (id: string) => {
    setBookmarks((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const toggleTimeline = (id: string) => {
    setTimelineIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const resetReport = () => {
    setFinding("");
    setEvidenceIds("");
    setAlternative("");
    setNextEvidence("");
    setReasoning("");
    setSubmitted(false);
    setServerScore(null);
    setServerPassed(false);
    setServerRejected(false);
    setServerRemarks("");
  };

  const handleSubmitReport = async () => {
    if (!reportComplete) return;
    setSubmitting(true);
    try {
      const res = await submitStageServerFn({
        data: {
          stageId: 1,
          payload: { finding, evidenceIds, alternative, nextEvidence, reasoning },
          authToken,
        },
      });
      setServerScore(res.score);
      setServerPassed(res.success && res.passed);
      setServerRejected(!res.success);
      setServerRemarks(res.remarks);
      setSyncedToSupabase(res.persistedToSupabase);
      setSubmitted(true);
    } catch {
      setServerScore(null);
      setServerPassed(false);
      setServerRejected(true);
      setServerRemarks("Server verification failed. Please retry your submission.");
      setSyncedToSupabase(false);
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };

  const reportScore = () => {
    const submittedIds = evidenceIds
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const supportedIds = ["SCH-01", "AUTH-05", "DOC-06", "EXP-09"];
    const usefulIds = submittedIds.filter((id) => supportedIds.includes(id));
    const hasStaging = submittedIds.includes("EXP-09");
    const hasRead = submittedIds.includes("DOC-06");
    const avoidsOverclaim =
      finding === "Access and staging are supported; external delivery is unconfirmed.";
    const includesAlternative = alternative.trim().length >= 20;
    const includesNextStep = nextEvidence.trim().length >= 20;
    const explainsReasoning = reasoning.trim().length >= 40;

    return (
      usefulIds.length * 10 +
      (hasStaging ? 10 : 0) +
      (hasRead ? 10 : 0) +
      (avoidsOverclaim ? 20 : 0) +
      (includesAlternative ? 10 : 0) +
      (includesNextStep ? 10 : 0) +
      (explainsReasoning ? 10 : 0)
    );
  };

  const score = Math.min(100, reportScore());

  return (
    <div className="space-y-5">
      <Panel title="Stage 01 - Network Investigation" icon={Network}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm leading-relaxed text-muted-foreground">
              You have received a mixed evidence bundle. Some records are relevant, others are
              incomplete, and some may be coincidental. Inspect the records, bookmark evidence,
              build a defensible timeline, and submit your assessment. Do not treat correlation as
              proof of causation.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] tracking-widest">
              <span className="border border-primary/40 px-2 py-1 text-primary">CASE BF-007</span>
              <span className="border border-border px-2 py-1 text-muted-foreground">
                15 RECORDS
              </span>
              <span className="border border-warning/40 px-2 py-1 text-warning">
                INVESTIGATOR MODE
              </span>
            </div>
          </div>
          <div className="min-w-32 border border-border bg-background p-3">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
              BOOKMARKED
            </div>
            <div className="mt-1 font-mono text-2xl text-primary">
              {bookmarks.length}
              <span className="text-sm text-muted-foreground"> / 15</span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <Panel title="Evidence Vault" icon={FileSearch}>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search IDs, hosts, details, keywords..."
                className="w-full border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`border px-2 py-1.5 font-mono text-[10px] tracking-wider ${
                    category === item
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowBookmarkedOnly((value) => !value)}
              className={`flex items-center gap-2 border px-3 py-2 font-mono text-[10px] tracking-wider ${
                showBookmarkedOnly
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Filter className="h-3 w-3" />
              {showBookmarkedOnly ? "SHOW ALL RECORDS" : "BOOKMARKS ONLY"}
            </button>

            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>{filteredEvidence.length} RECORDS MATCH</span>
              <span>UTC / READ-ONLY</span>
            </div>

            <div className="max-h-[510px] space-y-2 overflow-y-auto pr-1">
              {filteredEvidence.map((record) => (
                <div
                  key={record.id}
                  className={`border transition-colors ${
                    selectedId === record.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <button onClick={() => setSelectedId(record.id)} className="w-full p-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {record.id}
                          </span>
                          <span className="border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                            {record.category}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {record.time}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold">{record.title}</div>
                        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {record.summary}
                        </div>
                      </div>
                      {bookmarks.includes(record.id) && (
                        <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </div>
                  </button>
                </div>
              ))}

              {filteredEvidence.length === 0 && (
                <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No records match those filters.
                </div>
              )}
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Record Inspection" icon={Search}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-primary">{selectedRecord.id}</div>
                <h3 className="mt-1 text-base font-semibold">{selectedRecord.title}</h3>
              </div>
              <button
                onClick={() => toggleBookmark(selectedRecord.id)}
                className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] tracking-wider hover:border-primary"
              >
                {bookmarks.includes(selectedRecord.id) ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
                {bookmarks.includes(selectedRecord.id) ? "BOOKMARKED" : "BOOKMARK"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
              <Metadata label="Timestamp" value={`${selectedRecord.time} UTC`} />
              <Metadata label="Record type" value={selectedRecord.category} />
              <div className="col-span-2 bg-background p-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Source
                </div>
                <div className="mt-1 text-xs">{selectedRecord.source}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                FULL RECORD
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {selectedRecord.detail}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {selectedRecord.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            <button
              onClick={() => toggleTimeline(selectedRecord.id)}
              className={`mt-4 flex w-full items-center justify-center gap-2 border px-3 py-2.5 font-mono text-xs tracking-wider ${
                timelineIds.includes(selectedRecord.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary hover:text-primary"
              }`}
            >
              <Clock3 className="h-4 w-4" />
              {timelineIds.includes(selectedRecord.id)
                ? "REMOVE FROM RECONSTRUCTED TIMELINE"
                : "ADD TO RECONSTRUCTED TIMELINE"}
            </button>
          </Panel>

          <Panel title="Timeline Reconstruction" icon={Clock3}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Select the records you believe matter to the incident. The timeline orders them by
              timestamp; your job is to decide which events are causally relevant and which are
              merely coincidental.
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                YOUR TIMELINE
              </span>
              <span className="font-mono text-xs text-primary">
                {timelineRecords.length} SELECTED
              </span>
            </div>

            {timelineRecords.length > 0 ? (
              <div className="mt-3 space-y-2">
                {timelineRecords.map((record, index) => (
                  <div key={record.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/50 font-mono text-[10px] text-primary">
                        {index + 1}
                      </span>
                      {index < timelineRecords.length - 1 && (
                        <span className="h-7 w-px bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 border border-border bg-background p-2.5">
                      <div className="font-mono text-[10px] text-primary">
                        {record.time} - {record.id}
                      </div>
                      <div className="mt-1 text-xs font-semibold">{record.title}</div>
                    </div>
                    <button
                      onClick={() => toggleTimeline(record.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${record.id} from timeline`}
                    >
                      <span className="text-xs">X</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 border border-dashed border-border p-5 text-center">
                <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Inspect records and add relevant events here.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Investigator's Report" icon={ClipboardList}>
        <div className="mb-5 flex items-start gap-3 border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your report is evaluated for evidence selection and reasoning. A confident accusation
            without supporting records is not a strong forensic conclusion. Cite record IDs exactly
            as shown in the vault.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              01 / Primary conclusion
            </label>
            <select
              value={finding}
              onChange={(event) => setFinding(event.target.value)}
              className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            >
              <option value="">Select your conclusion...</option>
              <option value="Access and staging are supported; external delivery is unconfirmed.">
                Access and staging are supported; external delivery is unconfirmed.
              </option>
              <option value="External theft is confirmed by the supplied records.">
                External theft is confirmed by the supplied records.
              </option>
              <option value="The alert is a false positive and no investigation is needed.">
                The alert is a false positive and no investigation is needed.
              </option>
              <option value="A named employee deliberately leaked the roadmap.">
                A named employee deliberately leaked the roadmap.
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              02 / Evidence IDs
            </label>
            <input
              value={evidenceIds}
              onChange={(event) => setEvidenceIds(event.target.value)}
              placeholder="Example: DOC-06, EXP-09, NET-10"
              className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Separate IDs with commas or spaces. Explain their significance below.
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              03 / Alternative explanation
            </label>
            <textarea
              value={alternative}
              onChange={(event) => setAlternative(event.target.value)}
              rows={4}
              placeholder="What is another plausible explanation for the observed activity? Which facts support or weaken it?"
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">Minimum 20 characters.</p>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              04 / Next evidence request
            </label>
            <textarea
              value={nextEvidence}
              onChange={(event) => setNextEvidence(event.target.value)}
              rows={4}
              placeholder="Name the specific log, artifact, or corroboration you would request next, and why."
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">Minimum 20 characters.</p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              05 / Reasoning and timeline
            </label>
            <textarea
              value={reasoning}
              onChange={(event) => setReasoning(event.target.value)}
              rows={5}
              placeholder="Connect the records in sequence. Distinguish what is confirmed, what is inferred, and what remains unknown. Cite specific evidence IDs."
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Minimum 40 characters. A list of IDs alone is not a complete explanation.
            </p>
          </div>
        </div>

        {submitted && (serverScore !== null || score !== null) && (
          <div className="mt-5 border border-primary/40 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-sm text-primary">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {syncedToSupabase
                  ? "REPORT VERIFIED & SYNCED TO SUPABASE"
                  : "REPORT RECORDED LOCALLY (SERVER VALIDATED)"}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                STAGE 01 EVALUATION
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl">
              {serverScore ?? score}/100{" "}
              <span className="text-xs text-muted-foreground">SERVER VALIDATED</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {serverRemarks ||
                "This score was verified by server-side forensic validation. Evidence citations and alternative explanations were evaluated."}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleSubmitReport}
            disabled={!reportComplete || submitting}
            className="flex items-center gap-2 bg-primary px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {submitting ? "VALIDATING ON SERVER..." : "SUBMIT INVESTIGATION REPORT"}
          </button>
          <button
            onClick={resetReport}
            className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-xs tracking-wider hover:border-primary"
          >
            <RotateCcw className="h-4 w-4" />
            RESET REPORT
          </button>
          {done && (
            <span className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" />
              STAGE COMPLETE
            </span>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Scores and stage completions are validated on the server. Connect your Supabase keys to
          synchronize across sessions and rank on the live leaderboard.
        </div>
      </Panel>

      {!done && submitted && !serverRejected && (serverPassed || (serverScore ?? score) >= 50) && (
        <div className="flex justify-end">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 border border-primary px-4 py-3 font-mono text-xs font-bold tracking-wider text-primary hover:bg-primary/10"
          >
            MARK STAGE 01 COMPLETE
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-xs">{value}</div>
    </div>
  );
}

function Panel({
  title,
  icon: IconComponent,
  children,
}: {
  title: string;
  icon?: Icon;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-foreground">
        {IconComponent && <IconComponent className="h-4 w-4 text-primary" />}
        {title}
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function StatusTag({ state }: { state: "done" | "open" | "locked" }) {
  const status = {
    done: {
      label: "COMPLETE",
      className: "text-primary border-primary/40",
      icon: CheckCircle2,
    },
    open: {
      label: "AVAILABLE",
      className: "text-warning border-warning/40",
      icon: CircleDot,
    },
    locked: {
      label: "LOCKED",
      className: "text-muted-foreground border-border",
      icon: Lock,
    },
  }[state];

  const IconComponent = status.icon;

  return (
    <span
      className={`hidden items-center gap-1 border px-2 py-0.5 font-mono text-[10px] tracking-widest sm:flex ${status.className}`}
    >
      <IconComponent className="h-3 w-3" /> {status.label}
    </span>
  );
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden bg-muted ${className}`}>
      <div className="h-full bg-primary glow transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}
