import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import GraphQLTypeJson from 'graphql-type-json';
import { nanoid } from 'nanoid';

const GraphQLJSONScalar = GraphQLTypeJson.GraphQLJSON ?? GraphQLTypeJson.default ?? GraphQLTypeJson;

const cloneDeep = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export function createGraphQLSchema({
  projects,
  timesheets,
  invoices,
  eventLog,
  getMetricsSnapshot,
  buildMetricsPayload,
  logMetricsSnapshot,
  broadcastMetrics,
  persistSnapshot,
  publishTimesheetApproved,
  attachDownloadUrls,
  filterInvoices,
  buildComplianceInvoicesResponse,
  projectActions,
  timesheetActions,
  nextProjectStatus,
  nextTimesheetStatus,
  useMinio,
  projectIdempotencyKeys = new Map(),
  timesheetIdempotencyKeys = new Map(),
}) {
  const ensureStore = (store) => {
    if (store && typeof store.get === 'function' && typeof store.set === 'function') {
      return store;
    }
    const map = store instanceof Map ? store : new Map();
    return {
      async get(key) {
        return map.get(key) ?? null;
      },
      async set(key, value) {
        map.set(key, value);
      },
    };
  };

  const projectStore = ensureStore(projectIdempotencyKeys);
  const timesheetStore = ensureStore(timesheetIdempotencyKeys);
  const prepareTagFilters = (manualTagRaw, tagsArg) => {
    const manual = typeof manualTagRaw === 'string' ? manualTagRaw.trim().toLowerCase() : '';
    const secondary = Array.isArray(tagsArg)
      ? tagsArg
          .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
          .filter(Boolean)
      : [];
    const deduped = [...new Set(manual ? [manual, ...secondary] : secondary)];
    const optional = deduped.filter((value) => value !== manual);
    return { manual, optional };
  };
  const MetricsSummaryType = new GraphQLObjectType({
    name: 'MetricsSummary',
    fields: () => ({
      projects: { type: GraphQLJSONScalar },
      timesheets: { type: GraphQLJSONScalar },
      invoices: { type: GraphQLJSONScalar },
      events: { type: GraphQLInt },
      cachedAt: { type: GraphQLString },
      cacheTtlMs: { type: GraphQLInt },
      stale: { type: GraphQLBoolean },
      idempotency: { type: GraphQLJSONScalar },
    }),
  });


  const ProjectListMetaType = new GraphQLObjectType({
    name: 'ProjectListMeta',
    fields: () => ({
      total: { type: GraphQLInt },
      fetchedAt: { type: GraphQLString },
      fallback: { type: GraphQLBoolean },
    }),
  });

  const ProjectType = new GraphQLObjectType({
    name: 'Project',
    fields: () => ({
      id: { type: GraphQLID },
      code: { type: GraphQLString },
      name: { type: GraphQLString },
      clientName: { type: GraphQLString },
      status: { type: GraphQLString },
      startOn: { type: GraphQLString },
      endOn: { type: GraphQLString },
      manager: { type: GraphQLString },
      health: { type: GraphQLString },
      tags: { type: new GraphQLList(GraphQLString) },
      createdAt: { type: GraphQLString },
      updatedAt: { type: GraphQLString },
    }),
  });

  const TimesheetType = new GraphQLObjectType({
    name: 'Timesheet',
    fields: () => ({
      id: { type: GraphQLID },
      userName: { type: GraphQLString },
      employeeId: { type: GraphQLString },
      projectId: { type: GraphQLString },
      projectCode: { type: GraphQLString },
      projectName: { type: GraphQLString },
      taskName: { type: GraphQLString },
      workDate: { type: GraphQLString },
      hours: { type: GraphQLFloat },
      approvalStatus: { type: GraphQLString },
      submittedAt: { type: GraphQLString },
      note: { type: GraphQLString },
      rateType: { type: GraphQLString },
    }),
  });

  const InvoiceAttachmentType = new GraphQLObjectType({
    name: 'InvoiceAttachment',
    fields: () => ({
      id: { type: GraphQLID },
      kind: { type: GraphQLString },
      fileName: { type: GraphQLString },
      mimeType: { type: GraphQLString },
      sizeLabel: { type: GraphQLString },
      previewNote: { type: GraphQLString },
      storageKey: { type: GraphQLString },
      downloadUrl: { type: GraphQLString },
    }),
  });

  const InvoiceType = new GraphQLObjectType({
    name: 'Invoice',
    fields: () => ({
      id: { type: GraphQLID },
      invoiceNumber: { type: GraphQLString },
      issueDate: { type: GraphQLString },
      dueDate: { type: GraphQLString },
      counterpartyName: { type: GraphQLString },
      counterpartyNumber: { type: GraphQLString },
      subject: { type: GraphQLString },
      amountIncludingTax: { type: GraphQLFloat },
      amountExcludingTax: { type: GraphQLFloat },
      currency: { type: GraphQLString },
      status: { type: GraphQLString },
      tags: { type: new GraphQLList(GraphQLString) },
      remarks: { type: GraphQLString },
      matchedPurchaseOrder: { type: GraphQLString },
      attachments: { type: new GraphQLList(InvoiceAttachmentType) },
      createdAt: { type: GraphQLString },
      updatedAt: { type: GraphQLString },
    }),
  });

  const ComplianceInvoiceMetaType = new GraphQLObjectType({
    name: 'ComplianceInvoiceMeta',
    fields: () => ({
      total: { type: GraphQLInt },
      page: { type: GraphQLInt },
      pageSize: { type: GraphQLInt },
      totalPages: { type: GraphQLInt },
      sortBy: { type: GraphQLString },
      sortDir: { type: GraphQLString },
      fetchedAt: { type: GraphQLString },
      fallback: { type: GraphQLBoolean },
    }),
  });

  const ComplianceInvoicesConnectionType = new GraphQLObjectType({
    name: 'ComplianceInvoicesConnection',
    fields: () => ({
      items: { type: new GraphQLList(InvoiceType) },
      meta: { type: ComplianceInvoiceMetaType },
    }),
  });

  const ProjectListConnectionType = new GraphQLObjectType({
    name: 'ProjectListConnection',
    fields: () => ({
      items: { type: new GraphQLList(ProjectType) },
      meta: { type: ProjectListMetaType },
    }),
  });

  const ComplianceInvoiceFilterInputType = new GraphQLInputObjectType({
    name: 'ComplianceInvoiceFilterInput',
    fields: () => ({
      keyword: { type: GraphQLString },
      status: { type: GraphQLString },
      startDate: { type: GraphQLString },
      endDate: { type: GraphQLString },
      minAmount: { type: GraphQLFloat },
      maxAmount: { type: GraphQLFloat },
      page: { type: GraphQLInt },
      pageSize: { type: GraphQLInt },
      sortBy: { type: GraphQLString },
      sortDir: { type: GraphQLString },
    }),
  });

  const ProjectMutationPayloadType = new GraphQLObjectType({
    name: 'ProjectMutationPayload',
    fields: () => ({
      ok: { type: new GraphQLNonNull(GraphQLBoolean) },
      project: { type: ProjectType },
      error: { type: GraphQLString },
      message: { type: GraphQLString },
    }),
  });

  const TimesheetMutationPayloadType = new GraphQLObjectType({
    name: 'TimesheetMutationPayload',
    fields: () => ({
      ok: { type: new GraphQLNonNull(GraphQLBoolean) },
      timesheet: { type: TimesheetType },
      error: { type: GraphQLString },
      eventId: { type: GraphQLString },
      shard: { type: GraphQLInt },
      message: { type: GraphQLString },
    }),
  });

  const CreateProjectInputType = new GraphQLInputObjectType({
    name: 'CreateProjectInput',
    fields: () => ({
      id: { type: GraphQLID },
      code: { type: GraphQLString },
      name: { type: new GraphQLNonNull(GraphQLString) },
      clientName: { type: GraphQLString },
      status: { type: GraphQLString },
      startOn: { type: GraphQLString },
      endOn: { type: GraphQLString },
      manager: { type: GraphQLString },
      health: { type: GraphQLString },
      tags: { type: new GraphQLList(GraphQLString) },
      idempotencyKey: { type: GraphQLString },
    }),
  });

  const ProjectTransitionInputType = new GraphQLInputObjectType({
    name: 'ProjectTransitionInput',
    fields: () => ({
      projectId: { type: GraphQLID },
      code: { type: GraphQLString },
      action: { type: new GraphQLNonNull(GraphQLString) },
    }),
  });

  const CreateTimesheetInputType = new GraphQLInputObjectType({
    name: 'CreateTimesheetInput',
    fields: () => ({
      id: { type: GraphQLID },
      userName: { type: new GraphQLNonNull(GraphQLString) },
      employeeId: { type: GraphQLString },
      projectId: { type: GraphQLString },
      projectCode: { type: GraphQLString },
      projectName: { type: GraphQLString },
      taskName: { type: GraphQLString },
      workDate: { type: GraphQLString },
      hours: { type: GraphQLFloat },
      note: { type: GraphQLString },
      rateType: { type: GraphQLString },
      autoSubmit: { type: GraphQLBoolean },
      idempotencyKey: { type: GraphQLString },
    }),
  });

  const TimesheetActionInputType = new GraphQLInputObjectType({
    name: 'TimesheetActionInput',
    fields: () => ({
      timesheetId: { type: new GraphQLNonNull(GraphQLID) },
      action: { type: new GraphQLNonNull(GraphQLString) },
      comment: { type: GraphQLString },
      reasonCode: { type: GraphQLString },
      hours: { type: GraphQLFloat },
      rateType: { type: GraphQLString },
    }),
  });

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      metricsSummary: {
        type: MetricsSummaryType,
        args: { refresh: { type: GraphQLBoolean } },
        resolve: (_root, args) => {
          const refresh = Boolean(args?.refresh);
          const snapshot = getMetricsSnapshot(refresh);
          if (refresh) {
            logMetricsSnapshot(snapshot, 'graphql-refresh');
            broadcastMetrics(snapshot);
          }
          return buildMetricsPayload(snapshot);
        },
      },
      projects: {
        type: ProjectListConnectionType,
        args: {
          status: { type: GraphQLString },
          keyword: { type: GraphQLString },
          manager: { type: GraphQLString },
          health: { type: GraphQLString },
          tag: { type: GraphQLString },
          tags: { type: new GraphQLList(GraphQLString) },
        },
        resolve: (_root, args) => {
          const keyword = typeof args?.keyword === 'string' ? args.keyword.trim().toLowerCase() : '';
          const status = typeof args?.status === 'string' ? args.status.trim().toLowerCase() : '';
          const manager = typeof args?.manager === 'string' ? args.manager.trim().toLowerCase() : '';
          const health = typeof args?.health === 'string' ? args.health.trim().toLowerCase() : '';
          const { manual: manualTag, optional: secondaryTagFilters } = prepareTagFilters(args?.tag, args?.tags);
          const filteredProjects = projects.filter((project) => {
            const statusMatch = !status || status === 'all' || project.status === status;
            if (!statusMatch) return false;
            if (health && project.health !== health) return false;
            if (manager) {
              const managerName = (project.manager ?? '').toLowerCase();
              if (!managerName.includes(manager)) {
                return false;
              }
            }
            if (manualTag || secondaryTagFilters.length > 0) {
              const tagList = Array.isArray(project.tags)
                ? project.tags.filter(Boolean).map((value) => value.toLowerCase())
                : [];
              // Manual tag (free-form) acts as a required match (AND). Optional preset tags behave as OR filters.
              if (manualTag && !tagList.includes(manualTag)) {
                return false;
              }
              if (secondaryTagFilters.length > 0) {
                const hasMatch = secondaryTagFilters.some((value) => tagList.includes(value));
                if (!hasMatch) {
                  return false;
                }
              }
            }
            if (!keyword) return true;
            const haystack = `${project.name} ${project.code ?? ''} ${project.clientName ?? ''}`.toLowerCase();
            return haystack.includes(keyword);
          });
          const fetchedAt = new Date().toISOString();
          return {
            items: cloneDeep(filteredProjects),
            meta: {
              total: filteredProjects.length,
              fetchedAt,
              fallback: false,
            },
          };
        },
      },
      timesheets: {
        type: new GraphQLList(TimesheetType),
        args: {
          status: { type: GraphQLString },
          projectId: { type: GraphQLString },
          keyword: { type: GraphQLString },
          userName: { type: GraphQLString },
          projectCode: { type: GraphQLString },
        },
        resolve: (_root, args) => {
          const status = typeof args?.status === 'string' ? args.status.trim().toLowerCase() : '';
          const projectId = typeof args?.projectId === 'string' ? args.projectId.trim() : '';
          const keyword = typeof args?.keyword === 'string' ? args.keyword.trim().toLowerCase() : '';
          const userName = typeof args?.userName === 'string' ? args.userName.trim().toLowerCase() : '';
          const projectCodeArg = typeof args?.projectCode === 'string' ? args.projectCode.trim().toLowerCase() : '';
          const filteredTimesheets = timesheets.filter((sheet) => {
            const statusMatch = !status || status === 'all' || sheet.approvalStatus === status;
            if (!statusMatch) return false;
            const projectMatch =
              !projectId || sheet.projectId === projectId || sheet.projectCode === projectId;
            if (!projectMatch) return false;
            if (userName) {
              const name = (sheet.userName ?? '').toLowerCase();
              if (!name.includes(userName)) {
                return false;
              }
            }
            if (projectCodeArg) {
              const codeLower = (sheet.projectCode ?? '').toLowerCase();
              if (codeLower !== projectCodeArg) {
                return false;
              }
            }
            if (!keyword) return true;
            const haystack = [
              sheet.projectCode,
              sheet.projectName,
              sheet.userName,
              sheet.note,
              sheet.taskName,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(keyword);
          });
          return cloneDeep(filteredTimesheets);
        },
      },
      invoices: {
        type: new GraphQLList(InvoiceType),
        args: {
          status: { type: GraphQLString },
          keyword: { type: GraphQLString },
          minAmount: { type: GraphQLInt },
          maxAmount: { type: GraphQLInt },
          limit: { type: GraphQLInt },
        },
        resolve: async (_root, args) => {
          const filters = {
            status: args?.status,
            keyword: args?.keyword,
            minAmount: args?.minAmount,
            maxAmount: args?.maxAmount,
          };
          const matched = filterInvoices(filters, invoices);
          const limit = Number.isFinite(args?.limit) && args.limit > 0 ? Math.min(args.limit, 100) : matched.length;
          let payload = cloneDeep(matched.slice(0, limit));
          if (useMinio && payload.length > 0) {
            try {
              payload = await attachDownloadUrls(payload);
            } catch (error) {
              console.warn('[graphql] failed to attach MinIO download URLs', error);
            }
          }
          return payload;
        },
      },
      complianceInvoices: {
        type: ComplianceInvoicesConnectionType,
        args: {
          filter: { type: ComplianceInvoiceFilterInputType },
        },
        resolve: async (_root, args) => {
          const filter = args?.filter ?? {};
          return buildComplianceInvoicesResponse(
            {
              keyword: filter.keyword,
              status: filter.status,
              startDate: filter.startDate,
              endDate: filter.endDate,
              minAmount: filter.minAmount,
              maxAmount: filter.maxAmount,
              page: filter.page,
              pageSize: filter.pageSize,
              sortBy: filter.sortBy,
              sortDir: filter.sortDir,
            },
            useMinio ? { attach: attachDownloadUrls } : null,
          );
        },
      },
      recentEvents: {
        type: new GraphQLList(GraphQLJSONScalar),
        args: { limit: { type: GraphQLInt } },
        resolve: (_root, args) => {
          const limit = Number.isFinite(args?.limit) && args.limit > 0 ? Math.min(args.limit, 100) : 20;
          return cloneDeep(eventLog.slice(-limit).reverse());
        },
      },
    }),
  });

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: () => ({
      createProject: {
        type: ProjectMutationPayloadType,
        args: {
          input: { type: new GraphQLNonNull(CreateProjectInputType) },
        },
        resolve: async (_root, args) => {
          const input = args.input || {};
          const projectId = input.id || `PRJ-${nanoid(6)}`;
          const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
          if (idempotencyKey) {
            const existingId = await projectStore.get(idempotencyKey);
            if (existingId) {
              const existing = projects.find((item) => item.id === existingId || item.code === existingId);
              if (existing) {
                return {
                  ok: true,
                  project: cloneDeep(existing),
                  message: 'Project already existed (idempotent)',
                };
              }
            }
          }
          if (projects.some((item) => item.id === projectId || (input.code && item.code === input.code))) {
            return { ok: false, error: 'duplicate_project', message: 'Project already exists' };
          }
          const now = new Date().toISOString();
          const created = {
            id: projectId,
            code: input.code || projectId,
            name: input.name,
            clientName: input.clientName || 'Internal',
            status: input.status || 'planned',
            startOn: input.startOn || now.slice(0, 10),
            endOn: input.endOn || null,
            manager: input.manager || null,
            health: input.health || 'green',
            tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
            createdAt: now,
            updatedAt: now,
          };
          projects.push(created);
          getMetricsSnapshot(true);
          persistSnapshot();
          if (idempotencyKey) {
            await projectStore.set(idempotencyKey, created.id);
          }
          return { ok: true, project: cloneDeep(created), message: 'Project created' };
        },
      },
      projectTransition: {
        type: ProjectMutationPayloadType,
        args: {
          input: { type: new GraphQLNonNull(ProjectTransitionInputType) },
        },
        resolve: (_root, args) => {
          const { projectId, code, action } = args.input || {};
          if (!projectActions.has(action)) {
            return { ok: false, error: 'unsupported_action', message: 'Action not allowed' };
          }
          const target = projects.find((item) => item.id === projectId || item.code === projectId || item.code === code || item.id === code);
          if (!target) {
            return { ok: false, error: 'not_found', message: 'Project not found' };
          }
          const nextStatus = nextProjectStatus(target.status, action);
          if (!nextStatus) {
            return { ok: false, error: 'action_not_allowed', message: 'Transition not permitted' };
          }
          target.status = nextStatus;
          target.updatedAt = new Date().toISOString();
          if (nextStatus === 'closed' && !target.endOn) {
            target.endOn = target.updatedAt.slice(0, 10);
          }
          persistSnapshot();
          return {
            ok: true,
            project: cloneDeep(target),
            message: `Project transitioned to ${nextStatus}`,
          };
        },
      },
      createTimesheet: {
        type: TimesheetMutationPayloadType,
        args: {
          input: { type: new GraphQLNonNull(CreateTimesheetInputType) },
        },
        resolve: async (_root, args) => {
          const input = args.input || {};
          if (!input.userName) {
            return { ok: false, error: 'userName_required', message: 'userName is required' };
          }
          if (!input.projectId && !input.projectCode) {
            return { ok: false, error: 'project_required', message: 'projectId or projectCode is required' };
          }
          const id = input.id || `TS-${nanoid(6)}`;
          const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
          if (idempotencyKey) {
            const existingId = await timesheetStore.get(idempotencyKey);
            if (existingId) {
              const existing = timesheets.find((item) => item.id === existingId);
              if (existing) {
                return {
                  ok: true,
                  timesheet: cloneDeep(existing),
                  message: 'Timesheet already existed (idempotent)',
                };
              }
            }
          }
          if (timesheets.some((item) => item.id === id)) {
            return { ok: false, error: 'duplicate_timesheet', message: 'Timesheet already exists' };
          }
          const now = new Date().toISOString();
          const approvalStatus = input.autoSubmit ? 'submitted' : 'draft';
          const created = {
            id,
            userName: input.userName,
            employeeId: input.employeeId || `EMP-${nanoid(4)}`,
            projectId: input.projectId || input.projectCode,
            projectCode: input.projectCode || input.projectId || id,
            projectName: input.projectName || 'Untitled Project',
            taskName: input.taskName || null,
            workDate: input.workDate || now.slice(0, 10),
            hours: Number.isFinite(input.hours) ? input.hours : 8,
            approvalStatus,
            note: input.note || null,
            rateType: input.rateType || 'standard',
            submittedAt: input.autoSubmit ? now : undefined,
            createdAt: now,
            updatedAt: now,
          };
          timesheets.push(created);
          persistSnapshot();
          if (idempotencyKey) {
            await timesheetStore.set(idempotencyKey, created.id);
          }
          return {
            ok: true,
            timesheet: cloneDeep(created),
            message: input.autoSubmit ? 'Timesheet created and submitted' : 'Timesheet created',
          };
        },
      },
      timesheetAction: {
        type: TimesheetMutationPayloadType,
        args: {
          input: { type: new GraphQLNonNull(TimesheetActionInputType) },
        },
        resolve: async (_root, args) => {
          const { timesheetId, action, comment, reasonCode, hours, rateType } = args.input || {};
          if (!timesheetActions.has(action)) {
            return { ok: false, error: 'unsupported_action', message: 'Action not allowed' };
          }
          const entry = timesheets.find((item) => item.id === timesheetId);
          if (!entry) {
            return { ok: false, error: 'not_found', message: 'Timesheet not found' };
          }
          const nextStatus = nextTimesheetStatus(entry.approvalStatus, action);
          if (!nextStatus) {
            return { ok: false, error: 'action_not_allowed', message: 'Transition not permitted' };
          }
          if (Number.isFinite(hours)) {
            entry.hours = Number(hours);
          }
          if (rateType) {
            entry.rateType = rateType;
          }
          const nowIso = new Date().toISOString();

          try {
            if (action === 'approve') {
              const { eventId, shard } = await publishTimesheetApproved({
                timesheetId: entry.id,
                employeeId: entry.employeeId || 'E-001',
                projectId: entry.projectId || entry.projectCode || 'P-001',
                hours: entry.hours ?? 8,
                rateType: entry.rateType || 'standard',
                note: comment,
              });
              entry.approvalStatus = nextStatus;
              entry.approvedAt = nowIso;
              if (comment) entry.note = comment;
              entry.updatedAt = nowIso;
              persistSnapshot();
              return {
                ok: true,
                timesheet: cloneDeep(entry),
                eventId,
                shard,
                message: 'Timesheet approved',
              };
            }

            if (action === 'submit' || action === 'resubmit') {
              entry.submittedAt = nowIso;
              if (comment) entry.note = comment;
            }
            if (action === 'reject') {
              entry.note = comment || entry.note;
              if (reasonCode) entry.lastReasonCode = reasonCode;
            }
            entry.approvalStatus = nextStatus;
            entry.updatedAt = nowIso;
            persistSnapshot();
            return {
              ok: true,
              timesheet: cloneDeep(entry),
              message: `Timesheet transitioned to ${nextStatus}`,
            };
          } catch (error) {
            console.error('[graphql] timesheet action error', error);
            return {
              ok: false,
              error: error?.message || 'internal_error',
              message: 'Timesheet action failed',
            };
          }
        },
      },
    }),
  });

  return new GraphQLSchema({ query: QueryType, mutation: MutationType });
}

export { cloneDeep };
