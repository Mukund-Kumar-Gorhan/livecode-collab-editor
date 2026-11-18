# ==============================================================================
# Python Sandbox Image
# Security constraints to apply when running container:
#   docker run --rm -i \
#     --network=none \
#     --memory=128m \
#     --cpus=0.5 \
#     --pids-limit=64 \
#     --read-only \
#     --tmpfs /tmp:rw,noexec,nosuid,size=32m \
#     collab-sandbox-python
# ==============================================================================
FROM python:3.11-slim

# Create isolated non-root user
RUN groupadd -r sandbox && useradd -r -g sandbox -m -d /home/sandbox -s /bin/bash sandbox

WORKDIR /sandbox
RUN chown -R sandbox:sandbox /sandbox

# Drop privileges
USER sandbox

# Default entrypoint for script execution
CMD ["python3"]

