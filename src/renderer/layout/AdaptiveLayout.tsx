import { useEffect, useState } from "react";
import { APP_NAME } from "../../shared";
import { DeviceStatusBadge } from "../components/DeviceStatusBadge";
import { PreviewPanel } from "../panels/PreviewPanel";
import { SetupPanel } from "../panels/SetupPanel";
import { useFormFactor } from "./useFormFactor";

type Tab = "live" | "setup";

const TABS: { id: Tab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "setup", label: "Setup" },
];

const SETUP_OPEN_KEY = "dndmate:setup-open";

/** Switches between the phone (tabbed) and desktop (collapsible-sidebar) layouts. */
export function AdaptiveLayout() {
  const formFactor = useFormFactor();
  return formFactor === "expanded" ? <ExpandedLayout /> : <CompactLayout />;
}

function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="app-header">
      <h1>{APP_NAME}</h1>
      <div className="app-header-actions">
        <DeviceStatusBadge />
        {children}
      </div>
    </header>
  );
}

function ExpandedLayout() {
  const [setupOpen, setSetupOpen] = useState(() => {
    try {
      return window.localStorage.getItem(SETUP_OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SETUP_OPEN_KEY, setupOpen ? "1" : "0");
    } catch {
      /* localStorage unavailable; just live with it */
    }
  }, [setupOpen]);

  return (
    <div className="layout layout-expanded">
      <Header>
        <button
          type="button"
          className={`button button-icon ${setupOpen ? "button-icon-active" : ""}`}
          aria-pressed={setupOpen}
          aria-label={setupOpen ? "Hide setup sidebar" : "Show setup sidebar"}
          title={setupOpen ? "Hide setup" : "Show setup"}
          onClick={() => setSetupOpen((v) => !v)}
        >
          {setupOpen ? "Hide setup ▸" : "◂ Setup"}
        </button>
      </Header>
      <div className="columns">
        <div className="column column-center">
          <PreviewPanel />
        </div>
        {setupOpen && (
          <div className="column column-sidebar">
            <SetupPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function CompactLayout() {
  const [tab, setTab] = useState<Tab>("live");

  return (
    <div className="layout layout-compact">
      <Header />
      <main className="compact-main">
        {tab === "live" && <PreviewPanel />}
        {tab === "setup" && <SetupPanel />}
      </main>
      <nav className="tab-bar">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`tab ${tab === entry.id ? "tab-active" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
