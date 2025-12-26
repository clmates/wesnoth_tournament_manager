/**
 * TypeScript type declarations for bz2 module
 */

declare module 'bz2' {
  export function decompress(data: Buffer | Uint8Array | ArrayBuffer): Buffer;
  export function compress(data: Buffer | Uint8Array | ArrayBuffer): Buffer;
}
