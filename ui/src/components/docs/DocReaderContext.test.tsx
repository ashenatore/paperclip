// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { CompanyDocumentDetail } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocReaderContext } from "./DocReaderContext";

vi.mock("@/lib/router", () => ({
  Link: ({ children, className, to, ...props }: any) => (
    <a className={className} href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/", search: "", hash: "" }),
  useNavigate: () => () => {},
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | false)[]) => args.filter(Boolean).join(" "),
  relativeTime: () => "3h ago",
}));

vi.mock("@/lib/status-colors", () => ({
  statusBadge: {
    in_progress: "bg-blue-100 text-blue-800",
    todo: "bg-yellow-100 text-yellow-800",
    done: "bg-green-100 text-green-800",
  },
  statusBadgeDefault: "bg-gray-100 text-gray-800",
}));

vi.mock("lucide-react", () => ({
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  ThumbsUp: () => <span data-testid="thumbs-up" />,
  ThumbsDown: () => <span data-testid="thumbs-down" />,
  AlertTriangle: () => <span data-testid="alert-triangle" />,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createDetail(overrides: Partial<CompanyDocumentDetail> = {}): CompanyDocumentDetail {
  return {
    id: "doc-1",
    companyId: "company-1",
    issueId: "issue-1",
    issueTitle: "Build feature X",
    issueStatus: "in_progress",
    issueAssigneeAgentId: "agent-1",
    assigneeAgentName: "TestAgent",
    key: "plan",
    title: "My Plan",
    format: "markdown",
    body: "# Plan body",
    latestRevisionId: "rev-2",
    latestRevisionNumber: 2,
    latestChangeSummary: null,
    revisionCount: 2,
    createdByAgentId: "agent-1",
    createdByAgentName: "Creator",
    updatedByAgentId: "agent-2",
    updatedByAgentName: "Updater",
    createdAt: new Date("2026-04-10T12:00:00.000Z"),
    updatedAt: new Date("2026-04-10T14:00:00.000Z"),
    feedbackUpVotes: 3,
    feedbackDownVotes: 1,
    siblingDocuments: [],
    revisionAuthors: [],
    ...overrides,
  };
}

describe("DocReaderContext", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders issue title as a link", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext detail={createDetail()} companyId="company-1" onOpenSibling={() => {}} />,
      );
    });

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/issues/issue-1");
    expect(container.textContent).toContain("Build feature X");
    root.unmount();
  });

  it("shows feedback vote counts", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext detail={createDetail({ feedbackUpVotes: 5, feedbackDownVotes: 2 })} companyId="company-1" onOpenSibling={() => {}} />,
      );
    });

    // Component starts expanded
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("2");
    root.unmount();
  });

  it("shows stale indicator when issue is active and document is old", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext
          detail={createDetail({ issueStatus: "in_progress", updatedAt: eightDaysAgo })}
          companyId="company-1"
          onOpenSibling={() => {}}
        />,
      );
    });

    // Component starts expanded
    expect(container.textContent).toContain("Stale");
    root.unmount();
  });

  it("does not show stale indicator for done issues even if old", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext
          detail={createDetail({ issueStatus: "done", updatedAt: eightDaysAgo })}
          companyId="company-1"
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).not.toContain("Stale");
    root.unmount();
  });

  it("does not show stale indicator for recently updated documents", () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext
          detail={createDetail({ issueStatus: "in_progress", updatedAt: recentDate })}
          companyId="company-1"
          onOpenSibling={() => {}}
        />,
      );
    });

    expect(container.textContent).not.toContain("Stale");
    root.unmount();
  });

  it("renders sibling document buttons", () => {
    const detail = createDetail({
      siblingDocuments: [
        { id: "sibling-1", key: "design", title: "Design Doc", revisionCount: 1, updatedAt: new Date() },
        { id: "sibling-2", key: "report", title: null, revisionCount: 3, updatedAt: new Date() },
      ],
    });
    const onOpenSibling = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext detail={detail} companyId="company-1" onOpenSibling={onOpenSibling} />,
      );
    });

    // Component starts expanded
    expect(container.textContent).toContain("design");
    expect(container.textContent).toContain("report");

    // Click a sibling button
    const siblingButtons = container.querySelectorAll("button[type='button']");
    const designButton = Array.from(siblingButtons).find(
      (b) => b.textContent?.includes("design"),
    );
    expect(designButton).toBeDefined();
    act(() => {
      designButton!.click();
    });
    expect(onOpenSibling).toHaveBeenCalledWith({
      id: "sibling-1",
      key: "design",
      title: "Design Doc",
    });
    root.unmount();
  });

  it("renders revision authors", () => {
    const detail = createDetail({
      revisionAuthors: [
        { agentId: "agent-1", agentName: "Claude", userId: null, revisionCount: 3, lastRevisionAt: new Date() },
        { agentId: "agent-2", agentName: "Codex", userId: null, revisionCount: 1, lastRevisionAt: new Date() },
      ],
    });

    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext detail={detail} companyId="company-1" onOpenSibling={() => {}} />,
      );
    });

    // Component starts expanded
    expect(container.textContent).toContain("Claude");
    expect(container.textContent).toContain("3 revs");
    expect(container.textContent).toContain("Codex");
    expect(container.textContent).toContain("1 rev");
    root.unmount();
  });

  it("toggles collapse on click", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocReaderContext detail={createDetail()} companyId="company-1" onOpenSibling={() => {}} />,
      );
    });

    // Component starts expanded - issue title is visible
    expect(container.textContent).toContain("Build feature X");

    // Click to collapse
    const toggleButton = container.querySelector("button");
    act(() => {
      toggleButton!.click();
    });

    expect(container.textContent).not.toContain("Build feature X");

    // Click again to expand
    act(() => {
      toggleButton!.click();
    });

    expect(container.textContent).toContain("Build feature X");
    root.unmount();
  });
});
