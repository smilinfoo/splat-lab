export type AppState = {
    splatSize: number;
    opacity: number;
    additive: boolean;
  };
  
  export const state: AppState = {
    splatSize: 0.01,
    opacity: 1.0,
    additive: false,
  };