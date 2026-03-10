FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application code
COPY . .

# Railway sets PORT env var automatically
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
