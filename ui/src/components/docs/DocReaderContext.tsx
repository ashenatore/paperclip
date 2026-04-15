import { useState } from "react";
import type { CompanyDocumentDetail } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { cn, relativeTime } from "@/lib/utils";
import { statusBadge, statusBadgeDefault } from "@/lib/status-colors";
import { ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";

interface DocReaderContextProps {
  detail: CompanyDocumentDetail;
  companyId: string;
  onOpenSibling: (doc: { id: string; key: string; title: string | null }) => void;
}

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_ISSUE_STATUSES = new Set(["backlog", "todo", "in_progress", "in_review", "blocked"]);

export function DocReaderContext({ detail, companyId, onOpenSibling }: DocReaderContextProps) {
  const [collapsed, setCollapsed] = useState(false);

  const isStale =
    ACTIVE_ISSUE_STATUSES.has(detail.issueStatus) &&
    Date.now() - new Date(detail.updatedAt).getTime() > STALE_THRESHOLD_MS;

  return (
    <div className="border border-border rounded-md text-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>Context</span>
      </button>

      {!collapsed && (
        <div className="space-y-2 px-3 pb-3">
          {/* Issue context row */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/issues/${detail.issueId}`}
              className="text-sm font-medium text-foreground hover:underline truncate max-w-[260px]"
            >
              {detail.issueTitle}
            </Link>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                statusBadge[detail.issueStatus] ?? statusBadgeDefault,
              )}
            >
              {detail.issueStatus.replace(/_/g, " ")}
            </span>
            {detail.assigneeAgentName && (
              <span className="text-xs text-muted-foreground">
                {detail.assigneeAgentName}
              </span>
            )}
          </div>

          {/* Author chain */}
          {detail.revisionAuthors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {detail.revisionAuthors.map((author, idx) => (
                <span key={author.agentId ?? author.userId ?? idx} className="inline-flex items-center gap-1">
                  {idx > 0 && <span className="text-muted-foreground/50">&rarr;</span>}
                  <span className="font-medium text-foreground/80">
                    {author.agentName ?? "User"}
                  </span>
                  <span className="text-muted-foreground/70">
                    ({author.revisionCount} rev{author.revisionCount !== 1 ? "s" : ""})
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Revision info + feedback + staleness */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Rev {detail.latestRevisionNumber} &mdash; Last updated {relativeTime(detail.updatedAt)}
            </span>
            {detail.latestChangeSummary && (
              <span className="truncate max-w-[300px]" title={detail.latestChangeSummary}>
                {detail.latestChangeSummary}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> {detail.feedbackUpVotes}
            </span>
            <span className="inline-flex items-center gap-1">
              <ThumbsDown className="h-3 w-3" /> {detail.feedbackDownVotes}
            </span>
            {isStale && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Stale
              </span>
            )}
          </div>

          {/* Sibling docs */}
          {detail.siblingDocuments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Siblings:</span>
              {detail.siblingDocuments.map((sibling) => (
                <button
                  key={sibling.id}
                  type="button"
                  className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                  onClick={() =>
                    onOpenSibling({
                      id: sibling.id,
                      key: sibling.key,
                      title: sibling.title,
                    })
                  }
                >
                  {sibling.key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
