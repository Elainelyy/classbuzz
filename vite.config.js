import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    // Copy the worker file from the resolved pdfjs-dist build path
                    src: path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'),
                    // src: path.join(pdfjsDistBuildPath, 'pdf.worker.min.js'),
                    // Place it directly in the root of the 'dist' folder
                    dest: '.'
                }
            ]
        })
    ],
    build: {
        outDir: 'dist' // Specify the output directory for the build
    }
});
