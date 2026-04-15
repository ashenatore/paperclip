import type { CompanyDocumentListItem, CompanyDocumentDetail, CompanyDocumentActivity } from "@paperclipai/shared";
import { api } from "./client";

export const documentsApi = {
  list: (companyId: string, filters?: {
    key?: string;
    agentId?: string;
    issueStatus?: string;
    q?: string;
    sort?: string;
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.key) params.set("key", filters.key);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.issueStatus) params.set("issueStatus", filters.issueStatus);
    if (filters?.q) params.set("q", filters.q);
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.order) params.set("order", filters.order);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return api.get<CompanyDocumentListItem[]>(`/companies/${companyId}/documents${qs ? `?${qs}` : ""}`);
  },

  getDetail: (companyId: string, documentId: string) =>
    api.get<CompanyDocumentDetail>(`/companies/${companyId}/documents/${documentId}`),

  getActivity: (companyId: string) =>
    api.get<CompanyDocumentActivity>(`/companies/${companyId}/documents/activity`),
};
