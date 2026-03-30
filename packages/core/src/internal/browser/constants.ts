import type { CompatModeId, OfficialProviderModeId } from './types.js';

export const DEFAULT_OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

export const DEFAULT_OAUTH_SCOPE = [
  'org:create_api_key',
  'user:profile',
  'user:inference',
  'user:sessions:claude_code',
  'user:mcp_servers',
  'user:file_upload',
] as const;

export const MANUAL_REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';

export const COMPAT_AUTHORIZE_ENDPOINTS: Readonly<Record<CompatModeId, string>> = {
  claudeai: 'https://claude.com/cai/oauth/authorize',
  console: 'https://platform.claude.com/oauth/authorize',
};

export const PROVIDER_DOCS_URLS: Readonly<Record<OfficialProviderModeId, string>> = {
  bedrock: 'https://docs.anthropic.com/en/api/claude-on-amazon-bedrock',
  vertex: 'https://docs.anthropic.com/en/api/claude-on-vertex-ai',
  foundry: 'https://learn.microsoft.com/en-us/azure/ai-foundry/',
};

export const PROVIDER_CREDENTIAL_HINTS: Readonly<Record<OfficialProviderModeId, string>> = {
  bedrock:
    'Configure AWS credentials and region, then pass a Bedrock credential adapter on the server.',
  vertex:
    'Configure Google Cloud credentials and project/location settings, then pass a Vertex credential adapter on the server.',
  foundry:
    'Configure Azure AI Foundry credentials and endpoint deployment settings, then pass a Foundry credential adapter on the server.',
};
