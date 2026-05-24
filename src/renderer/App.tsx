import { AdaptiveLayout } from "./layout/AdaptiveLayout";
import { AppProvider } from "./store/app-context";

export function App() {
  return (
    <AppProvider>
      <AdaptiveLayout />
    </AppProvider>
  );
}
