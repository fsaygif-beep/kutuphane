declare module "cloudflare:workers" {
  export const env: {
    DB: import("@cloudflare/workers-types").D1Database;
    BUCKET: {
      get(key:string):Promise<{body:ReadableStream<Uint8Array>;httpMetadata?:{contentType?:string}}|null>;
      put(key:string,body:ReadableStream<Uint8Array>,options?:{httpMetadata?:{contentType:string}}):Promise<unknown>;
      delete(key:string):Promise<void>;
    };
    RESEND_API_KEY?: string;
    INITIAL_ADMIN_SETUP_CODE?: string;
  };
}
