import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * JSON-RPC server error code for rate-limiting.
 * The MCP SDK does not expose a named constant for this case.
 */
const RATE_LIMITED_ERROR_CODE = -32002;

/**
 * Returns an MCP error indicating all providers are currently rate-limited.
 */
export function rateLimitedError(retryAfterSeconds: number): McpError {
  return new McpError(
    RATE_LIMITED_ERROR_CODE,
    `All providers rate-limited; retry after ${retryAfterSeconds} seconds`
  );
}

/**
 * Returns an MCP error for a provider authentication failure.
 */
export function providerAuthError(provider: string): McpError {
  return new McpError(
    ErrorCode.InternalError,
    `Provider authentication failed: ${provider}`
  );
}

/**
 * Returns an MCP error for a provider request timeout.
 */
export function providerTimeoutError(provider: string): McpError {
  return new McpError(
    ErrorCode.InternalError,
    `Provider timeout: ${provider}`
  );
}

/**
 * Returns an MCP error for invalid tool parameters.
 */
export function invalidParamsError(tool: string, detail: string): McpError {
  return new McpError(
    ErrorCode.InvalidParams,
    `Invalid request for tool ${tool}: ${detail}`
  );
}

/**
 * Returns a generic MCP error for a provider failure.
 */
export function providerError(provider: string, message: string): McpError {
  return new McpError(
    ErrorCode.InternalError,
    `Provider error (${provider}): ${message}`
  );
}
