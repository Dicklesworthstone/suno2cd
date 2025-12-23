import { defineConfig } from 'vite';

// Using a relative base makes the build work on GitHub Pages project sites:
// https://<username>.github.io/<repo>/
export default defineConfig({
  base: './',
});
