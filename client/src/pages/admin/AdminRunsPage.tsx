import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { AdminRunLogItem } from '../../types';
import { toast } from '../../store/toastStore';
import {
  Terminal,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Code2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  SUCCESS: {
    label: 'SUCCESS',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  ERROR: {
    label: 'ERROR',
    icon: <XCircle className="w-3 h-3 text-rose-400" />,
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  TIMEOUT: {
    label: 'TIMEOUT',
    icon: <Clock className="w-3 h-3 text-amber-400" />,
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  QUEUED: {
    label: 'QUEUED',
    icon: <Clock className="w-3 h-3 text-sky-400" />,
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
};

export const AdminRunsPage: React.FC = () => {
  const [runs, setRuns] = useState<AdminRunLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRuns, setTotalRuns] = useState(0);

  // Filters
  const [languageFilter, setLanguageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Output Inspector Modal
  const [selectedLogForInspection, setSelectedLogForInspection] = useState<AdminRunLogItem | null>(null);

  const fetchRuns = useCallback(async (targetPage = page, lang = languageFilter, status = statusFilter) => {
    setIsLoading(true);
    try {
      const response = await adminApi.getRunLogs({
        page: targetPage,
        limit: 10,
        language: lang !== 'all' ? lang : undefined,
        status: status !== 'all' ? status : undefined,
      });

      if (response.success && response.data) {
        setRuns(response.data.items);
        setTotalPages(response.data.totalPages || 1);
        setTotalRuns(response.data.total || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load execution telemetry');
    } finally {
      setIsLoading(false);
    }
  }, [page, languageFilter, statusFilter]);

  useEffect(() => {
    fetchRuns(page, languageFilter, statusFilter);
  }, [page, languageFilter, statusFilter, fetchRuns]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguageFilter(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs text-app-text-muted">
            <Filter className="w-3.5 h-3.5 text-app-accent" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Filter by:</span>
          </div>

          {/* Language filter dropdown */}
          <select
            value={languageFilter}
            onChange={handleLanguageChange}
            className="text-xs bg-app-surface-2 border border-app-border rounded-lg px-3 py-1.5 text-app-text focus:outline-none focus:ring-1 focus:ring-app-accent font-medium cursor-pointer"
          >
            <option value="all">All Languages</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="c">C</option>
          </select>

          {/* Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="text-xs bg-app-surface-2 border border-app-border rounded-lg px-3 py-1.5 text-app-text focus:outline-none focus:ring-1 focus:ring-app-accent font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="ERROR">ERROR</option>
            <option value="TIMEOUT">TIMEOUT</option>
            <option value="QUEUED">QUEUED</option>
          </select>
        </div>

        <div className="flex items-center space-x-3 text-xs text-app-text-muted justify-between sm:justify-end">
          <span className="font-mono">
            Total Runs: <strong className="text-app-text">{totalRuns}</strong>
          </span>
          <button
            onClick={() => fetchRuns(page, languageFilter, statusFilter)}
            className="p-2 rounded-lg bg-app-surface-2 border border-app-border text-app-text-muted hover:text-app-text transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Runs Table with Mobile Horizontal Scroll */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-2/60 text-[11px] font-bold text-app-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Run ID</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Initiator</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-xs">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><Skeleton width={80} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={110} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={110} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={70} height={20} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={75} height={20} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={50} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={90} height={12} /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton width={70} height={26} className="ml-auto" /></td>
                  </tr>
                ))
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={<Terminal className="w-6 h-6" />}
                      title="No execution logs found"
                      description={
                        languageFilter !== 'all' || statusFilter !== 'all'
                          ? 'No runs match the specified language or status filters.'
                          : 'No program execution logs recorded yet.'
                      }
                      action={
                        languageFilter !== 'all' || statusFilter !== 'all' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setLanguageFilter('all');
                              setStatusFilter('all');
                            }}
                          >
                            Reset Filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                runs.map((r) => {
                  const statusInfo = STATUS_CONFIG[r.status] || {
                    label: r.status,
                    icon: null,
                    badgeClass: 'bg-app-surface-2 text-app-text-muted border-app-border',
                  };

                  return (
                    <tr key={r.id} className="hover:bg-app-surface-2/40 transition-colors">
                      {/* Run ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-app-text-muted">
                        {r.id.slice(0, 8)}...
                      </td>

                      {/* Room */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-app-text block truncate max-w-[140px]" title={r.roomName || r.roomId}>
                          {r.roomName || r.roomId}
                        </span>
                      </td>

                      {/* Initiator */}
                      <td className="py-3 px-4 text-app-text truncate max-w-[140px]">
                        {r.userName || r.userEmail || 'Anonymous'}
                      </td>

                      {/* Language */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-app-surface-2 border border-app-border text-app-accent">
                          {r.language}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono text-app-text-muted">
                        {r.durationMs ? `${r.durationMs}ms` : '—'}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-app-text-muted font-mono text-[11px]">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedLogForInspection(r)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="py-3 px-4 border-t border-app-border flex items-center justify-between text-xs text-app-text-muted">
            <span>
              Page <strong className="text-app-text">{page}</strong> of{' '}
              <strong className="text-app-text">{totalPages}</strong>
            </span>
            <div className="flex items-center space-x-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Output Inspector Modal */}
      <Modal
        isOpen={Boolean(selectedLogForInspection)}
        onClose={() => setSelectedLogForInspection(null)}
        title="Execution Output Inspector"
        description={`Run ID: ${selectedLogForInspection?.id || ''}`}
        maxWidth="lg"
      >
        <div className="space-y-4 pt-1">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-app-surface-2 border border-app-border text-xs">
            <span className="font-semibold text-app-text">
              Language: <strong className="text-app-accent font-mono uppercase">{selectedLogForInspection?.language}</strong>
            </span>
            <span className="text-app-border">•</span>
            <span className="font-semibold text-app-text">
              Status: <strong className="font-mono">{selectedLogForInspection?.status}</strong>
            </span>
            {selectedLogForInspection?.durationMs && (
              <>
                <span className="text-app-border">•</span>
                <span className="font-semibold text-app-text">
                  Duration: <strong className="font-mono text-emerald-400">{selectedLogForInspection.durationMs}ms</strong>
                </span>
              </>
            )}
          </div>

          {/* Raw Output Block */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-app-text-muted mb-1.5">
              <Code2 className="w-3.5 h-3.5" />
              <span>Container Standard Output / Standard Error:</span>
            </div>
            <pre className="p-4 rounded-xl bg-app-bg border border-app-border font-mono text-xs text-app-text overflow-x-auto max-h-72 whitespace-pre-wrap select-text leading-relaxed">
              {selectedLogForInspection?.output || '(No console output emitted by program)'}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedLogForInspection(null)}>
              Close Inspector
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
