/**
 * Type declarations for the bz2 module
 * This module provides bzip2 compression and decompression functionality
 */

declare module 'bz2' {
  interface BZ2 {
    /**
     * Decompress bzip2 compressed data
     * @param data - The compressed data as Uint8Array or Buffer
     * @returns The decompressed data as Uint8Array
     */
    decompress(data: Uint8Array | Buffer): Uint8Array;

    /**
     * Compress data to bzip2 format
     * @param data - The data to compress as Uint8Array or Buffer
     * @returns The compressed data as Uint8Array
     */
    compress(data: Uint8Array | Buffer): Uint8Array;
  }

  const bz2: BZ2;
  export default bz2;
}

