import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AGENTS, AgentId } from "@/types/ticket";

interface AgentState {
  current: AgentId;
  initialized: boolean;
}

const initialState: AgentState = {
  current: "agent-1",
  initialized: false,
};

export const agentSlice = createSlice({
  name: "agent",
  initialState,
  reducers: {
    setAgent(state, action: PayloadAction<AgentId>) {
      if (AGENTS.includes(action.payload)) {
        state.current = action.payload;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("support_agent_id", action.payload);
          } catch {
            // ignore localStorage errors
          }
        }
      }
    },
    hydrateAgent(state) {
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("support_agent_id") as AgentId;
          if (saved && AGENTS.includes(saved)) {
            state.current = saved;
          }
        } catch {
          // ignore
        }
      }
      state.initialized = true;
    },
  },
});

export const { setAgent, hydrateAgent } = agentSlice.actions;
export default agentSlice.reducer;
