import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { AdminStats } from '../../types';
import { toast } from '../../store/toastStore';
import {
  Users,
  Layers,
  PlayCircle,
  Activity,
  CheckCircle2,
  RefreshCw,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { LanguageBarChart } from './components/LanguageBarChart';
import { RunsLineChart } from './components/RunsLineChart';

export const AdminOverviewPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await adminApi.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch overview metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner with manual refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-app-text font-heading">
            Live Platform Telemetry
          </h2>
          <p className="text-xs text-app-text-muted mt-0.5">
            Real-time aggregates across collaborative rooms, active sessions, and container runs.
          </p>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={isLoading || isRefreshing}
          className="inline-flex items-center space-x-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-app-surface-2 border border-app-border text-app-text hover:bg-app-border transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-app-accent ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* 5 Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Users */}
        <Card className="col-span-1 border-app-border bg-app-surface hoverable">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton height={28} width={60} />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-app-text font-mono">
              {stats?.totalUsers.toLocaleString() ?? '—'}
            </div>
          )}
          <span className="text-[10px] text-app-text-muted mt-1 block">Registered developers</span>
        </Card>

        {/* 2. Total Rooms */}
        <Card className="col-span-1 border-app-border bg-app-surface hoverable">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider">
              Total Rooms
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton height={28} width={60} />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-app-text font-mono">
              {stats?.totalRooms.toLocaleString() ?? '—'}
            </div>
          )}
          <span className="text-[10px] text-app-text-muted mt-1 block">Active workspaces</span>
        </Card>

        {/* 3. Runs Today */}
        <Card className="col-span-1 border-app-border bg-app-surface hoverable">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider">
              Runs Today
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <PlayCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton height={28} width={60} />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-app-text font-mono">
              {stats?.runsToday.toLocaleString() ?? '—'}
            </div>
          )}
          <span className="text-[10px] text-app-text-muted mt-1 block">Executions since 00:00</span>
        </Card>

        {/* 4. Active Now */}
        <Card className="col-span-1 border-app-border bg-app-surface hoverable">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Now</span>
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton height={28} width={60} />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {stats?.activeNow ?? '—'}
            </div>
          )}
          <span className="text-[10px] text-app-text-muted mt-1 block">Live websocket peers</span>
        </Card>

        {/* 5. Success Rate */}
        <Card className="col-span-2 lg:col-span-1 border-app-border bg-app-surface hoverable">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider">
              Success Rate
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton height={28} width={60} />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-app-text font-mono flex items-baseline space-x-1">
              <span>{stats?.successRate ?? '—'}%</span>
            </div>
          )}
          <span className="text-[10px] text-app-text-muted mt-1 block">Zero-exit code runs</span>
        </Card>
      </div>

      {/* Visual Charts: 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Language Usage Breakdown */}
        <Card className="border-app-border bg-app-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-app-accent" />
                <CardTitle>Language Popularity</CardTitle>
              </div>
              <span className="text-[11px] text-app-text-muted font-mono">by active rooms</span>
            </div>
            <CardDescription>
              Distribution of runtime templates across created collaboration rooms
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4 py-2">
                <Skeleton height={32} />
                <Skeleton height={32} />
                <Skeleton height={32} />
                <Skeleton height={32} />
              </div>
            ) : (
              <LanguageBarChart data={stats?.languageUsage || []} />
            )}
          </CardContent>
        </Card>

        {/* Right: Last 7 Days Execution Volume */}
        <Card className="border-app-border bg-app-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-app-accent" />
                <CardTitle>Execution Volume</CardTitle>
              </div>
              <span className="text-[11px] text-app-text-muted font-mono">Last 7 days</span>
            </div>
            <CardDescription>
              Daily docker sandbox job executions and completion rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Skeleton height={160} width="100%" />
              </div>
            ) : (
              <RunsLineChart data={stats?.runsLast7Days || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
