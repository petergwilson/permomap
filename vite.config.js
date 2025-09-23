    // vite.config.js
    import { defineConfig } from 'vite';

    export default defineConfig({
      define: {
        'import.meta.env.FEATURE_SERVER_PORT': JSON.stringify(process.env.FEATURE_SERVER_PORT || '9000'),
      },
      server: {
        proxy: {
          '/api/save': 'http://localhost:3000',
          '/api/rollback': 'http://localhost:3000',
          '/api/rollforward': 'http://localhost:3000',
          '/api/modify': 'http://localhost:3000',
          '/api/total_length': 'http://localhost:3000',
          '/api/login': 'http://localhost:3000',
          '/api/logout': 'http://localhost:3000',
          '/api/get_session': 'http://localhost:3000',
        },
      },
      base: "https://www.wilsonenv.nz/permomap/",
    });
