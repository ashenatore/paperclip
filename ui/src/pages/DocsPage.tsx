import { useEffect, useState, useCallback } from "react";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocsList } from "@/components/docs/DocsList";
import { DocReader } from "@/components/docs/DocReader";
import { DocsActivity } from "@/components/docs/DocsActivity";
import { FileText } from "lucide-react";
import type { CompanyDocumentListItem } from "@paperclipai/shared";

const MAX_READER_TABS = 8;

export function DocsPage() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [openTabs, setOpenTabs] = useState<
    Array<{ documentId: string; doc?: CompanyDocumentListItem }>
  >([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState("review");

  useEffect(() => {
    setBreadcrumbs([{ label: "Docs" }]);
  }, [setBreadcrumbs]);

  const handleSelectDocument = useCallback(
    (doc: CompanyDocumentListItem) => {
      setOpenTabs((prev) => {
        const existing = prev.find((t) => t.documentId === doc.id);
        if (existing) {
          setActiveTabId(doc.id);
          return prev;
        }
        if (prev.length >= MAX_READER_TABS) {
          // Remove the oldest tab to make room
          const next = prev.slice(1);
          setActiveTabId(doc.id);
          return [...next, { documentId: doc.id, doc }];
        }
        setActiveTabId(doc.id);
        return [...prev, { documentId: doc.id, doc }];
      });
      setActiveTabId(doc.id);
    },
    [],
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.documentId === id);
        const next = prev.filter((t) => t.documentId !== id);
        if (activeTabId === id) {
          const newActive = next[Math.min(idx, next.length - 1)]?.documentId ?? null;
          setActiveTabId(newActive);
        }
        return next;
      });
    },
    [activeTabId],
  );

  const handleActivateTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const handleOpenSibling = useCallback(
    (sibling: { id: string; key: string; title: string | null }) => {
      const doc: CompanyDocumentListItem = {
        id: sibling.id,
        key: sibling.key,
        title: sibling.title,
      } as CompanyDocumentListItem;
      handleSelectDocument(doc);
    },
    [handleSelectDocument],
  );

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs value={pageTab} onValueChange={setPageTab} className="flex flex-col h-full">
        <div className="px-4 pt-2 shrink-0">
          <TabsList>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="review" className="flex-1 min-h-0">
          <div className="flex h-full">
            <div className="w-[380px] min-w-[320px] border-r border-border h-full overflow-hidden">
              <DocsList
                companyId={selectedCompanyId}
                onSelectDocument={handleSelectDocument}
                selectedDocumentId={activeTabId}
                openTabIds={openTabs.map((t) => t.documentId)}
              />
            </div>
            <div className="flex-1 min-w-0 h-full">
              <DocReader
                companyId={selectedCompanyId}
                tabs={openTabs}
                activeTabId={activeTabId}
                onActivateTab={handleActivateTab}
                onCloseTab={handleCloseTab}
                onOpenSibling={handleOpenSibling}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="flex-1 min-h-0 overflow-y-auto">
          <DocsActivity companyId={selectedCompanyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
