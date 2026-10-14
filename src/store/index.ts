import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import ticketsReducer from "./ticketsSlice";
import filtersReducer from "./filtersSlice";
import agentReducer from "./agentSlice";

export const store = configureStore({
  reducer: {
    tickets: ticketsReducer,
    filters: filtersReducer,
    agent: agentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
