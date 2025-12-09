# Docker Usage

## Building and Running

### Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Using Docker directly

```bash
# Build the image
docker build -t lyrica .

# Run the container
docker run -d \
  -p 1027:1027 \
  --env-file .env \
  --name lyrica \
  lyrica

# View logs
docker logs -f lyrica

# Stop and remove
docker stop lyrica
docker rm lyrica
```

## Configuration

Make sure your `.env` file has the correct settings:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:1027/callback
PORT=1027
NODE_ENV=production
```

**Important**: Update your Spotify app redirect URI to `http://localhost:1027/callback` in the Spotify Developer Dashboard.

## Access

Once running, access the app at: `http://localhost:1027`
