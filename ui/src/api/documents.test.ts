import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { documentsApi } from "./documents";

describe("documentsApi", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.get.mockResolvedValue([]);
  });

  describe("list", () => {
    it("calls company documents endpoint without filters", async () => {
      await documentsApi.list("company-1");

      expect(mockApi.get).toHaveBeenCalledWith("/companies/company-1/documents");
    });

    it("passes all filter params as query string", async () => {
      await documentsApi.list("company-1", {
        key: "plan",
        agentId: "agent-1",
        issueStatus: "in_progress",
        q: "test query",
        sort: "createdAt",
        order: "asc",
        limit: 10,
        offset: 20,
      });

      expect(mockApi.get).toHaveBeenCalledWith(
        "/companies/company-1/documents?key=plan&agentId=agent-1&issueStatus=in_progress&q=test+query&sort=createdAt&order=asc&limit=10&offset=20",
      );
    });

    it("omits undefined filters from query string", async () => {
      await documentsApi.list("company-1", { key: "plan" });

      const calledUrl = mockApi.get.mock.calls[0][0] as string;
      expect(calledUrl).toContain("key=plan");
      expect(calledUrl).not.toContain("agentId");
      expect(calledUrl).not.toContain("limit");
    });
  });

  describe("getDetail", () => {
    it("calls document detail endpoint", async () => {
      mockApi.get.mockResolvedValue({ id: "doc-1", body: "# Plan" });
      await documentsApi.getDetail("company-1", "doc-1");

      expect(mockApi.get).toHaveBeenCalledWith("/companies/company-1/documents/doc-1");
    });
  });

  describe("getActivity", () => {
    it("calls document activity endpoint", async () => {
      mockApi.get.mockResolvedValue({ stats: {}, recentActivity: [], activeAgents: [] });
      await documentsApi.getActivity("company-1");

      expect(mockApi.get).toHaveBeenCalledWith("/companies/company-1/documents/activity");
    });
  });
});
