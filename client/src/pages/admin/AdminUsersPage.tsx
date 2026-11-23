import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { AdminUserListItem } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { getUserInitials, getUserColor } from '../../utils/colors';
import {
  Search,
  Users,
  Shield,
  UserX,
  UserCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

type ConfirmActionType = 'DELETE' | 'STATUS' | 'ROLE';

interface ConfirmModalState {
  isOpen: boolean;
  type: ConfirmActionType;
  user: AdminUserListItem | null;
  targetStatus?: 'ACTIVE' | 'DISABLED';
  targetIsAdmin?: boolean;
}

export const AdminUsersPage: React.FC = () => {
  const { user: currentAuthUser } = useAuthStore();

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: 'DELETE',
    user: null,
  });

  const fetchUsers = useCallback(async (targetPage = page, query = searchQuery) => {
    setIsLoading(true);
    try {
      const response = await adminApi.getUsers({
        page: targetPage,
        limit: 10,
        search: query || undefined,
      });

      if (response.success && response.data) {
        setUsers(response.data.items);
        setTotalPages(response.data.totalPages || 1);
        setTotalUsers(response.data.total || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load user directory');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchUsers(page, searchQuery);
  }, [page, searchQuery, fetchUsers]);

  // Handle Search Input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page
  };

  // Open Confirm Modals
  const promptDeleteUser = (u: AdminUserListItem) => {
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      user: u,
    });
  };

  const promptToggleStatus = (u: AdminUserListItem) => {
    const nextStatus = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setConfirmModal({
      isOpen: true,
      type: 'STATUS',
      user: u,
      targetStatus: nextStatus,
    });
  };

  const promptToggleRole = (u: AdminUserListItem) => {
    const nextIsAdmin = !u.isAdmin;
    setConfirmModal({
      isOpen: true,
      type: 'ROLE',
      user: u,
      targetIsAdmin: nextIsAdmin,
    });
  };

  const closeConfirmModal = () => {
    if (isActionLoading) return;
    setConfirmModal({ isOpen: false, type: 'DELETE', user: null });
  };

  // Execute Confirmed Action
  const handleExecuteConfirmedAction = async () => {
    const targetUser = confirmModal.user;
    if (!targetUser) return;

    setIsActionLoading(true);
    try {
      if (confirmModal.type === 'DELETE') {
        await adminApi.deleteUser(targetUser.id);
        toast.success(`User "${targetUser.name || targetUser.email}" permanently deleted`);
        setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
        setTotalUsers((prev) => Math.max(0, prev - 1));
      } else if (confirmModal.type === 'STATUS' && confirmModal.targetStatus) {
        await adminApi.updateUserStatus(targetUser.id, confirmModal.targetStatus);
        const actionLabel = confirmModal.targetStatus === 'ACTIVE' ? 'enabled' : 'disabled';
        toast.success(`User "${targetUser.name || targetUser.email}" has been ${actionLabel}`);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, status: confirmModal.targetStatus! } : u
          )
        );
      } else if (confirmModal.type === 'ROLE' && confirmModal.targetIsAdmin !== undefined) {
        await adminApi.updateUserRole(targetUser.id, confirmModal.targetIsAdmin);
        const actionLabel = confirmModal.targetIsAdmin
          ? 'granted Administrator privileges'
          : 'demoted to standard member';
        toast.success(`User "${targetUser.name || targetUser.email}" ${actionLabel}`);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, isAdmin: confirmModal.targetIsAdmin! } : u
          )
        );
      }
      closeConfirmModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Controls: Search and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            leftIcon={<Search className="w-4 h-4 text-app-text-muted" />}
          />
        </div>

        <div className="flex items-center space-x-3 text-xs text-app-text-muted justify-between sm:justify-end">
          <span className="font-mono">
            Total: <strong className="text-app-text">{totalUsers}</strong> users
          </span>
          <button
            onClick={() => fetchUsers(page, searchQuery)}
            className="p-2 rounded-lg bg-app-surface-2 border border-app-border text-app-text-muted hover:text-app-text transition-colors"
            title="Refresh directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table Container with Mobile Horizontal Scroll */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-2/60 text-[11px] font-bold text-app-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Rooms</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-xs">
              {isLoading ? (
                // Skeletons
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <Skeleton circle width={32} height={32} />
                        <div className="space-y-1.5">
                          <Skeleton width={120} height={12} />
                          <Skeleton width={160} height={10} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4"><Skeleton width={60} height={20} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={60} height={20} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={30} height={14} /></td>
                    <td className="py-3.5 px-4"><Skeleton width={80} height={12} /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton width={140} height={28} className="ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <EmptyState
                      icon={<Users className="w-6 h-6" />}
                      title="No users found"
                      description={
                        searchQuery
                          ? `No accounts matched your search "${searchQuery}".`
                          : 'No user accounts found in the database.'
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
                users.map((u) => {
                  const isSelf = u.id === currentAuthUser?.id;
                  const initials = getUserInitials(u.name, u.email);
                  const avatarColor = u.avatarColor || getUserColor(u.id || u.email);

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-app-surface-2/40 transition-colors ${
                        isSelf ? 'bg-app-accent/5' : ''
                      }`}
                    >
                      {/* User Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.name || u.email}
                              className="w-8 h-8 rounded-full object-cover border border-app-border shrink-0"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                              style={{ backgroundColor: avatarColor }}
                            >
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-app-text truncate max-w-[150px]">
                                {u.name || 'Anonymous User'}
                              </span>
                              {isSelf && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-app-accent text-app-accent-contrast">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-app-text-muted font-mono truncate block max-w-[180px]">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {u.isAdmin ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                            <Shield className="w-3 h-3" />
                            <span>ADMIN</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-app-surface-2 text-app-text-muted border border-app-border">
                            MEMBER
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span>DISABLED</span>
                          </span>
                        )}
                      </td>

                      {/* Rooms Count */}
                      <td className="py-3 px-4 text-app-text font-mono">
                        {u.roomsCount ?? 0}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-app-text-muted text-[11px] font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Disable / Enable Toggle */}
                          <button
                            type="button"
                            onClick={() => promptToggleStatus(u)}
                            disabled={isSelf}
                            title={
                              isSelf
                                ? 'Cannot modify your own account status'
                                : u.status === 'ACTIVE'
                                ? 'Disable User'
                                : 'Enable User'
                            }
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed bg-app-surface-2 border-app-border text-app-text-muted'
                                : u.status === 'ACTIVE'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Make Admin / Remove Admin */}
                          <button
                            type="button"
                            onClick={() => promptToggleRole(u)}
                            disabled={isSelf}
                            title={
                              isSelf
                                ? 'Cannot modify your own administrative role'
                                : u.isAdmin
                                ? 'Revoke Admin Privileges'
                                : 'Promote to Admin'
                            }
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed bg-app-surface-2 border-app-border text-app-text-muted'
                                : u.isAdmin
                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25'
                                : 'bg-app-surface-2 text-app-text-muted border-app-border hover:text-app-text'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          <button
                            type="button"
                            onClick={() => promptDeleteUser(u)}
                            disabled={isSelf}
                            title={isSelf ? 'Cannot delete your own account' : 'Delete User Permanently'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed bg-app-surface-2 border-app-border text-app-text-muted'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                            }`}
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

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        title={
          confirmModal.type === 'DELETE'
            ? 'Delete User Account'
            : confirmModal.type === 'STATUS'
            ? `${confirmModal.targetStatus === 'DISABLED' ? 'Disable' : 'Enable'} User Account`
            : `${confirmModal.targetIsAdmin ? 'Promote to Admin' : 'Revoke Admin Privileges'}`
        }
        description={
          confirmModal.type === 'DELETE'
            ? 'This action is irreversible and will permanently delete the user and their owned rooms.'
            : 'Review the changes before applying them.'
        }
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start space-x-3 p-3 rounded-lg bg-app-surface-2 border border-app-border text-xs">
            <AlertTriangle className="w-4 h-4 text-app-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-app-text">
                Target User:{' '}
                <span className="font-mono text-app-accent">
                  {confirmModal.user?.name || confirmModal.user?.email}
                </span>
              </p>
              <p className="text-app-text-muted mt-1 leading-relaxed">
                {confirmModal.type === 'DELETE' &&
                  'Are you certain you wish to delete this account? All personal configurations and memberships will be purged.'}
                {confirmModal.type === 'STATUS' &&
                  `User will be set to "${confirmModal.targetStatus}". When disabled, the user cannot log in or participate in collaborative rooms.`}
                {confirmModal.type === 'ROLE' &&
                  (confirmModal.targetIsAdmin
                    ? 'This user will gain full administrative rights to manage all users, rooms, and audit trails.'
                    : 'Administrative access will be immediately revoked from this account.')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={closeConfirmModal}
              disabled={isActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={confirmModal.type === 'DELETE' ? 'danger' : 'primary'}
              size="sm"
              isLoading={isActionLoading}
              onClick={handleExecuteConfirmedAction}
            >
              {confirmModal.type === 'DELETE'
                ? 'Confirm Deletion'
                : confirmModal.type === 'STATUS'
                ? 'Apply Status'
                : 'Confirm Role'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
