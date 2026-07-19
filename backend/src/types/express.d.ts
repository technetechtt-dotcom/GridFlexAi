declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
      name: string;
      role: string;
      tokenIssuedAt: number;
    };
    accessScope?: import("../middleware/permissions.js").AccessScope;
    edgeAuth?: {
      deviceId: string;
      credentialId?: string;
      keyVersion?: number;
      mode: "legacy_shared_secret" | "device_credential";
    };
  }
}
