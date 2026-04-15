import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanyDocumentActivity } from "@paperclipai/shared";
import { documentsApi } from "@/api/documents";
import { queryKeys } from "@/lib/queryKeys";
import { cn, relativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Clock,
  Eye,
  AlertTriangle,
  ThumbsUp,
  ArrowUpRight,
  History,
} from "lucide-react";

interface DocsActivityProps {
  companyId: string;
}

function StatusPill({ action }: { action: "created" | "updated" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        action === "created"
          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
          : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
      )}
    >
      {action}
    </span>
  );
}

export function DocsActivity({ companyId }: DocsActivityProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.documents.activity(companyId),
    queryFn: () => documentsApi.getActivity(companyId),
    enabled: !!companyId,
  });

  const sortedByKeyType = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.stats.documentsByKey).sort(
      ([, a], [, b]) => b - a,
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load activity"}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const maxKeyCount = Math.max(...Object.values(data.stats.documentsByKey), 1);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                  {data.stats.totalDocuments}
                </p>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                  Total Documents
                </p>
              </div>
              <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                  {data.stats.recentlyCreated}
                </p>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                  Recently Created (24h)
                </p>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                  {data.stats.unreviewedCount}
                </p>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                  Unreviewed
                </p>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                  {data.stats.staleCount}
                </p>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                  Stale
                </p>
              </div>
              <AlertTriangle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document types breakdown */}
      {sortedByKeyType.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Document Types
          </h3>
          <div className="border border-border rounded-md divide-y divide-border overflow-hidden">
            {sortedByKeyType.map(([key, count]) => (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {key}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${(count / maxKeyCount) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity feed + Active agents */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Activity feed */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Recent Activity
          </h3>
          {data.recentActivity.length === 0 ? (
            <div className="border border-border p-4">
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            </div>
          ) : (
            <div className="border border-border divide-y divide-border overflow-hidden">
              {data.recentActivity.map((event) => (
                <div
                  key={`${event.documentId}-${event.timestamp}`}
                  className="flex items-start gap-2 px-3 py-2.5 text-sm"
                >
                  <StatusPill action={event.action} />
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {event.documentKey}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">
                        {event.documentTitle ?? event.documentKey}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">{event.issueTitle}</span>
                      {event.agentName && (
                        <>
                          <span>&middot;</span>
                          <span className="shrink-0">{event.agentName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {relativeTime(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active agents */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Active Agents (7d)
          </h3>
          {data.activeAgents.length === 0 ? (
            <div className="border border-border p-4">
              <p className="text-sm text-muted-foreground">No active agents.</p>
            </div>
          ) : (
            <div className="border border-border divide-y divide-border overflow-hidden">
              {data.activeAgents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                      {agent.agentName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium truncate">{agent.agentName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {agent.documentEditCount} edit{agent.documentEditCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attention flags */}
      {(data.stats.unreviewedCount > 0 || data.stats.staleCount > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Attention
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.stats.unreviewedCount > 0 && (
              <Card className="py-4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Unreviewed Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.stats.unreviewedCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Documents awaiting review
                  </p>
                </CardContent>
              </Card>
            )}
            {data.stats.staleCount > 0 && (
              <Card className="py-4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Stale Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.stats.staleCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Not updated in 7+ days on active issues
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
