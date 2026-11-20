import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User as UserIcon,
  Upload,
  Trash2,
  Lock,
  Palette,
  Code,
  Sliders,
  ShieldCheck,
  Save,
  RotateCcw,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, AVAILABLE_THEMES } from '../store/themeStore';
import { userApi } from '../services/api';
import { toast } from '../store/toastStore';
import { AppTheme, SupportedLanguage } from '../types';
import { getUserInitials, getUserColor } from '../utils/colors';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

const PRESET_AVATAR_COLORS = [
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
];

const SUPPORTED_LANGUAGES: { id: SupportedLanguage; label: string }[] = [
  { id: 'python', label: 'Python (3.11)' },
  { id: 'javascript', label: 'JavaScript (Node 20)' },
  { id: 'java', label: 'Java (17)' },
  { id: 'cpp', label: 'C++ (13)' },
];

export const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  // Form states
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarColor, setAvatarColor] = useState('#0ea5e9');
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('midnight');
  const [editorFontSize, setEditorFontSize] = useState<number>(14);
  const [defaultLanguage, setDefaultLanguage] = useState<SupportedLanguage>('python');
  const [tabSize, setTabSize] = useState<number>(2);

  // Password change form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Avatar upload states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save states
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatarColor(user.avatarColor || getUserColor(user.id || user.email));
      setSelectedTheme(user.theme || theme);
      setEditorFontSize(user.editorFontSize || 14);
      setDefaultLanguage(user.defaultLanguage || 'python');
      setTabSize(user.tabSize || 2);
    }
  }, [user]);

  // Check for unsaved changes
  const hasUnsavedChanges =
    user &&
    (name !== (user.name || '') ||
      bio !== (user.bio || '') ||
      avatarColor !== (user.avatarColor || getUserColor(user.id || user.email)) ||
      selectedTheme !== (user.theme || 'midnight') ||
      editorFontSize !== (user.editorFontSize || 14) ||
      defaultLanguage !== (user.defaultLanguage || 'python') ||
      tabSize !== (user.tabSize || 2));

  // Reset form to current user values
  const handleReset = () => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatarColor(user.avatarColor || getUserColor(user.id || user.email));
      setSelectedTheme(user.theme || 'midnight');
      setEditorFontSize(user.editorFontSize || 14);
      setDefaultLanguage(user.defaultLanguage || 'python');
      setTabSize(user.tabSize || 2);
      setTheme(user.theme || 'midnight', false);
    }
  };

  // Live theme switch on theme card click
  const handleSelectTheme = (thm: AppTheme) => {
    setSelectedTheme(thm);
    setTheme(thm, false); // Live preview without immediate DB write until saved
  };

  // Avatar upload
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      toast.error('Image size must be 200KB or less');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPEG, and WebP images are allowed');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await userApi.uploadAvatar(file);
      setUser(res.data.user);
      toast.success('Avatar uploaded successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    setIsDeletingAvatar(true);
    try {
      const res = await userApi.deleteAvatar();
      setUser(res.data.user);
      toast.success('Avatar removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete avatar');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (name.trim().length < 2 || name.trim().length > 50) {
      toast.error('Name must be between 2 and 50 characters');
      return;
    }

    if (bio.length > 160) {
      toast.error('Bio must not exceed 160 characters');
      return;
    }

    setIsSaving(true);
    try {
      const res = await userApi.updateMe({
        name: name.trim(),
        bio: bio.trim() || null,
        avatarColor,
        theme: selectedTheme,
        editorFontSize,
        defaultLanguage,
        tabSize,
      });

      setUser(res.data.user);
      setTheme(selectedTheme, true);
      toast.success('Profile and preferences saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await userApi.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully! Other sessions invalidated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: '', score: 0, color: 'bg-app-border' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    switch (score) {
      case 1:
        return { label: 'Weak', score: 25, color: 'bg-app-danger' };
      case 2:
        return { label: 'Fair', score: 50, color: 'bg-app-warning' };
      case 3:
        return { label: 'Good', score: 75, color: 'bg-app-accent' };
      case 4:
      default:
        return { label: 'Strong', score: 100, color: 'bg-app-success' };
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const displayName = name || user?.email?.split('@')[0] || 'User';
  const initials = getUserInitials(name || user?.name, user?.email);

  return (
    <div className="min-h-screen bg-app-bg text-app-text pb-28 selection:bg-app-accent/30">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-app-surface/90 backdrop-blur-md border-b border-app-border px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-app-text font-heading leading-tight">
              Profile & Preferences
            </h1>
            <p className="text-xs text-app-text-muted">
              Customize your identity, theme, editor settings, and security
            </p>
          </div>
        </div>

        {hasUnsavedChanges && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-app-warning/15 text-app-warning border border-app-warning/30 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            Unsaved Changes
          </span>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Section 1: Avatar & Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <UserIcon className="w-4 h-4 text-app-accent" />
              <span>Identity & Avatar</span>
            </CardTitle>
            <CardDescription>
              This is how other collaborators see you across active workspaces and remote cursors.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar Preview & Upload Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pt-1">
              <div className="relative group shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-app-border shadow-md"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md transition-transform"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={isUploadingAvatar}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Photo
                  </Button>

                  {user?.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={isDeletingAvatar}
                      leftIcon={<Trash2 className="w-3.5 h-3.5 text-app-danger" />}
                      onClick={handleDeleteAvatar}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-app-text-muted">
                  Allowed formats: PNG, JPG, or WebP. Max size: 200KB.
                </p>

                {/* Preset Avatar Color Picker */}
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-app-text-muted mb-1.5 uppercase tracking-wide">
                    Cursor & Fallback Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                          avatarColor === c ? 'border-app-text scale-110 shadow-sm' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {avatarColor === c && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={avatarColor}
                      onChange={(e) => setAvatarColor(e.target.value)}
                      className="w-6 h-6 p-0 border border-app-border rounded-full cursor-pointer bg-transparent"
                      title="Custom Hex Color"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs: Name, Email, Bio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                helperText="2 to 50 characters"
                required
              />

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1.5 select-none">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full bg-app-surface-2 border border-app-border rounded-lg pl-3 pr-8 py-2 text-xs text-app-text-muted cursor-not-allowed select-none"
                  />
                  <div className="absolute right-3 text-app-text-muted">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-[11px] text-app-text-muted mt-1">Email cannot be modified.</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-app-text-muted">Bio</label>
                <span
                  className={`text-[11px] ${
                    bio.length > 160 ? 'text-app-danger font-bold' : 'text-app-text-muted'
                  }`}
                >
                  {bio.length} / 160
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={2}
                placeholder="Write a brief tagline or what you like coding in..."
                className="w-full bg-app-surface border border-app-border rounded-lg p-2.5 text-xs text-app-text placeholder:text-app-text-muted/60 focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-all resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Theme Chooser (5 Cards with Live Preview) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <Palette className="w-4 h-4 text-app-accent" />
              <span>Theme System (5 Themes)</span>
            </CardTitle>
            <CardDescription>
              Click any theme card to preview instantly. Fully adapts UI tokens, syntax highlighting, and contrast.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {AVAILABLE_THEMES.map((thm) => {
                const isSelected = selectedTheme === thm.id;
                return (
                  <button
                    key={thm.id}
                    type="button"
                    onClick={() => handleSelectTheme(thm.id)}
                    className={`relative text-left p-3.5 rounded-xl border-2 transition-all duration-200 group flex flex-col justify-between ${
                      isSelected
                        ? 'border-app-accent bg-app-accent/10 shadow-md ring-1 ring-app-accent'
                        : 'border-app-border bg-app-surface-2 hover:border-app-text-muted/50'
                    }`}
                  >
                    {/* Mock editor preview swatch */}
                    <div
                      className="w-full h-16 rounded-lg p-2 mb-3 border border-black/20 flex flex-col justify-between overflow-hidden shadow-inner"
                      style={{ backgroundColor: thm.previewColors.bg }}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                      </div>
                      <div className="space-y-1 font-mono text-[9px]">
                        <div
                          className="h-1.5 rounded w-3/4 opacity-90"
                          style={{ backgroundColor: thm.previewColors.accent }}
                        />
                        <div
                          className="h-1.5 rounded w-1/2 opacity-60"
                          style={{ backgroundColor: thm.previewColors.surface }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-app-text font-heading">{thm.name}</h4>
                        {isSelected && <Check className="w-4 h-4 text-app-accent" />}
                      </div>
                      <p className="text-[11px] text-app-text-muted mt-0.5 leading-snug line-clamp-2">
                        {thm.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Editor Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <Code className="w-4 h-4 text-app-accent" />
              <span>Editor Settings</span>
            </CardTitle>
            <CardDescription>
              Configures Monaco font sizing, indentation spacing, and preferred language for new rooms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Font Size Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-app-text-muted flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-app-accent" />
                  <span>Editor Font Size</span>
                </label>
                <span className="text-xs font-mono font-bold bg-app-surface-2 px-2 py-0.5 rounded border border-app-border text-app-accent">
                  {editorFontSize} px
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={24}
                step={1}
                value={editorFontSize}
                onChange={(e) => setEditorFontSize(Number(e.target.value))}
                className="w-full accent-app-accent cursor-pointer h-1.5 bg-app-surface-2 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-app-text-muted mt-1 font-mono">
                <span>10px</span>
                <span>14px (default)</span>
                <span>24px</span>
              </div>
            </div>

            {/* Tab Size & Default Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tab Size */}
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-2">
                  Tab Indentation Size
                </label>
                <div className="flex items-center gap-2">
                  {[2, 4, 8].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTabSize(size)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all ${
                        tabSize === size
                          ? 'bg-app-accent text-app-accent-contrast border-app-accent shadow-sm'
                          : 'bg-app-surface-2 text-app-text border-app-border hover:bg-app-border'
                      }`}
                    >
                      {size} spaces
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Language */}
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-2">
                  Default Room Language
                </label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value as SupportedLanguage)}
                  className="w-full bg-app-surface border border-app-border rounded-lg px-3 py-2 text-xs text-app-text focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent transition-colors"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Security & Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <ShieldCheck className="w-4 h-4 text-app-accent" />
              <span>Change Password</span>
            </CardTitle>
            <CardDescription>
              Update your account password. Changing your password will invalidate all other active sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                isPasswordToggle
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  isPasswordToggle
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  isPasswordToggle
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              {/* Password strength indicator */}
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-app-text-muted">Password Strength</span>
                    <span className="font-semibold text-app-text">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full bg-app-surface-2 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  isLoading={isChangingPassword}
                  disabled={!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Sticky Bottom Save Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-app-surface/95 backdrop-blur-md border-t border-app-border py-3 px-4 sm:px-8 z-40 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges ? (
              <span className="text-xs text-app-warning font-semibold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You have unsaved changes</span>
              </span>
            ) : (
              <span className="text-xs text-app-text-muted flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-app-success shrink-0" />
                <span>Profile is up to date</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasUnsavedChanges || isSaving}
              onClick={handleReset}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>

            <Button
              variant="primary"
              size="sm"
              isLoading={isSaving}
              disabled={!hasUnsavedChanges}
              onClick={handleSaveProfile}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};
