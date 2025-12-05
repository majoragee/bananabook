# BananaBook - Docker Deployment Guide

## Quick Start

### Using Docker Compose (Recommended)

1. **Build and start the application:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the application:**
   ```bash
   docker-compose down
   ```

5. **Stop and remove data:**
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
