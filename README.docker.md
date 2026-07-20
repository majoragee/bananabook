# BananaBook - Docker Deployment Guide

> **Security first:** BananaBook has no authentication. Publish these ports to a
> trusted LAN or localhost only, never to the public internet. See the
> [threat model](README.md#security-and-threat-model).

## Using the prebuilt image (no build required)

Images are published to GitHub Container Registry for `linux/amd64` and
`linux/arm64` on every release:

```bash
docker pull ghcr.io/majoragee/bananabook:latest

docker run -d \
  --name bananabook \
  -p 3000:3000 -p 3001:3001 \
  -v bananabook-data:/app/data \
  --restart unless-stopped \
  ghcr.io/majoragee/bananabook:latest
```

| Tag | What it points at |
|-----|-------------------|
| `latest` | The most recent tagged release |
| `0.1.0`, `0.1` | A specific version, and the latest patch in that minor line |
| `main` | The tip of the default branch — moves, may break |
| `sha-<commit>` | One exact commit, never reused |

To upgrade: `docker pull …:latest`, then recreate the container. **Back up the
database first** — the schema is auto-synchronized on boot (see the README's known
limitations).

## Quick Start (building from source)

### Using Docker Compose (Recommended)

1. **Copy the example docker-compose file:**
   ```bash
   cp docker-compose.yml.example docker-compose.yml
   ```

2. **Build and start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

4. **View logs:**
   ```bash
   docker-compose logs -f
   ```

5. **Stop the application:**
   ```bash
   docker-compose down
   ```

6. **Stop and remove data:**
   ```bash
   docker-compose down -v
   ```

### Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t bananabook .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name bananabook \
     -p 3000:3000 \
     -p 3001:3001 \
     -v bananabook-data:/app/data \
     -e NODE_ENV=production \
     -e DATA_DIR=/app/data \
     bananabook
   ```

3. **Stop the container:**
   ```bash
   docker stop bananabook
   docker rm bananabook
   ```

## Configuration

### Environment Variables

- `NODE_ENV`: Set to `production` for production deployment
- `DATA_DIR`: Directory where the SQLite database will be stored (default: `/app/data`)

### Ports

- `3000`: Next.js frontend application
- `3001`: Express backend API

### Data Persistence

The SQLite database is stored in a Docker volume (`bananabook-data`) to persist data across container restarts.

## Customization

### Custom Ports

To use different ports, modify the `docker-compose.yml` file:

```yaml
ports:
  - "8080:3000"  # Map host port 8080 to container port 3000
  - "8081:3001"  # Map host port 8081 to container port 3001
```

### Database Backup

To backup your database:

```bash
docker cp bananabook:/app/data/bananabook.db ./backup-bananabook.db
```

To restore from backup:

```bash
docker cp ./backup-bananabook.db bananabook:/app/data/bananabook.db
docker-compose restart
```

## Troubleshooting

### View container logs
```bash
docker-compose logs -f bananabook
```

### Access container shell
```bash
docker-compose exec bananabook sh
```

### Check container status
```bash
docker-compose ps
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```
