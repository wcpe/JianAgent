import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">JianAgent 登录</h1>

        {error && <div className="mb-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">用户名</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            required
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-500 disabled:opacity-50 transition-colors"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
