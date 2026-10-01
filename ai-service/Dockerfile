# ==============================================================================
# FastAPI AI Orchestration Microservice Container
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install system audio libraries (libsndfile1 for soundfile/librosa, ffmpeg for WebM decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-cache NLTK data and SentenceTransformer model into the Docker image
# This ensures zero download latency on container startup
RUN python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('punkt_tab', quiet=True)" && \
    python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy application source code
COPY . .

# Default service port
ENV PORT=8000
EXPOSE 8000

# Run uvicorn bound to dynamic cloud PORT (defaults to 8000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
