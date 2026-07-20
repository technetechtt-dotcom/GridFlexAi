declare module "@aws-sdk/client-kms" {
  export class KMSClient {
    constructor(config?: Record<string, unknown>);
    send(command: unknown): Promise<{ CiphertextBlob?: Uint8Array; Plaintext?: Uint8Array }>;
  }

  export class EncryptCommand {
    constructor(input: { KeyId: string; Plaintext: Buffer });
  }

  export class DecryptCommand {
    constructor(input: { CiphertextBlob: Buffer; KeyId?: string });
  }
}
