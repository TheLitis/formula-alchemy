import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
    // Relative URLs work at /, /formula-alchemy/, and after renaming the repository.
    // There is no history router, so nested-route fallbacks are unnecessary.
    base: './',
    plugins: [react()],
    build: {
        target: 'es2022',
        rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'], math: ['katex'], physics: ['matter-js'] } } },
    },
    test: { include: ['tests/**/*.test.ts'], environment: 'node', coverage: { include: ['src/core/**', 'src/physics/**'] } },
});
