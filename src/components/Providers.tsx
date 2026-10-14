"use client";

import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { hydrateAgent } from "@/store/agentSlice";

function HydrateAgent() {
  useEffect(() => {
    store.dispatch(hydrateAgent());
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <HydrateAgent />
      {children}
    </Provider>
  );
}
