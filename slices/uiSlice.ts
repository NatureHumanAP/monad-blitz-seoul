import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type Toast = {
  id?: string;
  message: string;
  type?: "info" | "success" | "error";
};

type UIState = {
  toasts: Toast[];
  loadingMessage?: string;
};

const initialState: UIState = {
  toasts: [],
  loadingMessage: undefined,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    pushToast: (state, action: PayloadAction<Toast>) => {
      const id =
        action.payload.id ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString());
      state.toasts.push({ ...action.payload, id });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<string | undefined>) => {
      state.loadingMessage = action.payload;
    },
  },
});

export const { pushToast, removeToast, setLoading } = uiSlice.actions;
export default uiSlice.reducer;
