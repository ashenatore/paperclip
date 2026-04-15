// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { CompanyDocumentListItem } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocsPage } from "./DocsPage";

// Mock contexts
vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

// Mock sub-components to isolate tab management logic
const capturedProps = {
  onSelectDocument: null as ((doc: CompanyDocumentListItem) => void) | null,
  selectedDocumentId: null as string | null,
  openTabIds: [] as string[],
};

vi.mock("@/components/docs/DocsList", () => ({
  DocsList: ({ onSelectDocument, selectedDocumentId, openTabIds }: any) => {
    capturedProps.onSelectDocument = onSelectDocument;
    capturedProps.selectedDocumentId = selectedDocumentId;
    capturedProps.openTabIds = openTabIds;
    return <div data-testid="docs-list">DocsList</div>;
  },
}));

const capturedReaderProps = {
  tabs: [] as Array<{ documentId: string; doc?: CompanyDocumentListItem }>,
  activeTabId: null as string | null,
  onActivateTab: null as ((id: string) => void) | null,
  onCloseTab: null as ((id: string) => void) | null,
  onOpenSibling: null as ((doc: { id: string; key: string; title: string | null }) => void) | null,
};

vi.mock("@/components/docs/DocReader", () => ({
  DocReader: ({ tabs, activeTabId, onActivateTab, onCloseTab, onOpenSibling }: any) => {
    capturedReaderProps.tabs = tabs;
    capturedReaderProps.activeTabId = activeTabId;
    capturedReaderProps.onActivateTab = onActivateTab;
    capturedReaderProps.onCloseTab = onCloseTab;
    capturedReaderProps.onOpenSibling = onOpenSibling;
    return <div data-testid="doc-reader">DocReader</div>;
  },
}));

vi.mock("@/components/docs/DocsActivity", () => ({
  DocsActivity: () => <div data-testid="docs-activity">DocsActivity</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange }: any) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: any) => <div data-testid={`trigger-${value}`}>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-testid={`content-${value}`}>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  FileText: () => <span>FileText</span>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createDocListItem(overrides: Partial<CompanyDocumentListItem> = {}): CompanyDocumentListItem {
  return {
    id: "doc-1",
    companyId: "company-1",
    issueId: "issue-1",
    issueTitle: "Test Issue",
    issueStatus: "in_progress",
    issueAssigneeAgentId: null,
    assigneeAgentName: null,
    key: "plan",
    title: "Plan A",
    format: "markdown",
    revisionCount: 1,
    latestRevisionNumber: 1,
    latestChangeSummary: null,
    createdByAgentId: null,
    createdByAgentName: null,
    updatedByAgentId: null,
    updatedByAgentName: null,
    createdAt: new Date("2026-04-10T12:00:00.000Z"),
    updatedAt: new Date("2026-04-10T14:00:00.000Z"),
    feedbackUpVotes: 0,
    feedbackDownVotes: 0,
    ...overrides,
  };
}

describe("DocsPage tab management", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    capturedProps.onSelectDocument = null;
    capturedProps.selectedDocumentId = null;
    capturedProps.openTabIds = [];
    capturedReaderProps.tabs = [];
    capturedReaderProps.activeTabId = null;
    capturedReaderProps.onActivateTab = null;
    capturedReaderProps.onCloseTab = null;
    capturedReaderProps.onOpenSibling = null;
  });

  afterEach(() => {
    container.remove();
  });

  function render() {
    const root = createRoot(container);
    act(() => {
      root.render(<DocsPage />);
    });
    return root;
  }

  it("opens a tab when a document is selected", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1", key: "plan", title: "Plan A" }));
    });

    expect(capturedReaderProps.tabs).toEqual([
      expect.objectContaining({ documentId: "doc-1" }),
    ]);
    expect(capturedReaderProps.activeTabId).toBe("doc-1");
    root.unmount();
  });

  it("activates an existing tab instead of duplicating", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1", key: "plan", title: "Plan A" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-2", key: "design", title: "Design" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1", key: "plan", title: "Plan A" }));
    });

    expect(capturedReaderProps.tabs).toHaveLength(2);
    expect(capturedReaderProps.activeTabId).toBe("doc-1");
    root.unmount();
  });

  it("tracks open tab IDs in DocsList", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-2" }));
    });

    expect(capturedProps.openTabIds).toEqual(["doc-1", "doc-2"]);
    root.unmount();
  });

  it("closes a tab and activates an adjacent one", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-2" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-3" }));
    });

    // Close the middle (active) tab
    act(() => {
      capturedReaderProps.onCloseTab!("doc-2");
    });

    expect(capturedReaderProps.tabs).toHaveLength(2);
    // Should activate adjacent tab (doc-3 since closing doc-2 at index 1)
    expect(capturedReaderProps.activeTabId).toBe("doc-3");
    root.unmount();
  });

  it("closes the last tab and activates the previous one", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-2" }));
    });

    // Close the active last tab
    act(() => {
      capturedReaderProps.onCloseTab!("doc-2");
    });

    expect(capturedReaderProps.tabs).toHaveLength(1);
    expect(capturedReaderProps.activeTabId).toBe("doc-1");
    root.unmount();
  });

  it("evicts the oldest tab when MAX_READER_TABS is reached", () => {
    const root = render();

    // Open 8 tabs (MAX_READER_TABS)
    for (let i = 1; i <= 8; i++) {
      act(() => {
        capturedProps.onSelectDocument!(createDocListItem({ id: `doc-${i}`, title: `Doc ${i}` }));
      });
    }

    expect(capturedReaderProps.tabs).toHaveLength(8);

    // Open a 9th tab - should evict the oldest (doc-1)
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-9", title: "Doc 9" }));
    });

    expect(capturedReaderProps.tabs).toHaveLength(8);
    expect(capturedReaderProps.tabs.map((t) => t.documentId)).not.toContain("doc-1");
    expect(capturedReaderProps.tabs.map((t) => t.documentId)).toContain("doc-9");
    expect(capturedReaderProps.activeTabId).toBe("doc-9");
    root.unmount();
  });

  it("activates a tab via onActivateTab", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1" }));
    });
    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-2" }));
    });

    // Activate the first tab
    act(() => {
      capturedReaderProps.onActivateTab!("doc-1");
    });

    expect(capturedReaderProps.activeTabId).toBe("doc-1");
    root.unmount();
  });

  it("opens a sibling document via onOpenSibling", () => {
    const root = render();

    act(() => {
      capturedReaderProps.onOpenSibling!({ id: "sibling-1", key: "design", title: "Design Doc" });
    });

    expect(capturedReaderProps.tabs).toHaveLength(1);
    expect(capturedReaderProps.tabs[0].documentId).toBe("sibling-1");
    expect(capturedReaderProps.activeTabId).toBe("sibling-1");
    root.unmount();
  });

  it("sets selectedDocumentId to match active tab", () => {
    const root = render();

    act(() => {
      capturedProps.onSelectDocument!(createDocListItem({ id: "doc-1" }));
    });

    expect(capturedProps.selectedDocumentId).toBe("doc-1");
    root.unmount();
  });
});
