export type OfficialProviderAdapterKind = 'console-api-key' | 'bedrock' | 'vertex' | 'foundry';

export interface OfficialAdapterEnvelope<TKind extends OfficialProviderAdapterKind, TCredentials> {
  readonly lane: 'official';
  readonly kind: TKind;
  readonly credentials: TCredentials;
}

export interface ConsoleApiKeyCredentials {
  readonly apiKey: string;
  readonly source: 'user-supplied';
}

export interface BedrockCredentials {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

export interface VertexCredentials {
  readonly projectId: string;
  readonly location: string;
  readonly serviceAccountJson: string;
}

export interface FoundryCredentials {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly deployment?: string;
  readonly apiVersion?: string;
}

export type ConsoleApiKeyAdapterResult = OfficialAdapterEnvelope<
  'console-api-key',
  ConsoleApiKeyCredentials
>;

export type BedrockAdapterResult = OfficialAdapterEnvelope<'bedrock', BedrockCredentials>;

export type VertexAdapterResult = OfficialAdapterEnvelope<'vertex', VertexCredentials>;

export type FoundryAdapterResult = OfficialAdapterEnvelope<'foundry', FoundryCredentials>;

export type OfficialProviderAdapterResult =
  | ConsoleApiKeyAdapterResult
  | BedrockAdapterResult
  | VertexAdapterResult
  | FoundryAdapterResult;

export interface ConsoleApiKeyAdapterInput {
  readonly apiKey: string;
}

export interface BedrockAdapterInput {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

export interface VertexAdapterInput {
  readonly projectId: string;
  readonly location: string;
  readonly serviceAccountJson: string;
}

export interface FoundryAdapterInput {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly deployment?: string;
  readonly apiVersion?: string;
}

export type OfficialProviderAdapterInput =
  | {
      readonly kind: 'console-api-key';
      readonly credentials: ConsoleApiKeyAdapterInput;
    }
  | {
      readonly kind: 'bedrock';
      readonly credentials: BedrockAdapterInput;
    }
  | {
      readonly kind: 'vertex';
      readonly credentials: VertexAdapterInput;
    }
  | {
      readonly kind: 'foundry';
      readonly credentials: FoundryAdapterInput;
    };
