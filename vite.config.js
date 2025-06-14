    // vite.config.js
    import { defineConfig } from 'vite';

    export default defineConfig({
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