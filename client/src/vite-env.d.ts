/// <reference types="vite/client" />

// Allow importing audio assets
declare module '*.mpeg' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // add more VITE_* vars here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
