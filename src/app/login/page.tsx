import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { config } from '@/lib/config';
import LoginForm from '@/components/LoginForm';

export default async function LoginPage() {
  const session = await getSession();

  // Redirect to home if already authenticated or auth is disabled
  if (!config.webAuth.enabled || session.authenticated) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-terminal-bg-primary to-terminal-bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="bg-terminal-bg-secondary rounded-xl p-8 shadow-2xl border border-terminal-border">
          <div className="text-center mb-8">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-terminal-accent-blue"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h1 className="text-3xl font-bold text-terminal-accent-blue mb-2">
              Web Terminal
            </h1>
            <p className="text-terminal-text-secondary">
              Enter your credentials to access the terminal
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
