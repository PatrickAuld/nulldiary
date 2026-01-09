import type { Env } from './types';
import { handleSubmit, handleOptions } from './handlers/submit';

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'aipostsecret-api',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Submission endpoints
    // /s - query params or body
    // /s/{message} - message in path
    if (url.pathname === '/s' || url.pathname.startsWith('/s/')) {
      if (request.method === 'GET' || request.method === 'POST') {
        return handleSubmit(request, env);
      }

      return new Response(
        JSON.stringify({ status: 'error', reason: 'method_not_allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            Allow: 'GET, POST, OPTIONS',
          },
        }
      );
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ status: 'error', reason: 'not_found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  },
};
