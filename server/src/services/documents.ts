import { and, asc, desc, eq, sql, count } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm/alias";
import type { Db } from "@paperclipai/db";
import {
  agents,
  documentRevisions,
  documents,
  feedbackVotes,
  issueDocuments,
  issues,
} from "@paperclipai/db";
import {
  issueDocumentKeySchema,
  type CompanyDocumentActivity,
  type CompanyDocumentDetail,
  type CompanyDocumentListItem,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

function normalizeDocumentKey(key: string) {
  const normalized = key.trim().toLowerCase();
  const parsed = issueDocumentKeySchema.safeParse(normalized);
  if (!parsed.success) {
    throw unprocessable("Invalid document key", parsed.error.issues);
  }
  return parsed.data;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505";
}

export function extractLegacyPlanBody(description: string | null | undefined) {
  if (!description) return null;
  const match = /<plan>\s*([\s\S]*?)\s*<\/plan>/i.exec(description);
  if (!match) return null;
  const body = match[1]?.trim();
  return body ? body : null;
}

function mapIssueDocumentRow(
  row: {
    id: string;
    companyId: string;
    issueId: string;
    key: string;
    title: string | null;
    format: string;
    latestBody: string;
    latestRevisionId: string | null;
    latestRevisionNumber: number;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    updatedByAgentId: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  includeBody: boolean,
) {
  return {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId,
    key: row.key,
    title: row.title,
    format: row.format,
    ...(includeBody ? { body: row.latestBody } : {}),
    latestRevisionId: row.latestRevisionId ?? null,
    latestRevisionNumber: row.latestRevisionNumber,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const issueDocumentSelect = {
  id: documents.id,
  companyId: documents.companyId,
  issueId: issueDocuments.issueId,
  key: issueDocuments.key,
  title: documents.title,
  format: documents.format,
  latestBody: documents.latestBody,
  latestRevisionId: documents.latestRevisionId,
  latestRevisionNumber: documents.latestRevisionNumber,
  createdByAgentId: documents.createdByAgentId,
  createdByUserId: documents.createdByUserId,
  updatedByAgentId: documents.updatedByAgentId,
  updatedByUserId: documents.updatedByUserId,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export function documentService(db: Db) {
  return {
    getIssueDocumentPayload: async (issue: { id: string; description: string | null }) => {
      const [planDocument, documentSummaries] = await Promise.all([
        db
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issue.id), eq(issueDocuments.key, "plan")))
          .then((rows) => rows[0] ?? null),
        db
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(eq(issueDocuments.issueId, issue.id))
          .orderBy(asc(issueDocuments.key), desc(documents.updatedAt)),
      ]);

      const legacyPlanBody = planDocument ? null : extractLegacyPlanBody(issue.description);

      return {
        planDocument: planDocument ? mapIssueDocumentRow(planDocument, true) : null,
        documentSummaries: documentSummaries.map((row) => mapIssueDocumentRow(row, false)),
        legacyPlanDocument: legacyPlanBody
          ? {
              key: "plan" as const,
              body: legacyPlanBody,
              source: "issue_description" as const,
            }
          : null,
      };
    },

    listIssueDocuments: async (issueId: string) => {
      const rows = await db
        .select(issueDocumentSelect)
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .where(eq(issueDocuments.issueId, issueId))
        .orderBy(asc(issueDocuments.key), desc(documents.updatedAt));
      return rows.map((row) => mapIssueDocumentRow(row, true));
    },

    getIssueDocumentByKey: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      const row = await db
        .select(issueDocumentSelect)
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
        .then((rows) => rows[0] ?? null);
      return row ? mapIssueDocumentRow(row, true) : null;
    },

    listIssueDocumentRevisions: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db
        .select({
          id: documentRevisions.id,
          companyId: documentRevisions.companyId,
          documentId: documentRevisions.documentId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          revisionNumber: documentRevisions.revisionNumber,
          title: documentRevisions.title,
          format: documentRevisions.format,
          body: documentRevisions.body,
          changeSummary: documentRevisions.changeSummary,
          createdByAgentId: documentRevisions.createdByAgentId,
          createdByUserId: documentRevisions.createdByUserId,
          createdAt: documentRevisions.createdAt,
        })
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .innerJoin(documentRevisions, eq(documentRevisions.documentId, documents.id))
        .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
        .orderBy(desc(documentRevisions.revisionNumber));
    },

    upsertIssueDocument: async (input: {
      issueId: string;
      key: string;
      title?: string | null;
      format: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
      createdByRunId?: string | null;
    }) => {
      const key = normalizeDocumentKey(input.key);
      const issue = await db
        .select({ id: issues.id, companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, input.issueId))
        .then((rows) => rows[0] ?? null);
      if (!issue) throw notFound("Issue not found");

      try {
        return await db.transaction(async (tx) => {
          const now = new Date();
          const existing = await tx
            .select({
              id: documents.id,
              companyId: documents.companyId,
              issueId: issueDocuments.issueId,
              key: issueDocuments.key,
              title: documents.title,
              format: documents.format,
              latestBody: documents.latestBody,
              latestRevisionId: documents.latestRevisionId,
              latestRevisionNumber: documents.latestRevisionNumber,
              createdByAgentId: documents.createdByAgentId,
              createdByUserId: documents.createdByUserId,
              updatedByAgentId: documents.updatedByAgentId,
              updatedByUserId: documents.updatedByUserId,
              createdAt: documents.createdAt,
              updatedAt: documents.updatedAt,
            })
            .from(issueDocuments)
            .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
            .where(and(eq(issueDocuments.issueId, issue.id), eq(issueDocuments.key, key)))
            .then((rows) => rows[0] ?? null);

          if (existing) {
            if (!input.baseRevisionId) {
              throw conflict("Document update requires baseRevisionId", {
                currentRevisionId: existing.latestRevisionId,
              });
            }
            if (input.baseRevisionId !== existing.latestRevisionId) {
              throw conflict("Document was updated by someone else", {
                currentRevisionId: existing.latestRevisionId,
              });
            }

            const nextRevisionNumber = existing.latestRevisionNumber + 1;
            const [revision] = await tx
              .insert(documentRevisions)
              .values({
                companyId: issue.companyId,
                documentId: existing.id,
                revisionNumber: nextRevisionNumber,
                title: input.title ?? null,
                format: input.format,
                body: input.body,
                changeSummary: input.changeSummary ?? null,
                createdByAgentId: input.createdByAgentId ?? null,
                createdByUserId: input.createdByUserId ?? null,
                createdByRunId: input.createdByRunId ?? null,
                createdAt: now,
              })
              .returning();

            await tx
              .update(documents)
              .set({
                title: input.title ?? null,
                format: input.format,
                latestBody: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                updatedAt: now,
              })
              .where(eq(documents.id, existing.id));

            await tx
              .update(issueDocuments)
              .set({ updatedAt: now })
              .where(eq(issueDocuments.documentId, existing.id));

            return {
              created: false as const,
              document: {
                ...existing,
                title: input.title ?? null,
                format: input.format,
                body: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                updatedAt: now,
              },
            };
          }

          if (input.baseRevisionId) {
            throw conflict("Document does not exist yet", { key });
          }

          const [document] = await tx
            .insert(documents)
            .values({
              companyId: issue.companyId,
              title: input.title ?? null,
              format: input.format,
              latestBody: input.body,
              latestRevisionId: null,
              latestRevisionNumber: 1,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              updatedByAgentId: input.createdByAgentId ?? null,
              updatedByUserId: input.createdByUserId ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId: issue.companyId,
              documentId: document.id,
              revisionNumber: 1,
              title: input.title ?? null,
              format: input.format,
              body: input.body,
              changeSummary: input.changeSummary ?? null,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              createdByRunId: input.createdByRunId ?? null,
              createdAt: now,
            })
            .returning();

          await tx
            .update(documents)
            .set({ latestRevisionId: revision.id })
            .where(eq(documents.id, document.id));

          await tx.insert(issueDocuments).values({
            companyId: issue.companyId,
            issueId: issue.id,
            documentId: document.id,
            key,
            createdAt: now,
            updatedAt: now,
          });

          return {
            created: true as const,
            document: {
              id: document.id,
              companyId: issue.companyId,
              issueId: issue.id,
              key,
              title: document.title,
              format: document.format,
              body: document.latestBody,
              latestRevisionId: revision.id,
              latestRevisionNumber: 1,
              createdByAgentId: document.createdByAgentId,
              createdByUserId: document.createdByUserId,
              updatedByAgentId: document.updatedByAgentId,
              updatedByUserId: document.updatedByUserId,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            },
          };
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("Document key already exists on this issue", { key });
        }
        throw error;
      }
    },

    restoreIssueDocumentRevision: async (input: {
      issueId: string;
      key: string;
      revisionId: string;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      const key = normalizeDocumentKey(input.key);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, input.issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) throw notFound("Document not found");

        const revision = await tx
          .select({
            id: documentRevisions.id,
            companyId: documentRevisions.companyId,
            documentId: documentRevisions.documentId,
            revisionNumber: documentRevisions.revisionNumber,
            title: documentRevisions.title,
            format: documentRevisions.format,
            body: documentRevisions.body,
          })
          .from(documentRevisions)
          .where(and(eq(documentRevisions.id, input.revisionId), eq(documentRevisions.documentId, existing.id)))
          .then((rows) => rows[0] ?? null);

        if (!revision) throw notFound("Document revision not found");
        if (existing.latestRevisionId === revision.id) {
          throw conflict("Selected revision is already the latest revision", {
            currentRevisionId: existing.latestRevisionId,
          });
        }

        const now = new Date();
        const nextRevisionNumber = existing.latestRevisionNumber + 1;
        const [restoredRevision] = await tx
          .insert(documentRevisions)
          .values({
            companyId: existing.companyId,
            documentId: existing.id,
            revisionNumber: nextRevisionNumber,
            title: revision.title ?? null,
            format: revision.format,
            body: revision.body,
            changeSummary: `Restored from revision ${revision.revisionNumber}`,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        await tx
          .update(documents)
          .set({
            title: revision.title ?? null,
            format: revision.format,
            latestBody: revision.body,
            latestRevisionId: restoredRevision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, existing.id));

        await tx
          .update(issueDocuments)
          .set({ updatedAt: now })
          .where(eq(issueDocuments.documentId, existing.id));

        return {
          restoredFromRevisionId: revision.id,
          restoredFromRevisionNumber: revision.revisionNumber,
          document: {
            ...existing,
            title: revision.title ?? null,
            format: revision.format,
            body: revision.body,
            latestRevisionId: restoredRevision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          },
        };
      });
    },

    deleteIssueDocument: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) return null;

        await tx.delete(issueDocuments).where(eq(issueDocuments.documentId, existing.id));
        await tx.delete(documents).where(eq(documents.id, existing.id));

        return {
          ...existing,
          body: existing.latestBody,
          latestRevisionId: existing.latestRevisionId ?? null,
        };
      });
    },

    listCompanyDocuments: async (
      companyId: string,
      filters?: {
        key?: string;
        agentId?: string;
        issueStatus?: string;
        q?: string;
        sort?: string;
        order?: "asc" | "desc";
        limit?: number;
        offset?: number;
      },
    ): Promise<CompanyDocumentListItem[]> => {
      const revisionCountSub = db
        .select({
          documentId: documentRevisions.documentId,
          revisionCount: count().as("revision_count"),
        })
        .from(documentRevisions)
        .groupBy(documentRevisions.documentId)
        .as("rc");

      // Build a subquery that aggregates feedback votes per document by joining
      // document_revisions to feedback_votes on revision id = target_id.
      const feedbackPerDoc = db
        .select({
          documentId: documentRevisions.documentId,
          upVotes: sql<number>`coalesce(sum(case when ${feedbackVotes.vote} = 'up' then 1 else 0 end), 0)`,
          downVotes: sql<number>`coalesce(sum(case when ${feedbackVotes.vote} = 'down' then 1 else 0 end), 0)`,
        })
        .from(documentRevisions)
        .leftJoin(feedbackVotes, eq(feedbackVotes.targetId, documentRevisions.id))
        .where(eq(feedbackVotes.targetType, "issue_document_revision"))
        .groupBy(documentRevisions.documentId)
        .as("fpd");

      const conditions = [eq(documents.companyId, companyId)];
      if (filters?.key) {
        conditions.push(eq(issueDocuments.key, filters.key));
      }
      if (filters?.agentId) {
        conditions.push(
          sql`(${documents.createdByAgentId} = ${filters.agentId} OR ${documents.updatedByAgentId} = ${filters.agentId})`,
        );
      }
      if (filters?.issueStatus) {
        conditions.push(eq(issues.status, filters.issueStatus));
      }
      if (filters?.q) {
        conditions.push(
          sql`(${documents.title} ilike ${"%" + filters.q + "%"} OR ${issues.title} ilike ${"%" + filters.q + "%"})`,
        );
      }

      const orderDir = filters?.order === "asc" ? asc : desc;
      const sortColumn =
        filters?.sort === "createdAt"
          ? documents.createdAt
          : filters?.sort === "revisionCount"
            ? sql`coalesce(${revisionCountSub.revisionCount}, 0)`
            : filters?.sort === "key"
              ? issueDocuments.key
              : documents.updatedAt;

      const latestChangeSummarySub = db
        .select({
          documentId: documentRevisions.documentId,
          changeSummary: documentRevisions.changeSummary,
          rowNum: sql<number>`row_number() over (partition by ${documentRevisions.documentId} order by ${documentRevisions.revisionNumber} desc)`,
        })
        .from(documentRevisions)
        .as("lcs");

      const assigneeAgent = aliasedTable(agents, "assignee_agent");
      const creatorAgent = aliasedTable(agents, "creator_agent");
      const updaterAgent = aliasedTable(agents, "updater_agent");

      const rows = await db
        .select({
          id: documents.id,
          companyId: documents.companyId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          title: documents.title,
          format: documents.format,
          latestRevisionNumber: documents.latestRevisionNumber,
          latestChangeSummary: sql<string | null>`lcs.changeSummary`,
          createdByAgentId: documents.createdByAgentId,
          updatedByAgentId: documents.updatedByAgentId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          issueTitle: issues.title,
          issueStatus: issues.status,
          issueAssigneeAgentId: issues.assigneeAgentId,
          assigneeAgentName: sql<string | null>`assignee_agent.name`,
          createdByAgentName: sql<string | null>`creator_agent.name`,
          updatedByAgentName: sql<string | null>`updater_agent.name`,
          revisionCount: sql<number>`coalesce(${revisionCountSub.revisionCount}, 0)`,
          feedbackUpVotes: sql<number>`coalesce(${feedbackPerDoc.upVotes}, 0)`,
          feedbackDownVotes: sql<number>`coalesce(${feedbackPerDoc.downVotes}, 0)`,
        })
        .from(documents)
        .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
        .innerJoin(issues, eq(issueDocuments.issueId, issues.id))
        .leftJoin(assigneeAgent, eq(issues.assigneeAgentId, assigneeAgent.id))
        .leftJoin(creatorAgent, eq(documents.createdByAgentId, creatorAgent.id))
        .leftJoin(updaterAgent, eq(documents.updatedByAgentId, updaterAgent.id))
        .leftJoin(revisionCountSub, eq(documents.id, revisionCountSub.documentId))
        .leftJoin(feedbackPerDoc, eq(documents.id, feedbackPerDoc.documentId))
        .leftJoin(latestChangeSummarySub, and(eq(documents.id, sql`lcs.document_id`), sql`lcs.row_num = 1`))
        .where(and(...conditions))
        .orderBy(orderDir(sortColumn))
        .limit(filters?.limit ?? 50)
        .offset(filters?.offset ?? 0);

      return rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        issueId: row.issueId,
        issueTitle: row.issueTitle,
        issueStatus: row.issueStatus,
        issueAssigneeAgentId: row.issueAssigneeAgentId,
        assigneeAgentName: row.assigneeAgentName,
        key: row.key,
        title: row.title,
        format: row.format,
        revisionCount: row.revisionCount,
        latestRevisionNumber: row.latestRevisionNumber,
        latestChangeSummary: row.latestChangeSummary,
        createdByAgentId: row.createdByAgentId,
        createdByAgentName: row.createdByAgentName,
        updatedByAgentId: row.updatedByAgentId,
        updatedByAgentName: row.updatedByAgentName,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        feedbackUpVotes: row.feedbackUpVotes,
        feedbackDownVotes: row.feedbackDownVotes,
      }));
    },

    getCompanyDocumentDetail: async (
      companyId: string,
      documentId: string,
    ): Promise<CompanyDocumentDetail | null> => {
      const detailAssigneeAgent = aliasedTable(agents, "assignee_agent");
      const detailCreatorAgent = aliasedTable(agents, "creator_agent");
      const detailUpdaterAgent = aliasedTable(agents, "updater_agent");

      const row = await db
        .select({
          id: documents.id,
          companyId: documents.companyId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          title: documents.title,
          format: documents.format,
          latestBody: documents.latestBody,
          latestRevisionId: documents.latestRevisionId,
          latestRevisionNumber: documents.latestRevisionNumber,
          createdByAgentId: documents.createdByAgentId,
          updatedByAgentId: documents.updatedByAgentId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          issueTitle: issues.title,
          issueStatus: issues.status,
          issueAssigneeAgentId: issues.assigneeAgentId,
          assigneeAgentName: sql<string | null>`assignee_agent.name`,
          createdByAgentName: sql<string | null>`creator_agent.name`,
          updatedByAgentName: sql<string | null>`updater_agent.name`,
        })
        .from(documents)
        .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
        .innerJoin(issues, eq(issueDocuments.issueId, issues.id))
        .leftJoin(detailAssigneeAgent, eq(issues.assigneeAgentId, detailAssigneeAgent.id))
        .leftJoin(detailCreatorAgent, eq(documents.createdByAgentId, detailCreatorAgent.id))
        .leftJoin(detailUpdaterAgent, eq(documents.updatedByAgentId, detailUpdaterAgent.id))
        .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!row) return null;

      const raAgent = aliasedTable(agents, "ra_agent");

      const [siblingRows, revisionAuthorRows, feedbackRow, revisionCountRow] = await Promise.all([
        // Sibling documents
        db
          .select({
            id: documents.id,
            key: issueDocuments.key,
            title: documents.title,
            updatedAt: documents.updatedAt,
          })
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(
            and(
              eq(issueDocuments.issueId, row.issueId),
              sql`${documents.id} != ${documentId}`,
            ),
          )
          .orderBy(asc(issueDocuments.key)),
        // Revision authors
        db
          .select({
            agentId: documentRevisions.createdByAgentId,
            userId: documentRevisions.createdByUserId,
            revisionCount: count().as("revision_count"),
            lastRevisionAt: sql<Date>`max(${documentRevisions.createdAt})`,
            agentName: sql<string | null>`ra_agent.name`,
          })
          .from(documentRevisions)
          .leftJoin(raAgent, eq(documentRevisions.createdByAgentId, raAgent.id))
          .where(eq(documentRevisions.documentId, documentId))
          .groupBy(documentRevisions.createdByAgentId, documentRevisions.createdByUserId, sql`ra_agent.name`),
        // Feedback votes for this document (via its revisions)
        db
          .select({
            upVotes: sql<number>`coalesce(sum(case when ${feedbackVotes.vote} = 'up' then 1 else 0 end), 0)`,
            downVotes: sql<number>`coalesce(sum(case when ${feedbackVotes.vote} = 'down' then 1 else 0 end), 0)`,
          })
          .from(documentRevisions)
          .leftJoin(
            feedbackVotes,
            and(
              eq(feedbackVotes.targetId, documentRevisions.id),
              eq(feedbackVotes.targetType, "issue_document_revision"),
            ),
          )
          .where(eq(documentRevisions.documentId, documentId))
          .then((rows) => rows[0] ?? { upVotes: 0, downVotes: 0 }),
        // Revision count
        db
          .select({ cnt: count() })
          .from(documentRevisions)
          .where(eq(documentRevisions.documentId, documentId))
          .then((rows) => rows[0]?.cnt ?? 0),
      ]);

      // Get revision counts for sibling documents
      const siblingIds = siblingRows.map((s) => s.id);
      const siblingRevisionCounts =
        siblingIds.length > 0
          ? await db
              .select({
                documentId: documentRevisions.documentId,
                revisionCount: count(),
              })
              .from(documentRevisions)
              .where(
                sql`${documentRevisions.documentId} in (${sql.join(siblingIds.map((id) => sql`${id}`), sql`, `)})`,
              )
              .groupBy(documentRevisions.documentId)
              .then((rows) => new Map(rows.map((r) => [r.documentId, r.revisionCount])))
          : new Map<string, number>();

      // Get latest change summary
      const latestChangeSummaryRow = await db
        .select({ changeSummary: documentRevisions.changeSummary })
        .from(documentRevisions)
        .where(eq(documentRevisions.documentId, documentId))
        .orderBy(desc(documentRevisions.revisionNumber))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      return {
        id: row.id,
        companyId: row.companyId,
        issueId: row.issueId,
        issueTitle: row.issueTitle,
        issueStatus: row.issueStatus,
        issueAssigneeAgentId: row.issueAssigneeAgentId,
        assigneeAgentName: row.assigneeAgentName,
        key: row.key,
        title: row.title,
        format: row.format,
        body: row.latestBody,
        latestRevisionId: row.latestRevisionId ?? null,
        latestRevisionNumber: row.latestRevisionNumber,
        latestChangeSummary: latestChangeSummaryRow?.changeSummary ?? null,
        revisionCount: revisionCountRow,
        createdByAgentId: row.createdByAgentId,
        createdByAgentName: row.createdByAgentName,
        updatedByAgentId: row.updatedByAgentId,
        updatedByAgentName: row.updatedByAgentName,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        feedbackUpVotes: Number(feedbackRow.upVotes),
        feedbackDownVotes: Number(feedbackRow.downVotes),
        siblingDocuments: siblingRows.map((s) => ({
          id: s.id,
          key: s.key,
          title: s.title,
          revisionCount: siblingRevisionCounts.get(s.id) ?? 0,
          updatedAt: s.updatedAt,
        })),
        revisionAuthors: revisionAuthorRows.map((ra) => ({
          agentId: ra.agentId,
          agentName: ra.agentName,
          userId: ra.userId,
          revisionCount: ra.revisionCount,
          lastRevisionAt: ra.lastRevisionAt,
        })),
      };
    },

    getCompanyDocumentActivity: async (companyId: string): Promise<CompanyDocumentActivity> => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const activityAgent = aliasedTable(agents, "activity_agent");
      const activeAgent = aliasedTable(agents, "active_agent");

      const [
        totalRow,
        byKeyRows,
        recentlyCreatedRow,
        recentlyUpdatedRow,
        staleRow,
        unreviewedRow,
        recentActivityRows,
        activeAgentRows,
      ] = await Promise.all([
        // Total docs
        db
          .select({ cnt: count() })
          .from(documents)
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(eq(documents.companyId, companyId))
          .then((rows) => rows[0]?.cnt ?? 0),
        // Docs by key
        db
          .select({
            key: issueDocuments.key,
            cnt: count(),
          })
          .from(documents)
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(eq(documents.companyId, companyId))
          .groupBy(issueDocuments.key)
          .then(
            (rows) =>
              Object.fromEntries(rows.map((r) => [r.key, r.cnt])) as Record<string, number>,
          ),
        // Recently created (24h)
        db
          .select({ cnt: count() })
          .from(documents)
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(
            and(
              eq(documents.companyId, companyId),
              sql`${documents.createdAt} >= ${twentyFourHoursAgo}`,
            ),
          )
          .then((rows) => rows[0]?.cnt ?? 0),
        // Recently updated (24h)
        db
          .select({ cnt: count() })
          .from(documents)
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(
            and(
              eq(documents.companyId, companyId),
              sql`${documents.updatedAt} >= ${twentyFourHoursAgo}`,
            ),
          )
          .then((rows) => rows[0]?.cnt ?? 0),
        // Stale: not updated in 7 days on open issues
        db
          .select({ cnt: count() })
          .from(documents)
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .innerJoin(issues, eq(issueDocuments.issueId, issues.id))
          .where(
            and(
              eq(documents.companyId, companyId),
              sql`${documents.updatedAt} < ${sevenDaysAgo}`,
              sql`${issues.status} not in ('done', 'cancelled')`,
            ),
          )
          .then((rows) => rows[0]?.cnt ?? 0),
        // Unreviewed: documents with no feedback votes at all
        db
          .select({ cnt: count() })
          .from(documents)
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .leftJoin(
            db
              .select({
                documentId: documentRevisions.documentId,
              })
              .from(documentRevisions)
              .innerJoin(
                feedbackVotes,
                and(
                  eq(feedbackVotes.targetId, documentRevisions.id),
                  eq(feedbackVotes.targetType, "issue_document_revision"),
                ),
              )
              .groupBy(documentRevisions.documentId)
              .as("reviewed_docs"),
            eq(documents.id, sql`reviewed_docs.document_id`),
          )
          .where(and(eq(documents.companyId, companyId), sql`reviewed_docs.document_id is null`))
          .then((rows) => rows[0]?.cnt ?? 0),
        // Recent activity from document_revisions
        db
          .select({
            documentId: documentRevisions.documentId,
            documentKey: issueDocuments.key,
            documentTitle: documents.title,
            issueId: issueDocuments.issueId,
            issueTitle: issues.title,
            action: sql<"created" | "updated">`case when ${documentRevisions.revisionNumber} = 1 then 'created' else 'updated' end`,
            agentId: documentRevisions.createdByAgentId,
            agentName: sql<string | null>`activity_agent.name`,
            timestamp: documentRevisions.createdAt,
          })
          .from(documentRevisions)
          .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
          .innerJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .innerJoin(issues, eq(issueDocuments.issueId, issues.id))
          .leftJoin(activityAgent, eq(documentRevisions.createdByAgentId, activityAgent.id))
          .where(
            and(
              eq(documentRevisions.companyId, companyId),
              sql`${documentRevisions.createdAt} >= ${twentyFourHoursAgo}`,
            ),
          )
          .orderBy(desc(documentRevisions.createdAt))
          .limit(50),
        // Active agents: top 10 by edit count in last 7 days
        db
          .select({
            agentId: documentRevisions.createdByAgentId,
            agentName: sql<string | null>`active_agent.name`,
            documentEditCount: count(),
            lastEditAt: sql<Date>`max(${documentRevisions.createdAt})`,
          })
          .from(documentRevisions)
          .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
          .leftJoin(activeAgent, eq(documentRevisions.createdByAgentId, activeAgent.id))
          .where(
            and(
              eq(documentRevisions.companyId, companyId),
              sql`${documentRevisions.createdAt} >= ${sevenDaysAgo}`,
              sql`${documentRevisions.createdByAgentId} is not null`,
            ),
          )
          .groupBy(documentRevisions.createdByAgentId, sql`active_agent.name`)
          .orderBy(desc(count()))
          .limit(10),
      ]);

      return {
        stats: {
          totalDocuments: totalRow,
          documentsByKey: byKeyRows,
          recentlyCreated: recentlyCreatedRow,
          recentlyUpdated: recentlyUpdatedRow,
          unreviewedCount: unreviewedRow,
          staleCount: staleRow,
        },
        recentActivity: recentActivityRows.map((r) => ({
          documentId: r.documentId,
          documentKey: r.documentKey,
          documentTitle: r.documentTitle,
          issueId: r.issueId,
          issueTitle: r.issueTitle,
          action: r.action,
          agentId: r.agentId,
          agentName: r.agentName,
          timestamp: r.timestamp,
        })),
        activeAgents: activeAgentRows.map((a) => ({
          agentId: a.agentId!,
          agentName: a.agentName!,
          documentEditCount: a.documentEditCount,
          lastEditAt: a.lastEditAt,
        })),
      };
    },
  };
}
