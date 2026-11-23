import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { AdminRoomListItem, SupportedLanguage } from '../../types';
import { toast } from '../../store/toastStore';
import { getUserInitials, getUserColor } from '../../utils/colors';
import {
  Search,
  Layers,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const LANGUAGE_BADGES: Record<
  SupportedLanguage,
  { label: string; badgeClass: string }
> = {
  python: { label: 'Python', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  javascript: { label: 'JavaScript', badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  java: { label: 'Java', badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  cpp: { label: 'C++', badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
};

export const AdminRoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<AdminRoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRooms, setTotalRooms] = useState(0);

  // Delete modal state
  const [selectedRoomToDelete, setSelectedRoomToDelete] = useState<AdminRoomListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRooms = useCallback(async (targetPage = page, query = searchQuery) => {
    setIsLoading(true);
    try {
      const response = await adminApi.getRooms({
        page: targetPage,
        limit: 10,
        search: query || undefined,
      });

      if (response.success && response.data) {
        setRooms(response.data.items);
        setTotalPages(response.data.totalPages || 1);
        setTotalRooms(response.data.total || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load collaborative rooms');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchRooms(page, searchQuery);
  }, [page, searchQuery, fetchRooms]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const copyRoomCode = (shortId: string) => {
    navigator.clipboard.writeText(shortId);
    toast.success(`Room code "${shortId}" copied!`);
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoomToDelete) return;
    setIsDeleting(true);

    try {
      await adminApi.deleteRoom(selectedRoomToDelete.shortId);
      toast.success(`Room "${selectedRoomToDelete.name}" deleted successfully`);
      setRooms((prev) => prev.filter((r) => r.shortId !== selectedRoomToDelete.shortId));
      setTotalRooms((prev) => Math.max(0, prev - 1));
      setSelectedRoomToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete room');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Search & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search rooms by name, code or description..."
            value={searchQuery}
            onChange={handleSearchChange}
            leftIcon={<Search className="w-4 h-4 text-app-text-muted" />}
          />
        </div>

        <div className="flex items-center space-x-3 text-xs text-app-text-muted justify-between sm:justify-end">
          <span className="font-mono">
            Total: <strong className="text-app-text">{totalRooms}</strong> rooms
          </span>
          <button
            onClick={() => fetchRooms(page, searchQuery)}
            className="p-2 rounded-lg bg-app-surface-2 border border-app-border text-app-text-muted hover:text-app-text transition-colors"
            title="Refresh directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Rooms Table with Mobile Horizontal Scroll */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-2/60 text-[11px] font-bold text-app-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Room Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-xs">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><Skeleton width={140} height={14} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={80} height={18} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={70} height={20} /></td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <Skeleton circle width={24} height={24} />
                        <Skeleton width={90} height={12} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4"><Skeleton width={30} height={14} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={80} height={12} /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton width={60} height={28} className="ml-auto" /></td>
                  </tr>
                ))
              ) : rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <EmptyState
                      icon={<Layers className="w-6 h-6" />}
                      title="No collaborative rooms found"
                      description={
                        searchQuery
                          ? `No rooms matched your search "${searchQuery}".`
                          : 'No active rooms exist in the platform yet.'
                      }
                      action={
                        searchQuery ? (
                          <Button size="sm" variant="secondary" onClick={() => setSearchQuery('')}>
                            Clear Search
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                rooms.map((r) => {
                  const langConfig = LANGUAGE_BADGES[r.language] || {
                    label: r.language,
                    badgeClass: 'bg-app-surface-2 text-app-text-muted border-app-border',
                  };

                  const ownerInitials = getUserInitials(r.owner?.name, r.owner?.email);
                  const ownerColor = r.owner?.avatarColor || getUserColor(r.owner?.id || 'owner');

                  return (
                    <tr key={r.id} className="hover:bg-app-surface-2/40 transition-colors">
                      {/* Name & Desc */}
                      <td className="py-3 px-4">
                        <div className="max-w-[200px]">
                          <span className="font-semibold text-app-text block truncate" title={r.name}>
                            {r.name}
                          </span>
                          {r.description && (
                            <span className="text-[11px] text-app-text-muted block truncate" title={r.description}>
                              {r.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1">
                          <code className="px-2 py-0.5 rounded bg-app-surface-2 border border-app-border font-mono text-[11px] text-app-text">
                            {r.shortId}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyRoomCode(r.shortId)}
                            className="p-1 rounded text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition-colors"
                            title="Copy Code"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Language */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${langConfig.badgeClass}`}
                        >
                          {langConfig.label}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {r.owner?.avatarUrl ? (
                            <img
                              src={r.owner.avatarUrl}
                              alt={r.owner.name || 'Owner'}
                              className="w-5 h-5 rounded-full object-cover border border-app-border shrink-0"
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: ownerColor }}
                            >
                              {ownerInitials}
                            </div>
                          )}
                          <span className="text-xs text-app-text truncate max-w-[120px]">
                            {r.owner?.name || r.owner?.email || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* Members */}
                      <td className="py-3 px-4 font-mono text-app-text">
                        {r.membersCount}
                      </td>

                      {/* Created */}
                      <td className="py-3 px-4 text-app-text-muted font-mono text-[11px]">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <a
                            href={`/room/${r.shortId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-app-border bg-app-surface-2 text-app-text-muted hover:text-app-text transition-colors"
                            title="Open Room"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setSelectedRoomToDelete(r)}
                            className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                            title="Delete Room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(selectedRoomToDelete)}
        onClose={() => !isDeleting && setSelectedRoomToDelete(null)}
        title="Delete Collaborative Room"
        description="Permanently delete this room and all associated file trees, snapshots, and execution logs."
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start space-x-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-400">
                Confirm Deletion of "{selectedRoomToDelete?.name}" ({selectedRoomToDelete?.shortId})
              </p>
              <p className="text-app-text-muted mt-1 leading-relaxed">
                Any connected members will be immediately disconnected and all document states will be purged. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedRoomToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteRoom}
            >
              Delete Room
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
