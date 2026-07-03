// Image-asset module declarations for the Node/main typecheck pass (tsconfig.node
// compiles src/data but, unlike the renderer pass, has no `vite/client` types).
// Vite resolves these imports to a hashed URL string at build time.
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}
