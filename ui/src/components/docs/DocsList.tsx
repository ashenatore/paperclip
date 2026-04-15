import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/api/documents";
import { queryKeys } from "@/lib/queryKeys";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { DocListItem } from "./DocListItem";
import { FileText, Search, ArrowUp, ArrowDown } from "lucide-react";
import type { CompanyDocumentListItem } from "@paperclipai/shared";

const DOCS_SEARCH_DEBOUNCE_MS = 300;

type DocSortField = "updated" | "created" | "revisions";

interface DocsListProps {
  companyId: string;
  onSelectDocument: (doc: CompanyDocumentListItem) => void;
  selectedDocumentId?: string | null;
  openTabIds: string[];
}

export function DocsList({ companyId, onSelectDocument, selectedDocumentId, openTabIds }: DocsListProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [keyFilter, setKeyFilter] = useState<string>("__all__");
  const [sortField, setSortField] = useState<DocSortField>("updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, DOCS_SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  const filters = {
    q: debouncedSearch || undefined,
    key: keyFilter !== "__all__" ? keyFilter : undefined,
    sort: sortField,
    order: sortOrder,
  };

  const { data: documents, isLoading } = useQuery({
    queryKey: [
      ...queryKeys.documents.list(companyId),
      filters,
    ],
    queryFn: () => documentsApi.list(companyId, filters),
    enabled: !!companyId,
  });

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="pl-7 text-xs"
            aria-label="Search documents"
          />
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-1.5 px-3 pb-2 shrink-0">
        <Select value={keyFilter} onValueChange={setKeyFilter}>
          <SelectTrigger size="sm" className="h-7 text-xs w-[110px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            <SelectItem value="plan">Plan</SelectItem>
            <SelectItem value="design">Design</SelectItem>
            <SelectItem value="report">Report</SelectItem>
            <SelectItem value="notes">Notes</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => setSortField(v as DocSortField)}>
          <SelectTrigger size="sm" className="h-7 text-xs w-[110px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="revisions">Revisions</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={toggleSortOrder}
          title={sortOrder === "asc" ? "Ascending" : "Descending"}
        >
          {sortOrder === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Document list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && (
          <div className="px-3 py-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-5 w-10 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!documents || documents.length === 0) && (
          <EmptyState
            icon={FileText}
            message="No documents yet"
          />
        )}

        {!isLoading && documents?.map((doc) => (
          <DocListItem
            key={doc.id}
            doc={doc}
            isSelected={doc.id === selectedDocumentId}
            isOpen={openTabIds.includes(doc.id)}
            onClick={() => onSelectDocument(doc)}
          />
        ))}
      </div>
    </div>
  );
}
