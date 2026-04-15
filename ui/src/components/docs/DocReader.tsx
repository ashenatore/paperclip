import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanyDocumentDetail, CompanyDocumentListItem } from "@paperclipai/shared";
import { documentsApi } from "@/api/documents";
import { MarkdownBody } from "@/components/MarkdownBody";
import { DocReaderContext } from "@/components/docs/DocReaderContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { FileText, X } from "lucide-react";

interface DocReaderProps {
  companyId: string;
  tabs: Array<{ documentId: string; doc?: CompanyDocumentListItem }>;
  activeTabId: string | null;
  onActivateTab: (documentId: string) => void;
  onCloseTab: (documentId: string) => void;
  onOpenSibling: (doc: { id: string; key: string; title: string | null }) => void;
}

function truncateLabel(text: string, maxLen: number = 20): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

function DocTabContent({
  companyId,
  documentId,
  isActive,
  scrollPositions,
  contentRefs,
  onOpenSibling,
}: {
  companyId: string;
  documentId: string;
  isActive: boolean;
  scrollPositions: React.MutableRefObject<Map<string, { scrollTop: number }>>;
  contentRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  onOpenSibling: (doc: { id: string; key: string; title: string | null }) => void;
}) {
  const { data: detail, isLoading, error } = useQuery({
    queryKey: queryKeys.documents.detail(companyId, documentId),
    queryFn: () => documentsApi.getDetail(companyId, documentId),
    enabled: !!documentId,
  });

  return (
    <div
      ref={(el) => {
        contentRefs.current.set(documentId, el);
        if (el) {
          const saved = scrollPositions.current.get(documentId);
          if (saved) {
            el.scrollTop = saved.scrollTop;
          }
        }
      }}
      className={cn(
        "overflow-y-auto flex-1",
        isActive ? "relative visible" : "absolute inset-0 invisible",
      )}
      style={!isActive ? { pointerEvents: "none" } : undefined}
    >
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading document...</p>
        </div>
      )}
      {error && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load document"}
          </p>
        </div>
      )}
      {detail && (
        <div className="p-4 space-y-3">
          <DocReaderContext
            detail={detail}
            companyId={companyId}
            onOpenSibling={onOpenSibling}
          />
          {detail.title && (
            <h2 className="text-lg font-semibold">{detail.title}</h2>
          )}
          <MarkdownBody className="text-[15px] leading-7">
            {detail.body}
          </MarkdownBody>
        </div>
      )}
    </div>
  );
}

export function DocReader({
  companyId,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  onOpenSibling,
}: DocReaderProps) {
  const scrollPositions = useRef<Map<string, { scrollTop: number }>>(new Map());
  const contentRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const saveCurrentScroll = useCallback(() => {
    if (!activeTabId) return;
    const el = contentRefs.current.get(activeTabId);
    if (el) {
      scrollPositions.current.set(activeTabId, { scrollTop: el.scrollTop });
    }
  }, [activeTabId]);

  useEffect(() => {
    if (!activeTabId) return;
    const el = contentRefs.current.get(activeTabId);
    if (el) {
      const saved = scrollPositions.current.get(activeTabId);
      if (saved) {
        requestAnimationFrame(() => {
          el.scrollTop = saved.scrollTop;
        });
      }
    }
  }, [activeTabId]);

  const handleActivateTab = useCallback(
    (documentId: string) => {
      saveCurrentScroll();
      onActivateTab(documentId);
    },
    [onActivateTab, saveCurrentScroll],
  );

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted/50 p-4 mb-4">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Select a document from the list to review it
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-background shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.documentId === activeTabId;
          const label = tab.doc
            ? truncateLabel(tab.doc.title ?? tab.doc.key)
            : truncateLabel(tab.documentId);
          return (
            <div
              key={tab.documentId}
              className={cn(
                "group flex items-center gap-1.5 border-r border-border px-3 py-2 text-sm cursor-pointer shrink-0 transition-colors",
                isActive
                  ? "bg-background text-foreground border-b-2 border-b-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
              )}
              onClick={() => handleActivateTab(tab.documentId)}
            >
              <span className="truncate max-w-[160px]">{label}</span>
              <button
                type="button"
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent/60 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.documentId);
                }}
                aria-label={`Close tab ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Content area */}
      <div ref={containerRef} className="relative flex-1 min-h-0">
        {tabs.map((tab) => (
          <DocTabContent
            key={tab.documentId}
            companyId={companyId}
            documentId={tab.documentId}
            isActive={tab.documentId === activeTabId}
            scrollPositions={scrollPositions}
            contentRefs={contentRefs}
            onOpenSibling={onOpenSibling}
          />
        ))}
      </div>
    </div>
  );
}
