# ==============================================================================
# C++ Sandbox Image
# Security constraints to apply when running container:
#   docker run --rm -i \
#     --network=none \
#     --memory=128m \
#     --cpus=0.5 \
#     --pids-limit=64 \
#     --read-only \
#     --tmpfs /tmp:rw,noexec,nosuid,size=32m \
#     collab-sandbox-cpp
# ==============================================================================
FROM alpine:3.19

# Install g++ compiler and standard build tools
RUN apk add --no-cache g++ libstdc++ libc-dev

# Create non-root sandbox user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox -h /home/sandbox

WORKDIR /sandbox
RUN chown -R sandbox:sandbox /sandbox

# Drop root privileges
USER sandbox

CMD ["g++", "--version"]

