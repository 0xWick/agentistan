# n8n for Render's free tier: the official image plus our four workflows. Webhooks only; the editor is switched off.
# Render builds this from n8n/ on every push that touches n8n/ (see render.yaml).
FROM docker.n8n.io/n8nio/n8n:2.40.7
COPY --chown=node:node workflows /home/node/app/workflows
COPY --chown=node:node start.sh /home/node/app/start.sh
ENV N8N_LISTEN_ADDRESS=0.0.0.0 N8N_PORT=5678 N8N_DISABLE_UI=true N8N_PROXY_HOPS=1 N8N_USER_FOLDER=/home/node
EXPOSE 5678
ENTRYPOINT ["/bin/sh", "/home/node/app/start.sh"]
