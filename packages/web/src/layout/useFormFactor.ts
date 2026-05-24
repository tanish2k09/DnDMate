import { useEffect, useState } from "react";

export type FormFactor = "compact" | "expanded";

/** Viewport width at and above which the three-column layout is used. */
const EXPANDED_MIN_WIDTH = 760;

function currentFormFactor(): FormFactor {
  return window.innerWidth >= EXPANDED_MIN_WIDTH ? "expanded" : "compact";
}

/** Track whether the viewport calls for the compact or the expanded layout. */
export function useFormFactor(): FormFactor {
  const [formFactor, setFormFactor] = useState<FormFactor>(currentFormFactor);

  useEffect(() => {
    const onResize = () => setFormFactor(currentFormFactor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return formFactor;
}
