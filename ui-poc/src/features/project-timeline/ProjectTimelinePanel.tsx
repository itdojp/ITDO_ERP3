'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TimelineTask {
  id: string;
  name: string;
  phase?: string;
  startDate: string;
  endDate: string;
  status: 'todo' | 'inProgress' | 'review' | 'done' | 'blocked';
}

interface TimelineResponse {
  projectId: string;
  tasks: TimelineTask[];
  phases: { id: string; name: string; sortOrder: number }[];
  metrics: {
    plannedValue: number;
    earnedValue: number;
    actualCost: number;
    cpi: number;
    spi: number;
  };
  chatSummary: string;
}

interface MetricsResponse {
  projectId: string;
  evm: TimelineResponse['metrics'];
  burndown: {
    labels: string[];
    planned: number[];
    actual: number[];
  };
  risks: { id: string; probability: number; impact: number; status: string }[];
}

const STATUS_COLORS: Record<TimelineTask['status'], string> = {
  todo: '#9ca3af',
  inProgress: '#2563eb',
  review: '#facc15',
  done: '#16a34a',
  blocked: '#ef4444',
};

function useTimelineData(projectId: string) {
  return useQuery<TimelineResponse>({
    queryKey: ['projectTimeline', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/timeline`);
      if (!res.ok) {
        throw new Error('Failed to load timeline');
      }
      return res.json() as Promise<TimelineResponse>;
    },
  });
}

function useMetricsData(projectId: string) {
  return useQuery<MetricsResponse>({
    queryKey: ['projectMetrics', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/metrics`);
      if (!res.ok) {
        throw new Error('Failed to load metrics');
      }
      return res.json() as Promise<MetricsResponse>;
    },
  });
}

function TimelineRow({ task }: { task: TimelineTask }) {
  return (
    <div className="flex flex-col gap-1 rounded border border-gray-100 p-2 transition hover:border-indigo-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700">{task.name}</div>
          <div className="text-xs text-gray-500">
            {task.startDate} → {task.endDate}
          </div>
        </div>
        <div className="text-xs text-indigo-500">{task.phase ?? 'Unassigned'}</div>
      </div>
      <div
        className="h-2 rounded"
        style={{ backgroundColor: STATUS_COLORS[task.status] }}
        aria-label={`status-${task.status}`}
      />
    </div>
  );
}

export function ProjectTimelinePanel({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useTimelineData(projectId);
  const metricsQuery = useMetricsData(projectId);
  const [statusFilter, setStatusFilter] = useState<Set<TimelineTask['status']>>(
    () => new Set(Object.keys(STATUS_COLORS) as TimelineTask['status'][]),
  );
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const metricList = useMemo(() => {
    if (!data) return [];
    const m = data.metrics;
    return [
      { label: 'PV', value: m.plannedValue },
      { label: 'EV', value: m.earnedValue },
      { label: 'AC', value: m.actualCost },
      { label: 'CPI', value: m.cpi.toFixed(2) },
      { label: 'SPI', value: m.spi.toFixed(2) },
    ];
  }, [data]);

  const phases = useMemo(() => {
    if (!data) return [];
    return [{ id: 'all', name: 'All phases', sortOrder: 0 }, ...data.phases];
  }, [data]);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((task) => {
      const statusMatch = statusFilter.has(task.status);
      const phaseMatch = phaseFilter === 'all' || task.phase === phaseFilter;
      return statusMatch && phaseMatch;
    });
  }, [data, statusFilter, phaseFilter]);

  useEffect(() => {
    if (!filteredTasks.length) {
      setSelectedTaskId(null);
      return;
    }
    if (!selectedTaskId || !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0].id);
    }
  }, [filteredTasks, selectedTaskId]);

  const selectedTask = useMemo(() => {
    if (filteredTasks.length === 0) {
      return null;
    }
    if (!selectedTaskId) {
      return filteredTasks[0];
    }
    return filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0];
  }, [filteredTasks, selectedTaskId]);
  const risks = metricsQuery.data?.risks ?? [];

  function toggleStatusFilter(status: TimelineTask['status']) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  return (
    <section className="rounded border bg-white p-4 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Project Timeline</h2>
        <p className="text-xs text-gray-500">Project ID: {projectId}</p>
      </header>
      {isLoading && <p>Loading timeline…</p>}
      {error instanceof Error && <p className="text-red-600">{error.message}</p>}
      {data && (
        <div className="flex flex-col gap-4">
          <section className="flex flex-wrap items-center gap-3 rounded border border-gray-100 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500">Status</span>
              {(Object.keys(STATUS_COLORS) as TimelineTask['status'][]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatusFilter(status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    statusFilter.has(status)
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  aria-pressed={statusFilter.has(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
              Phase
              <select
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
                value={phaseFilter}
                onChange={(event) => setPhaseFilter(event.target.value)}
              >
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id === 'all' ? 'all' : phase.name}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-500">Metrics</h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {metricList.map((metric) => (
                <div key={metric.label} className="rounded border p-2">
                  <div className="text-xs uppercase text-gray-400">{metric.label}</div>
                  <div className="text-base font-bold">{metric.value}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-500">Schedule</h3>
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-gray-500">Filter条件に一致するタスクがありません。</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`text-left ${selectedTaskId === task.id ? 'ring-2 ring-indigo-400' : ''}`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <TimelineRow task={task} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-500">Chat Summary</h3>
            <pre className="rounded border bg-gray-50 p-3 text-sm whitespace-pre-wrap">{data.chatSummary}</pre>
          </section>
          <section
            className="rounded border border-indigo-100 bg-indigo-50 p-3"
            data-testid="timeline-task-detail"
            data-selected-task={selectedTask?.id ?? ''}
          >
            <h3 className="text-sm font-semibold text-indigo-700">Task Details</h3>
            {selectedTask ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-indigo-900 md:grid-cols-3">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-indigo-500">Task</dt>
                  <dd>{selectedTask.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-indigo-500">Status</dt>
                  <dd>{selectedTask.status}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-indigo-500">Phase</dt>
                  <dd>{selectedTask.phase ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-indigo-500">Start</dt>
                  <dd>{selectedTask.startDate}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-indigo-500">End</dt>
                  <dd>{selectedTask.endDate}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-indigo-500">CPI/SPI</dt>
                  <dd>
                    {data.metrics.cpi.toFixed(2)} / {data.metrics.spi.toFixed(2)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-indigo-500">タスクを選択すると詳細が表示されます。</p>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-500">Risks</h3>
            {metricsQuery.isLoading && <p className="text-xs text-gray-400">Loading risks…</p>}
            {!metricsQuery.isLoading && risks.length === 0 && (
              <p className="text-xs text-gray-400">登録されたリスクはありません。</p>
            )}
            {risks.length > 0 && (
              <ul className="grid gap-2 text-xs">
                {risks.map((risk) => (
                  <li key={risk.id} className="flex items-center justify-between rounded border border-gray-100 p-2">
                    <span className="font-medium text-gray-700">{risk.status}</span>
                    <span className="text-gray-500">
                      P:{risk.probability}% / I:{risk.impact}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
