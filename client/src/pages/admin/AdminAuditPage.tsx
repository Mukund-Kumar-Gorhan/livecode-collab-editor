import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { AdminAuditLogItem } from '../../types';
import { toast } from '../../store/toastStore';
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Users,
  Settings,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const ACTION_COLOR_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  USER_DISABLED: {
    label: 'USER DISABLED',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: <Users className="w-3 h-3" />,
  },
  USER_ENABLED: {
    label: 'USER ENABLED',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: <Users className="w-3 h-3" />,
  },
  ADMIN_PROMOTED: {
    label: 'ADMIN PROMOTED',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: <Shield className="w-3 h-3" />,
  },
  ADMIN_DEMOTED: {
    label: 'ADMIN DEMOTED',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: <Shield className="w-3 h-3" />,
  },
  USER_ROLE_UPDATED: {
    label: 'ROLE UPDATED',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: <Shield className="w-3 h-3" />,
  },
  USER_DELETED: {
    label: 'USER DELETED',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: <Users className="w-3 h-3" />,
  },
  ROOM_DELETED: {
    label: 'ROOM DELETED',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: <Layers className="w-3 h-3" />,
  },
  SYSTEM_SETTINGS_UPDATE: {
    label: 'SYSTEM CONFIG',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: <Settings className="w-3 h-3" />,
  },
};

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchAuditLogs = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    try {
      const response = await adminApi.getAuditLogs({
        page: targetPage,
        limit: 12,
      });

      if (response.success && response.data) {
        setLogs(response.data.items);
        setTotalPages(response.data.totalPages || 1);
        setTotalLogs(response.data.total || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAuditLogs(page);
  }, [page, fetchAuditLogs]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-app-text font-heading">
            Administrative Audit Trail
          </h2>
          <p className="text-xs text-app-text-muted mt-0.5">
            Immutable log of user role updates, account suspensions, and room deletions.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs text-app-text-muted justify-between sm:justify-end">
          <span className="font-mono">
            Total Events: <strong className="text-app-text">{totalLogs}</strong>
          </span>
          <button
            onClick={() => fetchAuditLogs(page)}
            className="p-2 rounded-lg bg-app-surface-2 border border-app-border text-app-text-muted hover:text-app-text transition-colors"
            title="Refresh audit logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Table with Mobile Horizontal Scroll */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-2/60 text-[11px] font-bold text-app-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-xs">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><Skeleton width={110} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={130} height={12} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={90} height={20} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={100} height={14} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={200} height={12} /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState
                      icon={<ShieldCheck className="w-6 h-6" />}
                      title="No audit events recorded"
                      description="Administrative operations will be recorded here automatically."
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionConfig = ACTION_COLOR_CONFIG[log.action] || {
                    label: log.action,
                    badgeClass: 'bg-app-surface-2 text-app-text-muted border-app-border',
                    icon: null,
                  };

                  return (
                    <tr key={log.id} className="hover:bg-app-surface-2/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-app-text-muted text-[11px] whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3 h-3 text-app-text-muted/60" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Admin User */}
                      <td className="py-3 px-4">
                        <div className="max-w-[150px] truncate">
                          <span className="font-semibold text-app-text block truncate">
                            {log.adminName || log.adminEmail}
                          </span>
                          <span className="text-[11px] text-app-text-muted font-mono block truncate">
                            {log.adminEmail}
                          </span>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${actionConfig.badgeClass}`}
                        >
                          {actionConfig.icon}
                          <span>{actionConfig.label}</span>
                        </span>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-4 font-mono">
                        <span className="text-app-text font-semibold">
                          {log.targetName || log.targetId}
                        </span>
                        <span className="text-[10px] text-app-text-muted block">
                          [{log.targetType}]
                        </span>
                      </td>

                      {/* Details Description */}
                      <td className="py-3 px-4 text-app-text-muted text-xs leading-relaxed max-w-[280px]">
                        {log.details || '—'}
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
