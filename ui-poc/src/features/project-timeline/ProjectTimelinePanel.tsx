import React from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TimelineTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'todo' | 'inProgress' | 'review' | 'done' | 'blocked';
}

interface TimelineResponse {
  projectId: string;
  tasks: TimelineTask[];
  metrics: {
    plannedValue: number;
    earnedValue: number;
    actualCost: number;
    cpi: number;
    spi: number;
  };
  chatSummary: string;
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

function TimelineRow({ task }: { task: TimelineTask }) {
  return (
    <div className="flex items-center gap-2 py-1" key={task.id}>
      <div className="w-48 text-sm font-medium text-gray-700">{task.name}</div>
      <div className="text-xs text-gray-500">
        {task.startDate} → {task.endDate}
      </div>
      <div
        className="h-2 flex-1 rounded"
        style={{ backgroundColor: STATUS_COLORS[task.status] }}
        aria-label={`status-${task.status}`}
      />
    </div>
  );
}

export function ProjectTimelinePanel({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useTimelineData(projectId);

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
            <div>
              {data.tasks.map((task) => (
                <TimelineRow key={task.id} task={task} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-gray-500">Chat Summary</h3>
            <pre className="rounded border bg-gray-50 p-3 text-sm whitespace-pre-wrap">{data.chatSummary}</pre>
          </section>
        </div>
      )}
    </section>
  );
}
