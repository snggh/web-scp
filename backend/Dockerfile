# Development Dockerfile
FROM golang:1.23-alpine

WORKDIR /app

# Install git and other dependencies
RUN apk add --no-cache git

# Copy go mod file
COPY go.mod ./

# Copy the source code
COPY . .

# Install required dependencies
RUN go get github.com/gofiber/fiber/v2 && \
    go get github.com/joho/godotenv && \
    go mod tidy

# Expose port
EXPOSE 3000

# Run the application
CMD ["go", "run", "main.go"]