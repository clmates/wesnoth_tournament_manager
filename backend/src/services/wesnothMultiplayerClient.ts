import * as net from 'net';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Wesnoth Multiplayer Client
 * Implements the WML protocol to connect to Wesnoth server
 * and validate credentials
 */

interface WMLNode {
  [key: string]: string | WMLNode | WMLNode[];
}

interface WMLDocument {
  [tagName: string]: WMLNode | WMLNode[];
}

/**
 * Simple WML text parser
 * Converts WML text to object structure
 */
function parseWMLText(text: string): WMLDocument {
  const lines = text.trim().split('\n');
  const root: WMLDocument = {};
  const stack: any[] = [root];
  let currentTag: any = root;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Closing tag
    if (trimmed.startsWith('[/')) {
      stack.pop();
      if (stack.length > 0) {
        currentTag = stack[stack.length - 1];
      }
      continue;
    }

    // Opening tag
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const tagName = trimmed.slice(1, -1);
      const newNode: WMLNode = {};

      if (currentTag[tagName]) {
        if (!Array.isArray(currentTag[tagName])) {
          currentTag[tagName] = [currentTag[tagName]];
        }
        (currentTag[tagName] as WMLNode[]).push(newNode);
      } else {
        currentTag[tagName] = newNode;
      }

      stack.push(newNode);
      currentTag = newNode;
      continue;
    }

    // Attribute line (key=value)
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      currentTag[key] = value;
    }
  }

  return root;
}

/**
 * Simple WML text formatter
 * Converts object structure to WML text
 */
function formatWMLText(doc: WMLDocument, depth: number = 0): string {
  let result = '';
  const indent = '    '.repeat(depth);

  for (const [key, value] of Object.entries(doc)) {
    if (Array.isArray(value)) {
      // Array of nodes
      for (const item of value) {
        if (typeof item === 'object') {
          result += `${indent}[${key}]\n`;
          result += formatWMLText(item as WMLDocument, depth + 1);
          result += `${indent}[/${key}]\n`;
        }
      }
    } else if (typeof value === 'object') {
      // Single node
      result += `${indent}[${key}]\n`;
      result += formatWMLText(value as WMLDocument, depth + 1);
      result += `${indent}[/${key}]\n`;
    } else {
      // Attribute
      result += `${indent}${key}="${value}"\n`;
    }
  }

  return result;
}

/**
 * Wesnoth network client
 * Handles connection, handshake, and message exchange
 */
export class WesnothMultiplayerClient {
  private socket: net.Socket | null = null;
  private host: string;
  private port: number;

  constructor(host: string = 'server.wesnoth.org', port: number = 15000) {
    this.host = host;
    this.port = port;
  }

  /**
   * Connect to Wesnoth server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port });

      this.socket.on('connect', () => {
        console.log(`Connected to ${this.host}:${this.port}`);
        // Send initial handshake (protocol version 0)
        const handshake = Buffer.alloc(4);
        handshake.writeUInt32BE(0, 0);
        this.socket!.write(handshake);

        // Wait for server handshake response
        this.socket!.once('data', (data) => {
          console.log(`Received handshake response: ${data.readUInt32BE(0)}`);
          resolve();
        });
      });

      this.socket.on('error', (error) => {
        reject(new Error(`Connection error: ${error.message}`));
      });

      this.socket.on('close', () => {
        console.log('Connection closed');
      });
    });
  }

  /**
   * Send WML message to server
   */
  async sendMessage(wmlDoc: WMLDocument): Promise<void> {
    if (!this.socket || !this.socket.writable) {
      throw new Error('Socket is not connected or writable');
    }

    // Format WML text
    const wmlText = formatWMLText(wmlDoc);
    console.log('Sending WML:', wmlText);

    // Convert to buffer and add null terminator
    const textBuffer = Buffer.from(wmlText + '\0', 'utf-8');

    // Compress with gzip
    const compressed = await gzip(textBuffer);

    // Create message with size header
    const message = Buffer.alloc(4 + compressed.length);
    message.writeUInt32BE(compressed.length, 0);
    compressed.copy(message, 4);

    // Send message
    return new Promise((resolve, reject) => {
      this.socket!.write(message, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Receive WML message from server
   */
  async receiveMessage(): Promise<WMLDocument> {
    if (!this.socket) {
      throw new Error('Socket is not connected');
    }

    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      let expectedSize: number | null = null;

      const onData = (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        // If we don't know the message size yet, read it from first 4 bytes
        if (expectedSize === null && buffer.length >= 4) {
          expectedSize = buffer.readUInt32BE(0);
        }

        // If we have the complete message
        if (expectedSize !== null && buffer.length >= 4 + expectedSize) {
          // Remove listener
          this.socket!.removeListener('data', onData);
          this.socket!.removeListener('error', onError);

          // Extract message data (skip 4-byte header)
          const compressedData = buffer.slice(4, 4 + expectedSize);

          handleMessage(compressedData);
        }
      };

      const onError = (error: Error) => {
        this.socket!.removeListener('data', onData);
        reject(new Error(`Socket error while receiving: ${error.message}`));
      };

      const handleMessage = async (compressedData: Buffer) => {
        try {
          // Decompress
          const decompressed = await gunzip(compressedData);

          // Remove null terminator
          let text = decompressed.toString('utf-8').trim();
          if (text.endsWith('\0')) {
            text = text.slice(0, -1);
          }

          console.log('Received WML:', text);

          // Parse WML
          const doc = parseWMLText(text);
          resolve(doc);
        } catch (error) {
          reject(new Error(`Failed to decompress message: ${error}`));
        }
      };

      this.socket!.on('data', onData);
      this.socket!.on('error', onError);
    });
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

/**
 * Validate username and password against Wesnoth server
 * Returns {valid: boolean, username: string, message?: string}
 */
export async function validateWesnothCredentials(
  username: string,
  password: string,
  timeout: number = 10000
): Promise<{ valid: boolean; error?: string }> {
  const client = new WesnothMultiplayerClient();

  try {
    // Connect to Wesnoth server
    await client.connect();

    // Set timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeout);
    });

    // Receive version request
    const versionRequest = await Promise.race([
      client.receiveMessage(),
      timeoutPromise,
    ]);

    console.log('Version request received:', versionRequest);

    // Send version response
    const versionResponse: WMLDocument = {
      version: {
        version: '1.17.0',
        client_source: 'wesnoth',
      },
    };

    await client.sendMessage(versionResponse);

    // Receive mustlogin message
    const mustlogin = await Promise.race([
      client.receiveMessage(),
      timeoutPromise,
    ]);

    console.log('Must login received:', mustlogin);

    // Send login
    const loginMessage: WMLDocument = {
      login: {
        username: username,
        password: password,
      },
    };

    await client.sendMessage(loginMessage);

    // Wait for response (could be error, warning, or join_lobby)
    const response = await Promise.race([
      client.receiveMessage(),
      timeoutPromise,
    ]);

    console.log('Login response:', response);

    // Check if there's an error
    if (response.error) {
      const errorData = response.error;
      const errorMessage =
        typeof errorData === 'object'
          ? (errorData as any).message || 'Authentication failed'
          : 'Authentication failed';

      return {
        valid: false,
        error: errorMessage,
      };
    }

    // Check if login was successful (should receive join_lobby)
    if (response.join_lobby) {
      return {
        valid: true,
      };
    }

    // If there's a warning but no error, authentication might still be successful
    if (response.warning) {
      const warningData = response.warning;
      const warningCode =
        typeof warningData === 'object'
          ? (warningData as any).warning_code
          : null;

      // Some warnings are not fatal
      if (
        warningCode &&
        ![
          '105', // MP_NAME_UNREGISTERED_ERROR
          '106', // MP_NAME_INACTIVE_WARNING
        ].includes(warningCode)
      ) {
        // For other warnings, credentials were still validated
        return {
          valid: true,
        };
      }

      return {
        valid: false,
        error:
          typeof warningData === 'object'
            ? (warningData as any).message || 'Authentication warning'
            : 'Authentication warning',
      };
    }

    // If we get here, something unexpected happened
    return {
      valid: false,
      error: 'Unexpected server response',
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      valid: false,
      error: (error as Error).message,
    };
  } finally {
    client.close();
  }
}
