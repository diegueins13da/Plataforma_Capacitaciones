import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";

interface BrandingConfig {
  SYSTEM_NAME: string;
  COMPANY_NAME: string;
  LOGO_URL: string;
  PRIMARY_COLOR: string;
  FAVICON_URL: string;
}

const DEFAULTS: BrandingConfig = {
  SYSTEM_NAME: "LMS Corporativo",
  COMPANY_NAME: "Mi Empresa",
  LOGO_URL: "",
  PRIMARY_COLOR: "#4f46e5",
  FAVICON_URL: "",
};

const BrandingContext = createContext<BrandingConfig>(DEFAULTS);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULTS);

  useEffect(() => {
    axios
      .get<BrandingConfig>("/api/v1/config/public/")
      .then((res) => {
        const data = { ...DEFAULTS, ...res.data };
        setBranding(data);
        // Apply primary color as CSS variable globally
        document.documentElement.style.setProperty("--brand-primary", data.PRIMARY_COLOR);
        // Update page title
        if (data.SYSTEM_NAME) document.title = data.SYSTEM_NAME;
        // Update favicon if provided
        if (data.FAVICON_URL) {
          const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (link) link.href = data.FAVICON_URL;
        }
      })
      .catch(() => {
        // Non-critical — use defaults silently
      });
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
