import { useState } from "react";
import { APP_NAME } from "../../shared";
import { DeviceStatusBadge } from "../components/DeviceStatusBadge";
import { PreviewPanel } from "../panels/PreviewPanel";
import { RosterPanel } from "../panels/RosterPanel";
import { SetupPanel } from "../panels/SetupPanel";
import { useFormFactor } from "./useFormFactor";

type Tab = "roster" | "live" | "setup";

const TABS: { id: Tab; label: string }[] = [
  { id: "roster", label: "Roster" },
  { id: "live", label: "Live" },
  { id: "setup", label: "Setup" },
];

/** Switches between the phone (tabbed) and desktop (three-column) layouts. */
export function AdaptiveLayout() {
  const formFactor = useFormFactor();
  return formFactor === "expanded" ? <ExpandedLayout /> : <CompactLayout />;
}

function Header() {
  return (
    <header className="app-header">
      <h1>{APP_NAME}</h1>
      <DeviceStatusBadge />
    </header>
  );
}

function ExpandedLayout() {
  return (
    <div className="layout layout-expanded">
      <Header />
      <div className="columns">
        <div className="column">
          <RosterPanel />
        </div>
        <div className="column column-center">
          <PreviewPanel />
        </div>
        <div className="column">
          <SetupPanel />
        </div>
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
        {tab === "roster" && <RosterPanel />}
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
