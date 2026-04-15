// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { CompanyDocumentListItem } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocReader } from "./DocReader";

// Mock API
const mockDocumentsApi = vi.hoisted(() => ({
  getDetail: vi.fn(),
}));

vi.mock("@/api/documents", () => ({
  documentsApi: mockDocumentsApi,
}));

vi.mock("@/components/MarkdownBody", () => ({
  MarkdownBody: ({ children, className }: { children: string; className?: string }) => (
    <div className={className} data-testid="markdown-body">{children}</div>
  ),
}));

vi.mock("@/components/docs/DocReaderContext", () => ({
  DocReaderContext: ({ detail }: any) => (
    <div data-testid="doc-reader-context">{detail.title}</div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | false)[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@tanstack/react-query", async () => {
  const React = await import("react");
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: ({ queryKey, enabled }: any) => {
      if (!enabled) return { data: null, isLoading: false, error: null };
      // Return mock data based on the document ID in the query key
      const documentId = queryKey[queryKey.length - 1];
      const mockDetail = mockGetDetailResult.get(documentId);
      if (mockDetail?.error) return { data: null, isLoading: false, error: new Error(mockDetail.error) };
      if (mockDetail?.data) return { data: mockDetail.data, isLoading: false, error: null };
      if (mockDetail?.loading) return { data: null, isLoading: true, error: null };
      return { data: null, isLoading: false, error: null };
    },
  };
});

vi.mock("lucide-react", () => ({
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  X: () => <span data-testid="x-icon">X</span>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Map of documentId -> mock query result
const mockGetDetailResult = new Map<string, { data?: any; error?: string; loading?: boolean }>();

function createTab(docId: string, doc?: Partial<CompanyDocumentListItem>) {
  return {
    documentId: docId,
    doc: doc ? { id: docId, key: doc.key ?? "plan", title: doc.title ?? "Test Doc" } as CompanyDocumentListItem : undefined,
  };
}

describe("DocReader", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockGetDetailResult.clear();
  });

  afterEach(() => {
    container.remove();
  });

  it("shows empty state when no tabs are open", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[]}
          activeTabId={null}
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("Select a document from the list to review it");
    root.unmount();
  });

  it("renders tab bar with tab labels", () => {
    mockGetDetailResult.set("doc-1", { data: { id: "doc-1", key: "plan", title: "My Plan", body: "# Plan", issueId: "issue-1", issueTitle: "Issue", issueStatus: "in_progress", siblingDocuments: [], revisionAuthors: [] } });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[createTab("doc-1", { title: "My Plan" })]}
          activeTabId="doc-1"
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("My Plan");
    root.unmount();
  });

  it("truncates long tab labels", () => {
    const longTitle = "A".repeat(30);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[createTab("doc-1", { title: longTitle })]}
          activeTabId="doc-1"
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    // The label should be truncated (contains ellipsis character or is shorter)
    const tabLabel = container.querySelector("[class*='truncate']");
    expect(tabLabel).not.toBeNull();
    root.unmount();
  });

  it("calls onActivateTab when a tab is clicked", () => {
    const onActivateTab = vi.fn();
    mockGetDetailResult.set("doc-1", { data: { id: "doc-1", body: "a" } });
    mockGetDetailResult.set("doc-2", { data: { id: "doc-2", body: "b" } });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[
            createTab("doc-1", { title: "Doc 1" }),
            createTab("doc-2", { title: "Doc 2" }),
          ]}
          activeTabId="doc-1"
          onActivateTab={onActivateTab}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    // Find and click the second tab
    const tabs = container.querySelectorAll("[class*='cursor-pointer']");
    expect(tabs.length).toBe(2);
    act(() => {
      tabs[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onActivateTab).toHaveBeenCalledWith("doc-2");
    root.unmount();
  });

  it("calls onCloseTab when close button is clicked", () => {
    const onCloseTab = vi.fn();
    mockGetDetailResult.set("doc-1", { data: { id: "doc-1", body: "a" } });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[createTab("doc-1", { title: "Doc 1" })]}
          activeTabId="doc-1"
          onActivateTab={() => {}}
          onCloseTab={onCloseTab}
          onOpenSibling={() => {}}
        />,
      );
    });

    // Find the close button (has aria-label)
    const closeButton = container.querySelector("button[aria-label^='Close tab']");
    expect(closeButton).not.toBeNull();
    act(() => {
      closeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCloseTab).toHaveBeenCalledWith("doc-1");
    root.unmount();
  });

  it("shows loading state for tab content", () => {
    mockGetDetailResult.set("doc-1", { loading: true });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[createTab("doc-1")]}
          activeTabId="doc-1"
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("Loading document");
    root.unmount();
  });

  it("shows error state when document load fails", () => {
    mockGetDetailResult.set("doc-1", { error: "Network error" });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[createTab("doc-1")]}
          activeTabId="doc-1"
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("Network error");
    root.unmount();
  });

  it("renders document body when loaded", () => {
    mockGetDetailResult.set("doc-1", {
      data: {
        id: "doc-1",
        key: "plan",
        title: "My Plan",
        body: "# Hello World",
        issueId: "issue-1",
        issueTitle: "Test Issue",
        issueStatus: "in_progress",
        siblingDocuments: [],
        revisionAuthors: [],
      },
    });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[createTab("doc-1", { title: "My Plan" })]}
          activeTabId="doc-1"
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("# Hello World");
    expect(container.textContent).toContain("My Plan");
    root.unmount();
  });

  it("falls back to documentId when no doc metadata is available", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReader
          companyId="company-1"
          tabs={[{ documentId: "abc-123" }]}
          activeTabId="abc-123"
          onActivateTab={() => {}}
          onCloseTab={() => {}}
          onOpenSibling={() => {}}
        />,
      );
    });

    // Tab label should show the documentId (truncated)
    expect(container.textContent).toContain("abc-123");
    root.unmount();
  });
});
