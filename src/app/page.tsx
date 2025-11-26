import { redirect } from 'next/navigation';
import { getSession } from '../lib/session';
import { config } from '../lib/config';
import dynamic from 'next/dynamic';
import Header from '../components/Header';

const Terminal = dynamic(() => import('../components/Terminal'), { ssr: false });

export default async function HomePage() {
  const session = await getSession();

  // Redirect to login if auth is enabled and user is not authenticated
  if (config.webAuth.enabled && !session.authenticated) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col h-screen bg-terminal-bg-primary">
      <Header />
      <main className="flex-1 p-4 overflow-hidden">
        <Terminal />
      </main>
      <footer className="bg-terminal-bg-secondary border-t border-terminal-border px-6 py-3">
        <div className="flex justify-center items-center text-sm text-terminal-text-secondary">
          <span>
            Press <kbd className="kbd">Ctrl+C</kbd> to interrupt |{' '}
            <kbd className="kbd">Ctrl+D</kbd> to exit
          </span>
        </div>
      </footer>
    </div>
  );
}
