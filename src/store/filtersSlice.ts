import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FiltersState {
  q: string;
  status: string;
  priority: string;
  category: string;
}

const initialState: FiltersState = {
  q: "",
  status: "all",
  priority: "all",
  category: "all",
};

export const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.q = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<string>) {
      state.status = action.payload;
    },
    setPriorityFilter(state, action: PayloadAction<string>) {
      state.priority = action.payload;
    },
    setCategoryFilter(state, action: PayloadAction<string>) {
      state.category = action.payload;
    },
    syncFromUrl(state, action: PayloadAction<Partial<FiltersState>>) {
      if (action.payload.q !== undefined) state.q = action.payload.q;
      if (action.payload.status !== undefined) state.status = action.payload.status;
      if (action.payload.priority !== undefined) state.priority = action.payload.priority;
      if (action.payload.category !== undefined) state.category = action.payload.category;
    },
    resetFilters(state) {
      state.q = "";
      state.status = "all";
      state.priority = "all";
      state.category = "all";
    },
  },
});

export const {
  setQuery,
  setStatusFilter,
  setPriorityFilter,
  setCategoryFilter,
  syncFromUrl,
  resetFilters,
} = filtersSlice.actions;

export default filtersSlice.reducer;
