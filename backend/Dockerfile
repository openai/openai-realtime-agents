# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be needed by Python packages
# Example: psycopg2 might need libpq-dev if not using the binary version
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     libpq-dev \
#  && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install Python dependencies
# --no-cache-dir: Disables the pip cache, reducing image size.
# --upgrade pip: Ensures pip is up-to-date.
RUN pip install --no-cache-dir --upgrade pip -r requirements.txt

# Copy the rest of the backend application code into the container at /app
# This includes all subdirectories like services, routers, models, etc.
COPY . .

# Expose the port the app runs on
# This should match the port Uvicorn is configured to use.
EXPOSE 8000

# Define the command to run the application
# Use 0.0.0.0 to make the server accessible externally (from outside the container).
# The --reload flag is typically for development; for production, you might remove it
# or control it via an environment variable (e.g., APP_ENV=development).
# For this Dockerfile, we'll include --reload for easier dev with docker-compose volume mounts.
# If you want a production-ready image, create a separate Dockerfile or use multi-stage builds
# to remove dev dependencies and disable reload.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```
