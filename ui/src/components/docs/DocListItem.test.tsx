// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { CompanyDocumentListItem } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocListItem } from "./DocListItem";

vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | false)[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/lib/timeAgo", () => ({
  timeAgo: () => "2h ago",
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock("lucide-react", () => ({
  ThumbsUp: () => <span data-testid="thumbs-up">up</span>,
  ThumbsDown: () => <span data-testid="thumbs-down">down</span>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createDoc(overrides: Partial<CompanyDocumentListItem> = {}): CompanyDocumentListItem {
  return {
    id: "doc-1",
    companyId: "company-1",
    issueId: "issue-1",
    issueTitle: "Test Issue",
    issueStatus: "in_progress",
    issueAssigneeAgentId: null,
    assigneeAgentName: null,
    key: "plan",
    title: "My Plan",
    format: "markdown",
    revisionCount: 2,
    latestRevisionNumber: 2,
    latestChangeSummary: null,
    createdByAgentId: null,
    createdByAgentName: null,
    updatedByAgentId: "agent-1",
    updatedByAgentName: "TestAgent",
    createdAt: new Date("2026-04-10T12:00:00.000Z"),
    updatedAt: new Date("2026-04-10T14:00:00.000Z"),
    feedbackUpVotes: 0,
    feedbackDownVotes: 0,
    ...overrides,
  };
}

describe("DocListItem", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders the document title", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc()} isSelected={false} isOpen={false} onClick={() => {}} />,
      );
    });

    expect(container.textContent).toContain("My Plan");
    root.unmount();
  });

  it("falls back to Untitled key when title is null", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem
          doc={createDoc({ title: null, key: "plan" })}
          isSelected={false}
          isOpen={false}
          onClick={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("Untitled plan");
    root.unmount();
  });

  it("shows key badge", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc({ key: "design" })} isSelected={false} isOpen={false} onClick={() => {}} />,
      );
    });

    expect(container.textContent).toContain("design");
    root.unmount();
  });

  it("shows revision badge when revisionCount > 1", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc({ revisionCount: 3 })} isSelected={false} isOpen={false} onClick={() => {}} />,
      );
    });

    expect(container.textContent).toContain("v3");
    root.unmount();
  });

  it("hides revision badge when revisionCount is 1", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc({ revisionCount: 1 })} isSelected={false} isOpen={false} onClick={() => {}} />,
      );
    });

    expect(container.textContent).not.toContain("v1");
    root.unmount();
  });

  it("shows feedback counts when votes exist", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem
          doc={createDoc({ feedbackUpVotes: 5, feedbackDownVotes: 2 })}
          isSelected={false}
          isOpen={false}
          onClick={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("2");
    root.unmount();
  });

  it("shows issue title", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc({ issueTitle: "Build feature X" })} isSelected={false} isOpen={false} onClick={() => {}} />,
      );
    });

    expect(container.textContent).toContain("Build feature X");
    root.unmount();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc()} isSelected={false} isOpen={false} onClick={onClick} />,
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    button!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    root.unmount();
  });

  it("renders agent name", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <DocListItem doc={createDoc({ updatedByAgentName: "Claude" })} isSelected={false} isOpen={false} onClick={() => {}} />,
      );
    });

    expect(container.textContent).toContain("Claude");
    root.unmount();
  });
});
