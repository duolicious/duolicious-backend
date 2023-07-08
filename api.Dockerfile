FROM python:latest

# Set working directory
WORKDIR /app

# Copy the build directory to the /app directory within the image
COPY . /app

# Install requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

ENV DUO_USE_VENV=false

# Start the /app/main.sh script when the container runs
CMD ["sh", "-c", "/app/main.sh"]
