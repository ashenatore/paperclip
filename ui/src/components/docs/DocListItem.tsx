import type { CompanyDocumentListItem } from "@paperclipai/shared";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface DocListItemProps {
  doc: CompanyDocumentListItem;
  isSelected: boolean;
  isOpen: boolean;
  onClick: () => void;
}

const KEY_COLORS: Record<string, string> = {
  plan: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  design: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  report: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  notes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
};

function getKeyColorClass(key: string): string {
  return KEY_COLORS[key] ?? KEY_COLORS.custom;
}

export function DocListItem({ doc, isSelected, isOpen, onClick }: DocListItemProps) {
  const displayTitle = doc.title ?? `Untitled ${doc.key}`;
  const hasFeedback = doc.feedbackUpVotes > 0 || doc.feedbackDownVotes > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 transition-colors border-b border-border last:border-b-0",
        isSelected
          ? "bg-accent text-foreground"
          : "hover:bg-accent/50 text-foreground",
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        {/* Key badge */}
        <span
          className={cn(
            "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase shrink-0 mt-0.5",
            getKeyColorClass(doc.key),
          )}
        >
          {doc.key}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm font-medium truncate", isOpen && !isSelected && "text-primary")}>
              {displayTitle}
            </span>
            {doc.revisionCount > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                v{doc.revisionCount}
              </Badge>
            )}
          </div>

          {doc.issueTitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {doc.issueTitle}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1">
            {doc.updatedByAgentName && (
              <span className="text-[11px] text-muted-foreground truncate">
                {doc.updatedByAgentName}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground shrink-0">
              {timeAgo(doc.updatedAt)}
            </span>
            {hasFeedback && (
              <span className="flex items-center gap-1 shrink-0 ml-auto">
                {doc.feedbackUpVotes > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <ThumbsUp className="h-3 w-3" />
                    {doc.feedbackUpVotes}
                  </span>
                )}
                {doc.feedbackDownVotes > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <ThumbsDown className="h-3 w-3" />
                    {doc.feedbackDownVotes}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
