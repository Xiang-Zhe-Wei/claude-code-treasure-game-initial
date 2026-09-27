import { useState, FormEvent } from 'react';
import { Button } from './ui/button';
import { api, User } from '../lib/api';

interface AuthPanelProps {
  onAuthenticated: (user: User) => void;
  onGuest: () => void;
}

export function AuthPanel({ onAuthenticated, onGuest }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await (mode === 'login' ? api.login : api.signup)(username, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border-2 border-amber-300 bg-white/80 px-3 py-2 text-amber-900 outline-none focus:border-amber-500';

  return (
    <div className="w-full max-w-sm p-6 bg-amber-200/80 backdrop-blur-sm rounded-xl shadow-lg border-2 border-amber-400">
      <h2 className="text-2xl text-center mb-4 text-amber-900">
        {mode === 'login' ? 'Sign In' : 'Sign Up'}
      </h2>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          className={inputClass}
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          type="submit"
          disabled={busy}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-3 w-full text-sm text-amber-800 underline"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setError('');
        }}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>

      <div className="my-4 border-t border-amber-400" />

      <Button
        type="button"
        variant="outline"
        className="w-full border-amber-500 text-amber-900"
        onClick={onGuest}
      >
        Play as Guest (scores not saved)
      </Button>
    </div>
  );
}
