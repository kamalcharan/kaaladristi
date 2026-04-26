FROM python:3.11-slim

# Build tools needed for pyswisseph (C extension)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache — only rebuilds if requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Persist downloaded bhav copies across restarts
VOLUME ["/app/data"]

EXPOSE 8101

CMD ["uvicorn", "pipeline2_api:app", "--host", "0.0.0.0", "--port", "8101", "--workers", "1"]
