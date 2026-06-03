import { Outlet, createRootRouteWithContext, Link } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/mobile/BottomNav";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorScreen,
});

function RootComponent() {
  return (
    <div className="relative h-full bg-background text-foreground">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-5xl">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cet écran n'existe pas.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Accueil
        </Link>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-3xl">Oups</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => location.reload()}
          className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Recharger
        </button>
      </div>
    </div>
  );
}
