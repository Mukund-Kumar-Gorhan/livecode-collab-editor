# ==============================================================================
# Java Sandbox Image
# Security constraints to apply when running container:
#   docker run --rm -i \
#     --network=none \
#     --memory=256m \
#     --cpus=0.5 \
#     --pids-limit=64 \
#     --read-only \
#     --tmpfs /tmp:rw,noexec,nosuid,size=64m \
#     collab-sandbox-java
# ==============================================================================
FROM eclipse-temurin:17-jdk-alpine

# Create non-root sandbox user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox -h /home/sandbox

WORKDIR /sandbox
RUN chown -R sandbox:sandbox /sandbox

# Drop root privileges
USER sandbox

# Wrapper or runner can compile with javac and run with java
CMD ["java", "-version"]

