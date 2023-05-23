import { lazy, Suspense } from 'react';
import Dashboard from './pages/Dashboard';
import { useTheme } from './utils/useTheme';
import ServerWatchdog from './components/ServerWatchdog';

const MinecraftChrome = lazy(() => import('./MinecraftChrome'));

export default function App() {
  const theme = useTheme();
  const mc = theme === 'minecraft';

  return (
    <>
      <div className="app-bg" aria-hidden />
      {mc ? (
        <Suspense fallback={null}>
          <MinecraftChrome />
        </Suspense>
      ) : null}
      <ServerWatchdog />
      <div className="app-shell min-h-screen lg:h-screen lg:overflow-hidden">
        <Dashboard />
      </div>
    </>
  );
}
