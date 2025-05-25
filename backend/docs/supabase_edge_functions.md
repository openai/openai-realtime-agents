# Supabase Edge Function for API Key Authentication

This document outlines the setup and functionality of a Supabase Edge Function designed to handle API key authentication before requests reach the FastAPI backend.

## Overview

The primary goal is to offload API key validation to the Supabase Edge infrastructure. This provides a secure and performant way to protect the backend service.

## Chosen Interface: Edge Function as a Pure Authenticator

1.  **Client Request:** The client sends its request to the designated Supabase Edge Function URL, including the `X-API-KEY` in its headers.
2.  **Edge Function Validation:** The Edge Function (`api-key-authenticator`) intercepts this request.
    *   It reads the `X-API-KEY` header.
    *   It retrieves the securely stored `EXPECTED_API_KEY` from Supabase environment variables/secrets.
    *   It compares the received key with the expected key.
3.  **Request Forwarding (if valid):**
    *   If the API key is valid, the Edge Function modifies the request:
        *   Removes the original `X-API-KEY` header (as it's no longer needed by the backend).
        *   Adds a new header: `X-Auth-Validation-Status: success`.
    *   The modified request is then forwarded to the FastAPI backend (configured as the "Origin URL" for this Edge Function).
4.  **Error Response (if invalid):**
    *   If the API key is invalid or missing, the Edge Function immediately returns an HTTP `401 Unauthorized` or `403 Forbidden` error response directly to the client. The request does not reach the FastAPI backend.
5.  **FastAPI Backend Trust:** The FastAPI backend is configured to trust requests that include the `X-Auth-Validation-Status: success` header, assuming the network path between the Supabase Edge Function and the FastAPI backend is secure.

## Supabase Edge Function Setup

### 1. Install/Update Supabase CLI
Ensure you have the latest Supabase CLI installed and are logged in:
```bash
# Install/upgrade
npm install supabase --save-dev # or global install
# Login
npx supabase login
```

### 2. Link Your Project (if not already linked)
Navigate to your local Supabase project directory (this is separate from the Python backend's Git repository, typically where your `supabase/` folder resides).
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Create the Edge Function
Use the Supabase CLI to create a new Edge Function.
```bash
npx supabase functions new api-key-authenticator
```
This will create a new directory: `supabase/functions/api-key-authenticator/index.ts`.

### 4. Edge Function Code (`supabase/functions/api-key-authenticator/index.ts`)

Below is the TypeScript code for the `index.ts` file. This function reads the `X-API-KEY`, compares it to a secret, and then either forwards the request with a success header or returns an error.

```typescript
// supabase/functions/api-key-authenticator/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// IMPORTANT: Replace this with your actual FastAPI backend URL
const FASTAPI_ORIGIN_URL = Deno.env.get("FASTAPI_ORIGIN_URL") || "http://localhost:8000"; // Example

// Name of the header carrying the API key from the client
const API_KEY_HEADER_NAME = "x-api-key"; // Standardized to lowercase by Deno/Fetch API

// Name of the header to be added if authentication is successful
const AUTH_VALIDATION_HEADER_NAME = "x-auth-validation-status";
const AUTH_VALIDATION_SUCCESS_VALUE = "success";

console.log("Edge Function 'api-key-authenticator' initializing...");

serve(async (req) => {
  console.log(`Request received for: ${req.url}`);

  // 1. Get the expected API key from environment variables (Supabase secrets)
  const expectedApiKey = Deno.env.get("EXPECTED_API_KEY_SECRET");
  if (!expectedApiKey) {
    console.error("CRITICAL: EXPECTED_API_KEY_SECRET is not set in Edge Function environment.");
    return new Response("Internal Server Error: Auth configuration missing.", { status: 500 });
  }

  // 2. Get the API key from the request header
  const receivedApiKey = req.headers.get(API_KEY_HEADER_NAME);

  // 3. Validate the API key
  if (!receivedApiKey) {
    console.warn(`Auth failed: Missing '${API_KEY_HEADER_NAME}' header.`);
    return new Response(`Missing '${API_KEY_HEADER_NAME}' header.`, { status: 403 });
  }

  if (receivedApiKey !== expectedApiKey) {
    console.warn("Auth failed: Invalid API Key provided.");
    return new Response("Invalid API Key.", { status: 401 });
  }

  // 4. API Key is valid. Forward the request to the FastAPI origin.
  console.log("API Key validated successfully. Forwarding request to origin.");

  // Create new headers for the forwarded request
  const headers = new Headers(req.headers); // Clone original headers
  headers.delete(API_KEY_HEADER_NAME); // Remove the original API key header
  headers.set(AUTH_VALIDATION_HEADER_NAME, AUTH_VALIDATION_SUCCESS_VALUE); // Add our custom validation header

  // Construct the full URL to the origin server
  // The incoming `req.url` is the full URL to the Edge Function itself.
  // We need to append the path and query params to the FASTAPI_ORIGIN_URL.
  const url = new URL(req.url);
  const targetUrl = `${FASTAPI_ORIGIN_URL}${url.pathname}${url.search}`;
  
  console.log(`Forwarding to: ${targetUrl}`);

  try {
    // Forward the request with the new headers
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body, // Forward the body if present
      // redirect: "manual", // Deno's fetch follows redirects by default
    });
    return response;
  } catch (error) {
    console.error("Error fetching origin:", error);
    return new Response("Error connecting to the backend service.", { status: 502 }); // Bad Gateway
  }
});
```

**Key Environment Variables for the Edge Function (set in Supabase Dashboard or `supabase/.env`):**
*   `EXPECTED_API_KEY_SECRET`: The actual API key value that the Edge Function will compare against. This should be a strong, unique key.
*   `FASTAPI_ORIGIN_URL`: The full URL of your deployed FastAPI backend (e.g., `https://your-fastapi-app.fly.dev`).

### 5. Deploy the Edge Function
```bash
npx supabase functions deploy api-key-authenticator --no-verify-jwt
```
*   `--no-verify-jwt`: Since this function is handling its own API key authentication, we typically don't need Supabase's automatic JWT verification for it. If JWTs issued by Supabase Auth were also a requirement, this flag would be omitted.

### 6. Configure FastAPI Backend as Origin
In your Supabase project settings (usually via the `supabase/config.toml` file or the dashboard if settings are exposed there), you would typically define your FastAPI backend as the "origin" for requests that are routed to this Edge Function.
However, with the `fetch` approach directly in the Edge Function code using `FASTAPI_ORIGIN_URL`, the Edge Function *itself* defines the origin.

The public-facing URL will now be the Edge Function's URL (e.g., `https://<project_ref>.supabase.co/functions/v1/api-key-authenticator/ag-ui/events`). Clients should target this URL.

## FastAPI Backend Changes

The FastAPI backend needs to be updated to trust the `X-Auth-Validation-Status` header set by the Edge Function.

1.  **New Dependency in `backend/security.py`:**
    A new dependency, `verify_auth_validation_status`, will replace `get_api_key`. This dependency will check for the `X-Auth-Validation-Status: success` header.

2.  **Updated Router Protection in `backend/routers/ag_ui_router.py`:**
    The AG-UI SSE endpoint will use `Depends(verify_auth_validation_status)` instead of `Depends(get_api_key)`.

3.  **Environment Variables for Backend:**
    No new environment variables are strictly needed for the backend *for this specific auth change*, as the `EXPECTED_API_KEY` is now managed by the Edge Function. The backend only checks for the header added by the Edge Function.

## Security Considerations

-   **Secure Connection to Origin:** The connection between the Supabase Edge Function and your FastAPI backend (Origin URL) MUST be secure (HTTPS). The Edge Function trusts that it's talking to your actual backend.
-   **Header Spoofing:** The `X-Auth-Validation-Status` header is trusted by the backend. This is generally safe if:
    *   The FastAPI backend is not directly accessible to the public internet, OR
    *   If it is, firewall rules ensure that it only accepts traffic from Supabase IP ranges for the paths that expect this header-based authentication.
    *   If the backend is publicly accessible and such firewalling is not feasible, then this model implies that any request reaching the backend *with* this header is considered pre-authenticated. This requires careful network setup.
-   **Edge Function URL:** The Edge Function URL becomes the new public entry point for your service.
```
