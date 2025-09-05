# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip -r requirements.txt

# Copy the rest of the mock_a2a_server application code into the container at /app
COPY . .

# Expose the port the app runs on (default for this mock server is 8001)
EXPOSE 8001

# Define the command to run the application
# Use 0.0.0.0 to make the server accessible externally.
# --reload is included for consistency with the backend service's Dockerfile for dev.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
```
