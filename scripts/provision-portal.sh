#!/usr/bin/env bash
# scripts/provision-portal.sh
#
# One-time provisioning of the ab-health-portal Container App.
# Run this manually before the first CI/CD deploy.
#
# Prerequisites:
#   - az login
#   - Container App environment 'ab-health-mcp-env' exists in 'ab-health-mcp' resource group
#   - ACR 'abhealthmcpacr' exists
#   - Key Vault 'abhealthmcp-kv' has secrets: azure-openai-key-cae
#
# Usage: bash scripts/provision-portal.sh

set -euo pipefail

RG="ab-health-mcp"
ENV_NAME="ab-health-mcp-env"
APP_NAME="ab-health-portal"
ACR="abhealthmcpacr"
LOCATION="canadacentral"

echo "=== Provisioning portal Container App ==="

# Generate secrets if not provided
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
BETA_INVITE_SECRET="${BETA_INVITE_SECRET:-$(openssl rand -hex 32)}"
BETA_INVITE_ADMIN_KEY="${BETA_INVITE_ADMIN_KEY:-$(openssl rand -hex 16)}"

echo "Creating Container App: $APP_NAME"
az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --image "$ACR.azurecr.io/ab-health-portal:latest" \
  --registry-server "$ACR.azurecr.io" \
  --registry-identity system \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 1 \
  --memory 2Gi \
  --env-vars \
    "NODE_ENV=production" \
    "PORTAL_MODEL_MODE=beta-azure-ca" \
    "AZURE_AI_FOUNDRY_ENDPOINT=https://abhealthmcp-openai-cae.services.ai.azure.com" \
    "AZURE_OPENAI_DEPLOYMENT=gpt-4o" \
    "AZURE_OPENAI_API_VERSION=2024-12-01-preview" \
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-key-cae" \
    "AUTH_SECRET=$AUTH_SECRET" \
    "BETA_INVITE_SECRET=$BETA_INVITE_SECRET" \
    "BETA_INVITE_ADMIN_KEY=$BETA_INVITE_ADMIN_KEY" \
    "BETA_ALLOWED_EMAILS=${BETA_ALLOWED_EMAILS:-}" \
    "NEXT_PUBLIC_APP_URL=https://www.myaihealth.ca"

echo ""
echo "Enabling system-assigned managed identity..."
az containerapp identity assign \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --system-assigned

echo ""
echo "Granting Key Vault Secrets User role..."
PORTAL_IDENTITY=$(az containerapp identity show \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --query principalId -o tsv)

az role assignment create \
  --assignee "$PORTAL_IDENTITY" \
  --role "Key Vault Secrets User" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/abhealthmcp-kv"

echo ""
echo "=== Portal Container App provisioned ==="
echo ""
echo "FQDN: $(az containerapp show --name $APP_NAME --resource-group $RG --query 'properties.configuration.ingress.fqdn' -o tsv)"
echo ""
echo "Secrets (save these securely):"
echo "  AUTH_SECRET=$AUTH_SECRET"
echo "  BETA_INVITE_SECRET=$BETA_INVITE_SECRET"
echo "  BETA_INVITE_ADMIN_KEY=$BETA_INVITE_ADMIN_KEY"
echo ""
echo "Next steps:"
echo "  1. Add App Insights: az containerapp update --name $APP_NAME --resource-group $RG --set-env-vars APPLICATIONINSIGHTS_CONNECTION_STRING=<value>"
echo "  2. Configure custom domain (www.myaihealth.ca)"
echo "  3. Push to main to trigger CI/CD deploy"
