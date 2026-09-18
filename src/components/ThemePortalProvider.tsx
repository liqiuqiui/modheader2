import React, { createContext, useCallback, useContext, useState } from "react";

const ThemePortalContainerContext = createContext<HTMLElement | null>(null);

export function ThemePortalProvider({
  themeColor,
  children,
}: {
  themeColor: string;
  children: React.ReactNode;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const handlePortalContainerRef = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node);
  }, []);

  return (
    <ThemePortalContainerContext.Provider value={portalContainer}>
      {children}
      <div
        ref={handlePortalContainerRef}
        data-theme-portal-root=""
        style={{ "--theme-color": themeColor } as React.CSSProperties}
      />
    </ThemePortalContainerContext.Provider>
  );
}

export function useThemePortalContainer() {
  return useContext(ThemePortalContainerContext);
}
