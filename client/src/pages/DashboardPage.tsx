import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { roomApi } from '../services/api';
import { Room, SupportedLanguage } from '../types';
import { toast } from '../store/toastStore';
import {
  Code2,
  Plus,
  LogIn,
  Search,
  Users,
  Copy,
  Trash2,
  ExternalLink,
  Code,
  Sparkles,
  Filter,
} from 'lucide-react';
import { UserNavDropdown } from '../components/UserNavDropdown';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { getUserInitials, getUserColor } from '../utils/colors';

const LANGUAGE_BADGES: Record<
  SupportedLanguage,
  { label: string; badgeClass: string }
> = {
  python: { label: 'Python 3.11', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  javascript: { label: 'JavaScript', badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  java: { label: 'Java 17', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  cpp: { label: 'C++ 13', badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLangFilter, setSelectedLangFilter] = useState<'all' | SupportedLanguage>('all');

  // Create room modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLang, setNewRoomLang] = useState<SupportedLanguage>('python');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join room input state
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Initialize modal language from user's preferred defaultLanguage
  useEffect(() => {
    if (user?.defaultLanguage) {
      setNewRoomLang(user.defaultLanguage);
    }
  }, [user?.defaultLanguage, isModalOpen]);

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await roomApi.listRooms();
      setRooms(res.data.rooms || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      toast.error('Room name is required');
      return;
    }

    setIsCreating(true);
    try {
      const res = await roomApi.createRoom({
        name: newRoomName.trim(),
        language: newRoomLang,
        description: newRoomDesc.trim() || undefined,
      });

      toast.success(`Room "${res.data.room.name}" created!`);
      setIsModalOpen(false);
      setNewRoomName('');
      setNewRoomDesc('');
      navigate(`/room/${res.data.room.shortId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      toast.error('Please enter a room code');
      return;
    }

    setIsJoining(true);
    try {
      await roomApi.joinRoom(code);
      toast.success('Joined room successfully!');
      navigate(`/room/${code}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Room not found or could not join');
    } finally {
      setIsJoining(false);
    }
  };

  const handleDeleteRoom = async (shortId: string, roomName: string) => {
    if (!window.confirm(`Are you sure you want to delete room "${roomName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await roomApi.deleteRoom(shortId);
      toast.success('Room deleted successfully');
      setRooms((prev) => prev.filter((r) => r.shortId !== shortId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete room');
    }
  };

  const copyRoomCode = (shortId: string) => {
    navigator.clipboard.writeText(shortId);
    toast.success(`Room code "${shortId}" copied to clipboard!`);
  };

  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shortId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLang = selectedLangFilter === 'all' || r.language === selectedLangFilter;
    return matchesSearch && matchesLang;
  });

  const displayName = user?.name || user?.email?.split('@')[0] || 'Engineer';

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col selection:bg-app-accent/30">
      {/* Top Navbar */}
      <header className="h-14 bg-app-surface border-b border-app-border px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-app-accent font-bold tracking-wide">
            <Code2 className="w-5 h-5" />
            <span className="text-base text-app-text font-heading">LiveCode</span>
          </div>
          <span className="text-app-border text-xs hidden sm:inline">/</span>
          <span className="text-xs text-app-text-muted font-medium hidden sm:inline">Dashboard</span>
        </div>

        <div className="flex items-center space-x-3">
          <ThemeSwitcher compact />
          <UserNavDropdown />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col space-y-8">
        {/* Welcome & Quick Action Banner */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Subtle accent highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-app-accent via-indigo-500 to-emerald-500" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-app-accent uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Real-Time Code Collaboration</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-app-text font-heading">
                Welcome back, {displayName}
              </h1>
              <p className="text-xs sm:text-sm text-app-text-muted mt-1 max-w-xl leading-relaxed">
                Start a live coding session with your team, edit in real time with synchronized Monaco cursors, and run code securely in Docker containers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsModalOpen(true)}
              >
                Create Room
              </Button>
            </div>
          </div>
        </div>

        {/* Action Row: Join with code card + Search & Filter bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Join with code card */}
          <Card className="lg:col-span-1">
            <CardHeader className="mb-3">
              <CardTitle className="text-sm flex items-center space-x-2">
                <LogIn className="w-4 h-4 text-app-accent" />
                <span>Join with Room Code</span>
              </CardTitle>
              <CardDescription>
                Got a 6-character room code from a teammate? Paste it here.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleJoinWithCode} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. ab12cd"
                className="w-full bg-app-surface-2 border border-app-border rounded-lg px-3 py-2 text-xs text-app-text placeholder:text-app-text-muted/60 font-mono focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent uppercase tracking-wider"
              />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                isLoading={isJoining}
                disabled={!joinCode.trim()}
              >
                Join
              </Button>
            </form>
          </Card>

          {/* Search & Language Filters Card */}
          <Card className="lg:col-span-2 flex flex-col justify-between">
            <CardHeader className="mb-3">
              <CardTitle className="text-sm flex items-center space-x-2">
                <Filter className="w-4 h-4 text-app-accent" />
                <span>Search & Filter</span>
              </CardTitle>
              <CardDescription>
                Quickly locate rooms by name, short ID, or programming language.
              </CardDescription>
            </CardHeader>

            <div className="space-y-3">
              {/* Search bar */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rooms by name, code or description..."
                  className="w-full bg-app-surface-2 border border-app-border rounded-lg pl-9 pr-3 py-2 text-xs text-app-text placeholder:text-app-text-muted/60 focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-all"
                />
              </div>

              {/* Language filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'python', 'javascript', 'java', 'cpp'] as const).map((filterId) => (
                  <button
                    key={filterId}
                    type="button"
                    onClick={() => setSelectedLangFilter(filterId)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                      selectedLangFilter === filterId
                        ? 'bg-app-accent text-app-accent-contrast border-app-accent font-semibold shadow-sm'
                        : 'bg-app-surface-2 text-app-text-muted border-app-border hover:text-app-text'
                    }`}
                  >
                    {filterId === 'all'
                      ? 'All Languages'
                      : filterId === 'cpp'
                      ? 'C++'
                      : filterId.charAt(0).toUpperCase() + filterId.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Rooms Grid Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-app-text-muted flex items-center space-x-2">
              <span>Your Workspaces</span>
              <span className="text-[10px] font-mono bg-app-surface-2 px-2 py-0.5 rounded-full border border-app-border text-app-text">
                {filteredRooms.length} of {rooms.length}
              </span>
            </h2>
          </div>

          {isLoadingRooms ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton width="80px" height="20px" />
                    <Skeleton width="60px" height="20px" />
                  </div>
                  <Skeleton width="180px" height="24px" />
                  <Skeleton width="100%" height="36px" />
                  <div className="pt-3 border-t border-app-border flex justify-between">
                    <Skeleton width="70px" height="20px" />
                    <Skeleton width="60px" height="28px" />
                  </div>
                </div>
              ))}
            </div>
          ) : rooms.length === 0 ? (
            /* Zero Rooms Empty State */
            <EmptyState
              icon={<Code className="w-6 h-6 text-app-accent" />}
              title="No collaborative workspaces yet"
              description="Create your first collaborative session or join an existing room with a code to start hacking."
              action={
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsModalOpen(true)}
                >
                  Create your first room
                </Button>
              }
            />
          ) : filteredRooms.length === 0 ? (
            /* Search yielded no matches */
            <EmptyState
              icon={<Search className="w-6 h-6 text-app-text-muted" />}
              title="No matching rooms found"
              description={`No rooms matched "${searchQuery}". Try a different keyword or clear language filters.`}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLangFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              }
            />
          ) : (
            /* Rooms Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const langConfig = LANGUAGE_BADGES[room.language] || LANGUAGE_BADGES.python;
                const isOwner = room.role === 'OWNER' || room.ownerId === user?.id;

                return (
                  <div
                    key={room.id}
                    className="bg-app-surface border border-app-border hover:border-app-accent/60 rounded-xl p-5 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${langConfig.badgeClass}`}
                        >
                          {langConfig.label}
                        </span>

                        <span
                          className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border ${
                            isOwner
                              ? 'bg-app-success/15 text-app-success border-app-success/30'
                              : room.role === 'EDITOR'
                              ? 'bg-app-accent/15 text-app-accent border-app-accent/30'
                              : 'bg-app-warning/15 text-app-warning border-app-warning/30'
                          }`}
                        >
                          {room.role || (isOwner ? 'OWNER' : 'MEMBER')}
                        </span>
                      </div>

                      {/* Room Title */}
                      <h3
                        onClick={() => navigate(`/room/${room.shortId}`)}
                        className="text-sm font-bold text-app-text group-hover:text-app-accent transition-colors line-clamp-1 cursor-pointer font-heading"
                        title="Open room editor"
                      >
                        {room.name}
                      </h3>

                      {room.description ? (
                        <p className="text-xs text-app-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                          {room.description}
                        </p>
                      ) : (
                        <p className="text-xs text-app-text-muted/60 mt-1.5 italic">
                          No description provided
                        </p>
                      )}

                      {/* Code Badge */}
                      <div className="flex items-center space-x-2 mt-4 text-xs font-mono">
                        <span className="text-[11px] text-app-text-muted">Code:</span>
                        <span className="bg-app-surface-2 px-2 py-0.5 rounded border border-app-border text-app-accent font-semibold select-all">
                          {room.shortId}
                        </span>
                        <button
                          onClick={() => copyRoomCode(room.shortId)}
                          className="text-app-text-muted hover:text-app-text transition p-1 rounded hover:bg-app-surface-2"
                          title="Copy room code"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Footer: Members Stack + Open / Delete */}
                    <div className="mt-5 pt-3.5 border-t border-app-border flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {/* Member avatar stack or count */}
                        {room.members && room.members.length > 0 ? (
                          <div className="flex items-center -space-x-1.5">
                            {room.members.slice(0, 3).map((m) => {
                              const mColor = m.user?.avatarColor || getUserColor(m.userId);
                              return (
                                <div
                                  key={m.id}
                                  className="w-5 h-5 rounded-full border border-app-surface flex items-center justify-center text-[9px] font-bold text-white overflow-hidden shadow-xs"
                                  style={{ backgroundColor: mColor }}
                                  title={m.user?.name || m.user?.email || 'Member'}
                                >
                                  {m.user?.avatarUrl ? (
                                    <img src={m.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    getUserInitials(m.user?.name, m.user?.email)
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        <span className="text-[11px] text-app-text-muted flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            {room._count?.members || room.members?.length || 1}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteRoom(room.shortId, room.name)}
                            className="p-1.5 text-app-text-muted hover:text-app-danger hover:bg-app-danger/10 rounded-lg transition"
                            title="Delete room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/room/${room.shortId}`)}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Collaborative Room"
        description="Set up a real-time room to code, sync, and execute with teammates."
      >
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <Input
            label="Room Name"
            required
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="e.g. Distributed Algorithms Session"
          />

          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1.5 select-none">
              Primary Language
            </label>
            <select
              value={newRoomLang}
              onChange={(e) => setNewRoomLang(e.target.value as SupportedLanguage)}
              className="w-full bg-app-surface border border-app-border rounded-lg px-3 py-2 text-xs text-app-text focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent font-mono transition-colors"
            >
              <option value="python">Python 3.11</option>
              <option value="javascript">JavaScript (Node.js 20)</option>
              <option value="java">Java 17</option>
              <option value="cpp">C++ (g++ 13)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1.5 select-none">
              Description <span className="text-app-text-muted/60">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={newRoomDesc}
              onChange={(e) => setNewRoomDesc(e.target.value)}
              placeholder="Notes or agenda for this collaborative workspace..."
              className="w-full bg-app-surface border border-app-border rounded-lg px-3 py-2 text-xs text-app-text placeholder:text-app-text-muted/60 focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent resize-none transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
