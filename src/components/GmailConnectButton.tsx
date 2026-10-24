import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn, googleSignOut, initAuth, getCurrentUser, getAccessToken } from '../services/googleAuth';
import { Mail, CheckCircle2, LogOut, Loader2 } from 'lucide-react';

interface GmailConnectButtonProps {
  onAuthChange?: (user: User | null, token: string | null) => void;
  compact?: boolean;
}

export const GmailConnectButton: React.FC<GmailConnectButtonProps> = ({
  onAuthChange,
  compact = false,
}) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        if (onAuthChange) onAuthChange(authUser, token);
      },
      () => {
        setUser(null);
        if (onAuthChange) onAuthChange(null, null);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onAuthChange]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        if (onAuthChange) onAuthChange(res.user, res.accessToken);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Failed to connect Gmail');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await googleSignOut();
      setUser(null);
      if (onAuthChange) onAuthChange(null, null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-emerald-50 border border-emerald-200 rounded-md text-emerald-900 font-medium shadow-2xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] truncate max-w-[170px]" title={user.email || ''}>
            {user.email}
          </span>
          <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1 rounded font-semibold">
            Gmail Active
          </span>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isLoading}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
          title="Disconnect Gmail Account"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-md transition-all shadow-xs hover:shadow-sm"
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-600" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{isLoading ? 'Connecting...' : 'Connect Gmail'}</span>
      </button>

      {error && (
        <span className="text-[11px] text-red-600 truncate max-w-[120px]" title={error}>
          {error}
        </span>
      )}
    </div>
  );
};
