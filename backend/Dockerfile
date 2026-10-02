# ==============================================================================
# Build Stage: Compile Spring Boot Application
# ==============================================================================
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /build

# Copy Maven wrapper and POM first to leverage Docker layer caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline -B

# Copy application source code and package
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# ==============================================================================
# Runtime Stage: Minimal JRE Environment
# ==============================================================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built JAR from builder stage
COPY --from=builder /build/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-Djava.net.preferIPv4Stack=true", "-jar", "app.jar"]
