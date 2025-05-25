# Supabase Edge Function for Supabase JWT Authentication

This document outlines the setup and functionality of a Supabase Edge Function (`auth-gateway`) designed to handle user authentication using Supabase Auth JWTs before requests reach the FastAPI backend. This replaces the previous API key-based authentication mechanism.

## Overview

The primary goal is to leverage Supabase's built-in authentication to secure the backend service. The Edge Function acts as an authentication gateway.

## Authentication Flow

1.  **Client Authentication with Supabase Auth:**
    *   The client application (e.g., a frontend UI, not part of this backend repository) authenticates the user via Supabase Auth (e.g., using email/password, OAuth providers, etc.).
    *   Upon successful authentication, the client receives a Supabase JWT (JSON Web Token).

2.  **Client Request to Edge Function:**
    *   The client sends its requests to the designated Supabase Edge Function URL (e.g., `/functions/v1/auth-gateway/...`).
    *   The request **must** include the Supabase JWT in the `Authorization` header using the Bearer scheme:
        `Authorization: Bearer <supabase_jwt>`

3.  **Edge Function JWT Validation:**
    *   The `auth-gateway` Edge Function intercepts this request.
    *   It extracts the JWT from the `Authorization` header.
    *   It uses Supabase's libraries or context to verify the JWT's signature and validity (e.g., checking against Supabase's JWKS, expiration, issuer).

4.  **Request Forwarding (if JWT is valid):**
    *   If the JWT is valid, the Edge Function extracts user information from the token's payload (e.g., user ID, email, role).
    *   It then modifies the request:
        *   Removes the original `Authorization` header (as the JWT has served its purpose for this hop).
        *   Adds new headers containing validated user information:
            *   `X-Supabase-User-ID: <user_id_from_jwt>`
            *   `X-Supabase-User-Email: <user_email_from_jwt>` (if available in JWT)
            *   `X-Supabase-User-Role: <user_role_from_jwt>` (if available in JWT and configured in Supabase Auth)
    *   The modified request is then forwarded to the FastAPI backend (configured as the "Origin URL" for this Edge Function).

5.  **Error Response (if JWT is invalid or missing):**
    *   If the JWT is invalid, expired, or missing, the Edge Function immediately returns an HTTP `401 Unauthorized` error response directly to the client. The request does not reach the FastAPI backend.

6.  **FastAPI Backend Trust:**
    *   The FastAPI backend is configured to trust requests that include the `X-Supabase-User-ID` header (and optionally other `X-Supabase-*` headers).
    *   It assumes that the presence of these headers means the user has been successfully authenticated by the trusted Supabase Edge Function gateway.

## Supabase Edge Function Setup

### 1. Install/Update Supabase CLI & Link Project
(As described in previous versions of this document)

### 2. Create/Update the Edge Function
If you had a previous `api-key-authenticator` function, you can rename or replace it. Let's assume the function is named `auth-gateway`.
```bash
# If creating new:
# npx supabase functions new auth-gateway
# If updating, modify existing files in supabase/functions/auth-gateway/
```
This will create/use the directory: `supabase/functions/auth-gateway/index.ts`.

### 3. Edge Function Code (`supabase/functions/auth-gateway/index.ts`)

```typescript
// supabase/functions/auth-gateway/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// URL of your FastAPI backend
const FASTAPI_ORIGIN_URL = Deno.env.get("FASTAPI_ORIGIN_URL") || "http://localhost:8000"; // Example

// Headers to pass user info to the backend
const HEADER_USER_ID = "x-supabase-user-id";
const HEADER_USER_EMAIL = "x-supabase-user-email";
const HEADER_USER_ROLE = "x-supabase-user-role"; // Example, depends on your JWT claims

console.log("Edge Function 'auth-gateway' initializing...");
console.log(`FastAPI Origin URL: ${FASTAPI_ORIGIN_URL}`);


serve(async (req: Request) => {
  const requestPath = new URL(req.url).pathname;
  console.log(`Request received for: ${requestPath}`);

  // --- JWT Validation ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("Auth failed: Missing or invalid Authorization Bearer header.");
    return new Response("Missing or invalid Authorization header.", { status: 401 });
  }

  const supabaseToken = authHeader.replace("Bearer ", "");

  // To verify the JWT, the Edge Function needs access to Supabase project URL and anon key
  // if it's creating its own Supabase client instance for JWT validation.
  // These should be set as environment variables in your Supabase project settings for the function.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("CRITICAL: SUPABASE_URL or SUPABASE_ANON_KEY is not set in Edge Function environment.");
    return new Response("Internal Server Error: Auth configuration missing in gateway.", { status: 500 });
  }
  
  let userId = null;
  let userEmail = null;
  let userRole = null; // Default to null

  try {
    // Create a Supabase client to verify the JWT and get user details
    // Note: In some Deno environments or Supabase Function contexts,
    // user might be available directly from the request context if Supabase handles JWT verification upstream.
    // This example explicitly creates a client for validation.
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);

    if (error) {
      console.warn(`JWT validation error: ${error.message}`);
      return new Response(`Unauthorized: ${error.message}`, { status: 401 });
    }
    if (!user) {
      console.warn("JWT validation failed: No user found for token.");
      return new Response("Unauthorized: Invalid token.", { status: 401 });
    }

    // Successfully validated JWT and retrieved user
    userId = user.id;
    userEmail = user.email;
    userRole = user.role || "authenticated"; // Default role or from user.role if set

    console.log(`JWT validated for user ID: ${userId}, Email: ${userEmail}, Role: ${userRole}`);

  } catch (e) {
    console.error("Exception during JWT validation:", e);
    return new Response("Internal Server Error during authentication.", { status: 500 });
  }

  // --- Forward Request to FastAPI Backend ---
  const headers = new Headers(req.headers); // Clone original headers
  headers.delete("Authorization"); // Remove original Authorization header

  // Add validated user information
  if (userId) headers.set(HEADER_USER_ID, userId);
  if (userEmail) headers.set(HEADER_USER_EMAIL, userEmail);
  if (userRole) headers.set(HEADER_USER_ROLE, userRole);
  
  // Ensure the Host header is appropriate for the origin if not already set by fetch
  // headers.set("Host", new URL(FASTAPI_ORIGIN_URL).host);


  const url = new URL(req.url);
  // Ensure the pathname from the original request to the Edge Function is appended
  // e.g., if Edge Function is at /functions/v1/auth-gateway
  // and client calls /functions/v1/auth-gateway/ag-ui/events
  // then url.pathname will be /functions/v1/auth-gateway/ag-ui/events.
  // We need to strip the function's base path if FASTAPI_ORIGIN_URL is just the base of the backend.
  // A common pattern is that the Edge Function path matches the backend path.
  // If your Edge Function invocation path is `/functions/v1/auth-gateway/*`, then `url.pathname` might be `/ag-ui/events`.
  // For this example, we assume the full path after the function name should be forwarded.
  // This might require careful setup of how paths are matched and forwarded.
  // A simpler approach is if the Edge Function is invoked with a path that directly maps to the backend.
  // E.g., Edge function is at /api/* and forwards to FastAPI at /api/*.
  // Let's assume the incoming path should be directly appended to the origin URL.
  // This depends on how Supabase routes to Edge Functions and what `req.url` contains.
  // If `req.url` is `https://<project_ref>.supabase.co/functions/v1/auth-gateway/ag-ui/events?param=1`
  // then `url.pathname` = `/functions/v1/auth-gateway/ag-ui/events`
  // and `url.search` = `?param=1`
  // If your FastAPI backend expects `/ag-ui/events`, you need to adjust the path.
  // For this example, let's assume `url.pathname` is already the correct path for the backend
  // or that `FASTAPI_ORIGIN_URL` includes any necessary base path if the function is not at root.
  // A common setup is to have the function handle a specific base path, e.g., /api,
  // and then the rest of the path is forwarded.
  // If using a custom domain or specific routing, `url.pathname` might directly be `/ag-ui/events`.
  
  // Simplest forwarding: take the path and query from the incoming request to the Edge Function.
  // This means the Edge Function's invoke URL path should mirror the backend's expected path.
  // e.g., call `https://.../functions/v1/auth-gateway/ag-ui/events`
  // to forward to `FASTAPI_ORIGIN_URL/ag-ui/events`.
  const targetPathAndQuery = `${url.pathname.replace("/functions/v1/auth-gateway", "")}${url.search}`; // Example: Strip function base path
  const targetUrl = `${FASTAPI_ORIGIN_URL}${targetPathAndQuery}`;
  
  console.log(`Forwarding request for user ${userId} to: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    });
    return response;
  } catch (error) {
    console.error("Error fetching origin:", error);
    return new Response("Error connecting to the backend service.", { status: 502 });
  }
});
```

**Key Environment Variables for the `auth-gateway` Edge Function (set in Supabase project dashboard -> Settings -> Environment Variables, or `supabase/.env` for local dev):**
*   `FASTAPI_ORIGIN_URL`: The full URL of your deployed FastAPI backend (e.g., `https://your-fastapi-app.fly.dev` or `http://localhost:8000` for local testing if backend is local).
*   `SUPABASE_URL`: Your Supabase project URL (e.g., `https://<project_ref>.supabase.co`).
*   `SUPABASE_ANON_KEY`: Your Supabase project's `anon` key.

**Important Note on Path Forwarding:** The line `const targetPathAndQuery = `${url.pathname.replace("/functions/v1/auth-gateway", "")}${url.search}`;` is an example. You might need to adjust how `targetPathAndQuery` is constructed based on how your Supabase project routes requests to the Edge Function and what part of the path your FastAPI backend expects. If you set up custom domains or use specific function invocation patterns, the base path to strip might differ or not be needed.

### 4. Deploy/Redeploy the Edge Function
```bash
npx supabase functions deploy auth-gateway --no-verify-jwt
```
*   `--no-verify-jwt`: This flag is crucial. We are handling JWT verification *within* the function logic using the Supabase client library. If this flag is omitted, Supabase's gateway might try to verify the JWT first (expecting its own session JWT), which could conflict or be redundant.

## Security Considerations

-   **Secure Connection to Origin:** The connection between the Supabase Edge Function and your FastAPI backend (Origin URL) **MUST** be secure (HTTPS).
-   **Trust Model:** The FastAPI backend implicitly trusts the headers (`X-Supabase-User-ID`, etc.) set by this Edge Function. This is secure if the backend is configured to only accept traffic from the Supabase Edge Function (e.g., via firewall rules restricting access to Supabase IP ranges or by deploying the backend in a way that it's not publicly addressable except through the Edge Function).
-   **Edge Function Secrets:** Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set as secure environment variables for the Edge Function in your Supabase project settings.
```
