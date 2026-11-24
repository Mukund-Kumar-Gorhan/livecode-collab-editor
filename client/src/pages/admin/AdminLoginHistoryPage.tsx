import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { AdminLoginLogItem } from '../../types';
import { toast } from '../../store/toastStore';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Monitor,
  Shield,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export const AdminLoginHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminLoginLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchLoginLogs = useCallback(
    async (targetPage = page, query = searchQuery, status = statusFilter) => {
      setIsLoading(true);
      try {
        const response = await adminApi.getLoginLogs({
          page: targetPage,
          limit: 15,
          search: query || undefined,
          status: status !== 'all' ? status : undefined,
        });

        if (response.success && response.data) {
          setLogs(response.data.items);
          setTotalPages(response.data.totalPages || 1);
          setTotalLogs(response.data.total || 0);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to load login history');
      } finally {
        setIsLoading(false);
      }
    },
    [page, searchQuery, statusFilter]
  );

  useEffect(() => {
    fetchLoginLogs(page, searchQuery, statusFilter);
  }, [page, searchQuery, statusFilter, fetchLoginLogs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Input
              placeholder="Search by email..."
              value={searchQuery}
              onChange={handleSearchChange}
              leftIcon={<Search className="w-4 h-4 text-app-text-muted" />}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-app-accent" />
            <select
              value={statusFilter}
              onChange={handleStatusChange}
              className="text-xs bg-app-surface-2 border border-app-border rounded-lg px-3 py-1.5 text-app-text focus:outline-none focus:ring-1 focus:ring-app-accent font-medium cursor-pointer"
            >
              <option value="all">All Outcomes</option>
              <option value="success">Success Only</option>
              <option value="failed">Failed Attempts</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-app-text-muted justify-between sm:justify-end">
          <span className="font-mono">
            Total Logins: <strong className="text-app-text">{totalLogs}</strong>
          </span>
          <button
            onClick={() => fetchLoginLogs(page, searchQuery, statusFilter)}
            className="p-2 rounded-lg bg-app-surface-2 border border-app-border text-app-text-muted hover:text-app-text transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Login History Table with Mobile Horizontal Scroll */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-2/60 text-[11px] font-bold text-app-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Account Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Device / User Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-xs">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><Skeleton width={130} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={160} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={75} height={20} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={100} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={220} height={12} /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState
                      icon={<History className="w-6 h-6" />}
                      title="No login events found"
                      description={
                        searchQuery || statusFilter !== 'all'
                          ? 'No login events match the current search or outcome filter.'
                          : 'No login attempts have been recorded yet.'
                      }
                      action={
                        searchQuery || statusFilter !== 'all' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSearchQuery('');
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
                logs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-app-surface-2/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-app-text-muted text-[11px] whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3 h-3 text-app-text-muted/60" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </td>

                      {/* User / Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-app-text font-mono truncate max-w-[180px]">
                            {log.email}
                          </span>
                          {log.isAdmin && (
                            <span className="inline-flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                              <Shield className="w-2.5 h-2.5" />
                              <span>ADMIN</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {log.success ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>FAILED</span>
                          </span>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 font-mono text-app-text-muted text-[11px]">
                        {log.ip || 'Unknown'}
                      </td>

                      {/* User Agent */}
                      <td className="py-3 px-4 text-app-text-muted text-xs leading-relaxed max-w-[260px] truncate">
                        <div className="flex items-center space-x-1.5 truncate" title={log.userAgent || 'Unknown Device'}>
                          <Monitor className="w-3.5 h-3.5 shrink-0 text-app-text-muted/60" />
                          <span className="truncate">{log.userAgent || 'Unknown Device'}</span>
                        </div>
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
    </div>
  );
};
