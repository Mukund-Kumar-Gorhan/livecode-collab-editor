import React, { useState } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  UserX,
  Shield,
  Loader2,
  Crown,
} from 'lucide-react';
import { Room, RoomMember, RoomRole } from '../../types';
import { toast } from '../../store/toastStore';
import { getUserInitials, getUserColor } from '../../utils/colors';

export interface ActiveUser {
  clientId: number;
  userId?: string | number;
  name: string;
  color: string;
  avatarUrl?: string | null;
  isCurrentUser?: boolean;
}

/**
 * Checks if a room member is currently online using active awareness states.
 * Safely extracts member user ID (from member.userId, member.user.id, or member.id)
 * and matches against awareness userIds, handling string/number type mismatches.
 * Supports multiple tabs per user: if at least one tab is connected, user is online.
 */
export const isMemberOnline = (
  member: RoomMember,
  activeUsers: ActiveUser[] = [],
  currentUserId?: string | number
): boolean => {
  if (!member) return false;

  // Collect all potential ID representations for this member
  const candidateIds: string[] = [];
  if (member.userId !== undefined && member.userId !== null) {
    candidateIds.push(String(member.userId).trim());
  }
  if (member.user?.id !== undefined && member.user?.id !== null) {
    candidateIds.push(String(member.user.id).trim());
  }
  if (candidateIds.length === 0 && member.id !== undefined && member.id !== null) {
    candidateIds.push(String(member.id).trim());
  }

  if (candidateIds.length === 0) return false;

  const currentUserIdStr =
    currentUserId !== undefined && currentUserId !== null ? String(currentUserId).trim() : null;

  return activeUsers.some((u) => {
    if (!u) return false;

    // Direct awareness userId match (handling string/number conversion)
    if (u.userId !== undefined && u.userId !== null) {
      const activeUserIdStr = String(u.userId).trim();
      if (candidateIds.includes(activeUserIdStr)) {
        return true;
      }
    }

    // Fallback: If this active client is marked as the current user, match against currentUserId
    if (u.isCurrentUser && currentUserIdStr && candidateIds.includes(currentUserIdStr)) {
      return true;
    }

    return false;
  });
};

interface MembersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  currentRole: RoomRole | null;
  currentUserId?: string;
  activeUsers: ActiveUser[];
  onRoleChanged?: (userId: string, newRole: 'EDITOR' | 'VIEWER') => Promise<void>;
  onMemberRemoved?: (userId: string) => Promise<void>;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  isOpen,
  onClose,
  room,
  currentRole,
  currentUserId,
  activeUsers = [],
  onRoleChanged,
  onMemberRemoved,
}) => {
  const [copied, setCopied] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  if (!isOpen || !room) return null;

  const isOwner = currentRole === 'OWNER';
  const members = room.members || [];
  const inviteUrl = `${window.location.origin}/room/${room.shortId}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleSelect = async (userId: string, newRole: 'EDITOR' | 'VIEWER') => {
    if (!onRoleChanged) return;
    setUpdatingUserId(userId);
    try {
      await onRoleChanged(userId, newRole);
    } catch {
      // Error handled by parent toast
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleKick = async (userId: string, memberName: string) => {
    if (!onMemberRemoved) return;
    if (!window.confirm(`Are you sure you want to remove "${memberName}" from this room?`)) {
      return;
    }
    setRemovingUserId(userId);
    try {
      await onMemberRemoved(userId);
    } catch {
      // Error handled by parent toast
    } finally {
      setRemovingUserId(null);
    }
  };

  // Helper to check if a user is currently online via awareness states
  const checkIsOnline = (member: RoomMember): boolean => {
    return isMemberOnline(member, activeUsers, currentUserId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md bg-app-surface border border-app-border rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-app-border flex items-center justify-between bg-app-surface-2/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-app-text font-heading flex items-center space-x-2">
                <span>Room Members</span>
                <span className="text-[11px] font-mono font-normal bg-app-border px-2 py-0.5 rounded-full text-app-text-muted">
                  {members.length}
                </span>
              </h2>
              <p className="text-[11px] text-app-text-muted">
                {room.name} ({room.shortId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text p-1.5 hover:bg-app-border/40 rounded-lg transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite Link Card */}
        <div className="p-4 border-b border-app-border bg-app-bg/40">
          <label className="block text-[11px] font-semibold text-app-text-muted uppercase tracking-wider mb-1.5">
            Invite Link
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 bg-app-surface border border-app-border text-app-text text-xs rounded-lg px-3 py-2 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyInvite}
              className="flex items-center space-x-1.5 bg-app-accent hover:opacity-90 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0"
              title="Copy invite link"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {members.map((member: RoomMember) => {
            const rawMemberUserId = member.userId ?? member.user?.id ?? member.id;
            const memberUserId = rawMemberUserId !== undefined && rawMemberUserId !== null ? String(rawMemberUserId).trim() : '';
            const isSelf = memberUserId && currentUserId ? memberUserId === String(currentUserId).trim() : false;
            const isMemberOwner = member.role === 'OWNER' || (room.ownerId && memberUserId ? memberUserId === String(room.ownerId).trim() : false);
            const isOnline = checkIsOnline(member);
            const displayName = member.user?.name || member.user?.email?.split('@')[0] || 'User';
            const userColor = member.user?.avatarColor || getUserColor(memberUserId || 'guest');
            const isUpdating = updatingUserId === memberUserId;
            const isRemoving = removingUserId === memberUserId;

            return (
              <div
                key={member.id || member.userId}
                className="flex items-center justify-between p-2.5 rounded-lg border border-app-border bg-app-surface-2/40 hover:bg-app-surface-2 transition"
              >
                {/* Avatar & User Details */}
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="relative shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden"
                      style={{ backgroundColor: userColor }}
                    >
                      {member.user?.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getUserInitials(displayName)
                      )}
                    </div>
                    {/* Online / Offline Dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-app-surface ${
                        isOnline ? 'bg-app-success' : 'bg-gray-500'
                      }`}
                      title={isOnline ? 'Online now' : 'Offline'}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-app-text truncate">
                        {displayName}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] text-app-accent font-mono bg-app-accent/15 px-1 rounded">
                          You
                        </span>
                      )}
                      {isMemberOwner && (
                        <span title="Room Owner" className="inline-flex shrink-0">
                          <Crown className="w-3 h-3 text-amber-400" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-app-text-muted truncate">
                      {member.user?.email || 'member'}
                    </p>
                  </div>
                </div>

                {/* Role Badge / Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  {/* If target is Room Owner: always show immutable Owner badge */}
                  {isMemberOwner ? (
                    <span className="flex items-center space-x-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Shield className="w-3 h-3" />
                      <span>Owner</span>
                    </span>
                  ) : isOwner ? (
                    /* Owner controls: Role Dropdown + Kick Button */
                    <div className="flex items-center space-x-1.5">
                      {isUpdating ? (
                        <div className="p-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-app-accent" />
                        </div>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleSelect(memberUserId, e.target.value as 'EDITOR' | 'VIEWER')
                          }
                          disabled={isUpdating || isRemoving}
                          className="bg-app-surface text-app-text text-[11px] font-semibold border border-app-border rounded px-2 py-1 focus:outline-none focus:border-app-accent cursor-pointer"
                        >
                          <option value="EDITOR">EDITOR</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      )}

                      <button
                        onClick={() => handleKick(memberUserId, displayName)}
                        disabled={isUpdating || isRemoving}
                        className="p-1 text-app-text-muted hover:text-app-danger hover:bg-app-danger/10 rounded transition"
                        title={`Remove ${displayName} from room`}
                      >
                        {isRemoving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-app-danger" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    /* Non-owner viewer: read-only badge */
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        member.role === 'EDITOR'
                          ? 'bg-app-accent/15 text-app-accent border border-app-accent/30'
                          : 'bg-app-warning/15 text-app-warning border border-app-warning/30'
                      }`}
                    >
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
