import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDocumentsSvc = vi.hoisted(() => ({
  listCompanyDocuments: vi.fn(),
  getCompanyDocumentDetail: vi.fn(),
  getCompanyDocumentActivity: vi.fn(),
  getIssueDocumentPayload: vi.fn(),
  listIssueDocuments: vi.fn(),
  getIssueDocumentByKey: vi.fn(),
  listIssueDocumentRevisions: vi.fn(),
  upsertIssueDocument: vi.fn(),
  restoreIssueDocumentRevision: vi.fn(),
  deleteIssueDocument: vi.fn(),
}));

const noopService = () => ({});

vi.mock("../services/index.js", () => ({
  accessService: noopService,
  agentService: noopService,
  executionWorkspaceService: noopService,
  feedbackService: noopService,
  goalService: noopService,
  heartbeatService: noopService,
  instanceSettingsService: noopService,
  issueApprovalService: noopService,
  issueService: noopService,
  documentService: () => mockDocumentsSvc,
  logActivity: vi.fn(),
  projectService: noopService,
  routineService: noopService,
  workProductService: noopService,
}));

vi.mock("../routes/authz.js", () => ({
  assertCompanyAccess: vi.fn(),
  getActorInfo: vi.fn(() => ({ agentId: null, userId: "user-1" })),
}));

vi.mock("../services/issue-assignment-wakeup.js", () => ({
  queueIssueAssignmentWakeup: vi.fn(),
}));

vi.mock("../services/issue-execution-policy.js", () => ({
  applyIssueExecutionPolicyTransition: vi.fn(),
  normalizeIssueExecutionPolicy: vi.fn(),
  parseIssueExecutionState: vi.fn(),
}));

vi.mock("../telemetry.js", () => ({
  getTelemetryClient: vi.fn(() => ({ track: vi.fn() })),
}));

vi.mock("../middleware/logger.js", () => ({
  logger: vi.fn(),
}));

async function createApp(actorOverrides: Record<string, unknown> = {}) {
  const [{ errorHandler }, { issueRoutes }] = await Promise.all([
    import("../middleware/index.js"),
    import("../routes/issues.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: false,
      ...actorOverrides,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("company documents routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/companies/:companyId/documents", () => {
    it("returns documents list for board user", async () => {
      mockDocumentsSvc.listCompanyDocuments.mockResolvedValue([
        { id: "doc-1", key: "plan", title: "Plan A" },
      ]);

      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: "doc-1", key: "plan", title: "Plan A" }]);
      expect(mockDocumentsSvc.listCompanyDocuments).toHaveBeenCalledWith(
        "company-1",
        expect.objectContaining({}),
      );
    });

    it("passes filter params to service", async () => {
      mockDocumentsSvc.listCompanyDocuments.mockResolvedValue([]);

      const app = await createApp();
      await request(app).get(
        "/api/companies/company-1/documents?key=plan&agentId=agent-1&issueStatus=in_progress&q=test&sort=createdAt&order=asc&limit=10&offset=20",
      );

      expect(mockDocumentsSvc.listCompanyDocuments).toHaveBeenCalledWith("company-1", {
        key: "plan",
        agentId: "agent-1",
        issueStatus: "in_progress",
        q: "test",
        sort: "createdAt",
        order: "asc",
        limit: 10,
        offset: 20,
      });
    });

    it("uses default limit and offset when not provided", async () => {
      mockDocumentsSvc.listCompanyDocuments.mockResolvedValue([]);

      const app = await createApp();
      await request(app).get("/api/companies/company-1/documents");

      expect(mockDocumentsSvc.listCompanyDocuments).toHaveBeenCalledWith(
        "company-1",
        expect.objectContaining({ limit: undefined, offset: undefined }),
      );
    });

    it("rejects non-board actors with 403", async () => {
      const app = await createApp({ type: "agent", agentId: "agent-1" });
      const res = await request(app).get("/api/companies/company-1/documents");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Board authentication required");
    });

    it("rejects negative limit with 400", async () => {
      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents?limit=-5");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("limit must be a positive integer");
    });

    it("rejects zero limit with 400", async () => {
      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents?limit=0");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("limit must be a positive integer");
    });

    it("rejects negative offset with 400", async () => {
      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents?offset=-1");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("offset must be a non-negative integer");
    });

    it("rejects invalid order with 400", async () => {
      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents?order=sideways");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("order must be 'asc' or 'desc'");
    });

    it("accepts asc order", async () => {
      mockDocumentsSvc.listCompanyDocuments.mockResolvedValue([]);

      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents?order=asc");

      expect(res.status).toBe(200);
    });

    it("accepts desc order", async () => {
      mockDocumentsSvc.listCompanyDocuments.mockResolvedValue([]);

      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents?order=desc");

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/companies/:companyId/documents/:documentId", () => {
    it("returns document detail for board user", async () => {
      mockDocumentsSvc.getCompanyDocumentDetail.mockResolvedValue({
        id: "doc-1",
        key: "plan",
        body: "# Plan",
      });

      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents/doc-1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: "doc-1", key: "plan", body: "# Plan" });
      expect(mockDocumentsSvc.getCompanyDocumentDetail).toHaveBeenCalledWith("company-1", "doc-1");
    });

    it("returns 404 for missing document", async () => {
      mockDocumentsSvc.getCompanyDocumentDetail.mockResolvedValue(null);

      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents/doc-missing");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Document not found");
    });

    it("rejects non-board actors with 403", async () => {
      const app = await createApp({ type: "agent", agentId: "agent-1" });
      const res = await request(app).get("/api/companies/company-1/documents/doc-1");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Board authentication required");
    });
  });

  describe("GET /api/companies/:companyId/documents/activity", () => {
    it("returns activity stats for board user", async () => {
      const activity = {
        stats: {
          totalDocuments: 5,
          documentsByKey: { plan: 3, report: 2 },
          recentlyCreated: 1,
          recentlyUpdated: 2,
          unreviewedCount: 1,
          staleCount: 0,
        },
        recentActivity: [],
        activeAgents: [],
      };
      mockDocumentsSvc.getCompanyDocumentActivity.mockResolvedValue(activity);

      const app = await createApp();
      const res = await request(app).get("/api/companies/company-1/documents/activity");

      expect(res.status).toBe(200);
      expect(res.body.stats.totalDocuments).toBe(5);
      expect(res.body.stats.documentsByKey).toEqual({ plan: 3, report: 2 });
      expect(mockDocumentsSvc.getCompanyDocumentActivity).toHaveBeenCalledWith("company-1");
    });

    it("rejects non-board actors with 403", async () => {
      const app = await createApp({ type: "agent", agentId: "agent-1" });
      const res = await request(app).get("/api/companies/company-1/documents/activity");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Board authentication required");
    });
  });
});
