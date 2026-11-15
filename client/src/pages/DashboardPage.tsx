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
  LogOut,
  User,
  Users,
  Copy,
  Trash2,
  ExternalLink,
  Code,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';

const LANGUAGE_BADGES: Record<
  SupportedLanguage,
  { label: string; bg: string; text: string; border: string }
> = {
  python: { label: 'Python 3.11', bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-600/40' },
  javascript: { label: 'JavaScript', bg: 'bg-yellow-950/60', text: 'text-yellow-300', border: 'border-yellow-600/40' },
  java: { label: 'Java 17', bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-600/40' },
  cpp: { label: 'C++ 13', bg: 'bg-sky-950/60', text: 'text-sky-300', border: 'border-sky-600/40' },
};

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Create room modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLang, setNewRoomLang] = useState<SupportedLanguage>('python');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join room input state
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

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
    toast.success(`Room code ${shortId} copied to clipboard!`);
  };

  const handleLogout = async () => {
    await logout();
    toast.info('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-screen bg-[#181818] text-[#cccccc] flex flex-col selection:bg-sky-900">
      {/* Top Navbar */}
      <header className="h-14 bg-[#252526] border-b border-[#3c3c3c] px-6 flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sky-400 font-bold tracking-wide">
            <Code2 className="w-5 h-5" />
            <span className="text-base text-gray-100">LiveCode</span>
          </div>
          <span className="text-gray-500 text-xs">/</span>
          <span className="text-xs text-gray-400 font-medium">Dashboard</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-full px-3 py-1">
            <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-bold">
              <User className="w-3 h-3" />
            </div>
            <span className="text-xs text-gray-200 font-medium">{user?.name || user?.email}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded hover:bg-[#323233]"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col space-y-6">
        {/* Action Header Card */}
        <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
              <span>Your Collaborative Workspaces</span>
              <Sparkles className="w-4 h-4 text-sky-400" />
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Create a new room or join an existing session with team members in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Join with code inline form */}
            <form onSubmit={handleJoinWithCode} className="flex items-center space-x-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code..."
                className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-sky-500 w-36 sm:w-44"
              />
              <button
                type="submit"
                disabled={isJoining}
                className="bg-[#323233] hover:bg-[#3c3c3c] border border-[#3c3c3c] text-gray-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                {isJoining ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>Join</span>
              </button>
            </form>

            {/* Create Room Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </button>
          </div>
        </div>

        {/* Rooms Grid / Section */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Rooms ({rooms.length})
            </h2>
          </div>

          {isLoadingRooms ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-500">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
              <p className="text-xs font-mono">Loading rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[#252526]/50 border border-dashed border-[#3c3c3c] rounded-xl text-center p-8">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
                <Code className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-200">No rooms found</h3>
              <p className="text-xs text-gray-400 max-w-sm mt-1 mb-5">
                You haven't created or joined any collaborative sessions yet. Create a room or join with a code to get started.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center space-x-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create your first room</span>
              </button>
            </div>
          ) : (
            /* Room Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => {
                const langConfig = LANGUAGE_BADGES[room.language] || LANGUAGE_BADGES.python;
                const isOwner = room.role === 'OWNER' || room.ownerId === user?.id;

                return (
                  <div
                    key={room.id}
                    className="bg-[#252526] border border-[#3c3c3c] hover:border-gray-600 rounded-xl p-5 shadow-lg flex flex-col justify-between transition group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded border ${langConfig.bg} ${langConfig.text} ${langConfig.border}`}
                        >
                          {langConfig.label}
                        </span>

                        <span
                          className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${
                            isOwner
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                              : room.role === 'EDITOR'
                              ? 'bg-sky-950/80 text-sky-400 border border-sky-500/30'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {room.role || (isOwner ? 'OWNER' : 'MEMBER')}
                        </span>
                      </div>

                      {/* Room Title */}
                      <h3 className="text-sm font-bold text-gray-100 group-hover:text-sky-300 transition line-clamp-1">
                        {room.name}
                      </h3>

                      {room.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {room.description}
                        </p>
                      )}

                      {/* Code Badge */}
                      <div className="flex items-center space-x-2 mt-4 text-xs font-mono text-gray-400">
                        <span className="text-[11px] text-gray-500">Code:</span>
                        <span className="bg-[#1e1e1e] px-2 py-0.5 rounded border border-[#3c3c3c] text-sky-400 select-all">
                          {room.shortId}
                        </span>
                        <button
                          onClick={() => copyRoomCode(room.shortId)}
                          className="hover:text-white transition p-1"
                          title="Copy code"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-5 pt-4 border-t border-[#3c3c3c] flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-[11px]">
                          {room._count?.members || room.members?.length || 1} member
                          {(room._count?.members || room.members?.length || 1) !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteRoom(room.shortId, room.name)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/30 rounded transition"
                            title="Delete room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/room/${room.shortId}`)}
                          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow-sm"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-sky-400" />
                <span>Create New Room</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Room Name</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Distributed Algorithms Session"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Primary Language
                </label>
                <select
                  value={newRoomLang}
                  onChange={(e) => setNewRoomLang(e.target.value as SupportedLanguage)}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="python">Python 3.11</option>
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="java">Java 17</option>
                  <option value="cpp">C++ (g++ 13)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Notes or agenda for this collaborative workspace..."
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition shadow"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Room</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
