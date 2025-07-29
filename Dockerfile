# Dockerfile

# Start with a standard Python 3.11 image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy ALL your application files first, including requirements.txt
# and the new vendor/ugly_midi directory.
COPY . .

# Now that all files are in place, install the dependencies.
# Pip will be able to find the local package.
RUN pip install --no-cache-dir -r requirements.txt

# Tell Fly.io the app listens on port 8080
EXPOSE 8080

# Command to run the application using the Gunicorn production server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]
