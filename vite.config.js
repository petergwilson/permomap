    // vite.config.js
    import { defineConfig } from 'vite';

    export default defineConfig({
      define: {
        'import.meta.env.FEATURE_SERVER_PORT': JSON.stringify(process.env.FEATURE_SERVER_PORT || '9000'),
      },
      server: {
        proxy: {
          '/api/save': 'http://permomap.wilsonenv.nz:3000',
          '/api/rollback': 'http://permomap.wilsonenv.nz:3000',
          '/api/rollforward': 'http://permomap.wilsonenv.nz:3000',
          '/api/modify': 'http://permomap.wilsonenv.nz:3000',
          '/api/total_length': 'http://permomap.wilsonenv.nz:3000',
          '/api/track-versions': 'http://permomap.wilsonenv.nz:3000',
          '/api/moderate': 'http://permomap.wilsonenv.nz:3000',
          '/api/review': 'http://permomap.wilsonenv.nz:3000',
          '/api/login': 'http://permomap.wilsonenv.nz:3000',
          '/api/logout': 'http://permomap.wilsonenv.nz:3000',
          '/api/get_session': 'http://permomap.wilsonenv.nz:3000',
          '/api/login': 'http://permomap.wilsonenv.nz:3000',
          '/api/logout': 'http://permomap.wilsonenv.nz:3000',
          '/api/get_session': 'http://permomap.wilsonenv.nz:3000',
          '/permomap/collections': {
            target: 'http://permomap.wilsonenv.nz:9000',
            changeOrigin: true,
        rewrite: (path) => path.replace(/^\/permomap/, ''),
          },
        },
      },
      base: process.env.VITE_BASE_URL || "/permomap/",
    });
