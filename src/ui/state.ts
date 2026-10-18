export type AppState = {
    splatSize: number;
    opacity: number;
    additive: boolean;
    debugMode: number; // u_debug_mode; 0 = plain (regular view)
  };
  
  export const state: AppState = {
    splatSize: 2.0,
    opacity: 1.0,
    additive: false,
    debugMode: 0,
  };