"""Runtime configuration for the RepoMedic backend."""

# Server settings
BACKEND_HOST: str = "0.0.0.0"
BACKEND_PORT: int = 8000

# CORS — allow the Vite dev server origin
ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Persistence
DATA_DIR: str = "backend/data"
