# ==============================================================================
# Node.js Sandbox Image
# Security constraints to apply when running container:
#   docker run --rm -i \
#     --network=none \
#     --memory=128m \
#     --cpus=0.5 \
#     --pids-limit=64 \
#     --read-only \
#     --tmpfs /tmp:rw,noexec,nosuid,size=32m \
#     collab-sandbox-node
# ==============================================================================
FROM node:20-alpine

# Set working directory & assign to existing node non-root user
WORKDIR /sandbox
RUN chown -R node:node /sandbox

# Drop root privileges (built-in alpine 'node' user)
USER node

CMD ["node"]

