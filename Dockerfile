# Dockerfile

# Start with a standard Python 3.11 image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy ALL your application files, including requirements.txt and the
# midi_tools package (imported from the app directory, not pip-installed).
COPY . .

# Install the dependencies.
RUN pip install --no-cache-dir -r requirements.txt

# Tell Fly.io the app listens on port 8080
EXPOSE 8080

# Command to run the application using the Gunicorn production server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]
