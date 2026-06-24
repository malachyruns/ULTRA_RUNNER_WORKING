import { createContext, useContext, ReactNode, useEffect } from "react";
import { usePortalMe, getPortalMeQueryKey } from "@workspace/api-client-react";
import type { OrganizerProfile } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface PortalAuthContextType {
  organizer: OrganizerProfile | null;
  isLoading: boolean;
}

const PortalAuthContext = createContext<PortalAuthContextType>({ organizer: null, isLoading: true });

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const { data: organizer, isLoading } = usePortalMe({
    query: {
      retry: false,
      queryKey: getPortalMeQueryKey(),
    }
  });

  return (
    <PortalAuthContext.Provider value={{ organizer: organizer || null, isLoading }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { organizer, isLoading } = usePortalAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !organizer) {
      setLocation("/portal/login");
    }
  }, [isLoading, organizer, setLocation]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!organizer) {
    return null;
  }

  return <>{children}</>;
}
