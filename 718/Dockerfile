# Dockerfile

# Start with a standard Python 3.11 image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code into the container
COPY . .

# Tell Fly.io the app listens on port 8080
EXPOSE 8080

# Command to run the application using the Gunicorn production server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]