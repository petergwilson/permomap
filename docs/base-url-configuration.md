# Configurable Base URL Setup

The Permomap application now supports configurable base URLs for different deployment environments, allowing the same Docker containers to work for both local development and production deployments.

## Overview

The `base` property in the Vite configuration is now controlled by the `VITE_BASE_URL` environment variable, making it possible to:

- **Local Development**: Use `http://localhost:5173/` for the client
- **Production**: Use `https://www.wilsonenv.nz/permomap/` for hosted deployment
- **Custom Subdirectory**: Use any custom path like `/my-app/`

## Configuration Options

### 1. Local Development (Default)
```bash
# In .env file or environment
VITE_BASE_URL=/

# Or omit the variable entirely (defaults to "/")
```

### 2. Production Deployment
```bash
# In .env file or environment
VITE_BASE_URL=https://www.wilsonenv.nz/permomap/
```

### 3. Custom Subdirectory Deployment
```bash
# In .env file or environment
VITE_BASE_URL=/my-custom-path/
```

## Usage Examples

### Docker Compose with Environment Variables

Create a `.env` file in your project root:

```bash
# .env
FEATURE_SERVER_PORT=9000
DATABASE_NAME=permolatmap
VITE_BASE_URL=/
```

Then run:
```bash
npm start
```

### Production Build
```bash
# Set environment variable and build
export VITE_BASE_URL="https://www.wilsonenv.nz/permomap/"
docker compose build client

# Or pass directly to docker build
docker build -f Dockerfile.client -t my-client --build-arg VITE_BASE_URL="https://www.wilsonenv.nz/permomap/" .
```