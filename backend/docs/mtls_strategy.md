# mTLS Strategy for Inter-Service Communication

## 1. Introduction to mTLS

Mutual Transport Layer Security (mTLS) is a security protocol that ensures both parties in a communication channel (e.g., two services) authenticate each other before establishing a secure connection. Unlike standard TLS, where only the client typically verifies the server's certificate, mTLS requires the server to also verify the client's certificate.

This provides a strong guarantee that both ends of the communication are who they claim to be, preventing unauthorized services from accessing internal APIs or sensitive data.

## 2. Why mTLS for Backend Services?

In a microservices architecture or any distributed system where multiple backend services communicate with each other, mTLS is crucial for:

-   **Zero-Trust Security:** It aligns with a zero-trust security model, where no service implicitly trusts another, even within the same network.
-   **Strong Authentication:** Ensures that only authorized and verified services can communicate. This prevents spoofing or unauthorized access from compromised or rogue services.
-   **Data Integrity and Confidentiality:** Like standard TLS, mTLS encrypts the traffic between services, protecting data in transit.
-   **Defense in Depth:** Adds an additional layer of security beyond network firewalls or API gateways.

## 3. Applicability in Our Backend Architecture

While our current backend is largely monolithic, mTLS would become highly relevant if we evolve towards a more distributed architecture. Potential scenarios include:

-   **Dedicated Internal Microservices:** If we were to break out specific functionalities (e.g., a dedicated "Credentials Management Service", a complex "Task Processing Service" separate from the main orchestration) into their own internal microservices, mTLS would be ideal for securing communication between the main FastAPI backend and these new services.
-   **FastAPI to FastAPI Communication:** If different components of the agent platform were deployed as separate FastAPI applications that need to call each other's internal APIs.
-   **Secure Communication with Partner Services:** If our backend needs to integrate with trusted third-party services within a private network or via a secure B2B setup where mTLS is mandated.

**Current A2A and MCP:**
-   **A2A Communication:** The current `A2ACommunicationService` calls external agents (simulated by `mock_a2a_server`). If these were internal, trusted agents deployed as separate services, mTLS would be a strong candidate for securing these calls. For external public agents, standard TLS with API key/OAuth is more common.
-   **MCP Tools (HTTP Endpoints):** If an MCP tool is an HTTP endpoint representing another internal service, mTLS would apply. If it's an external public API, that API provider would define its own security (TLS + API keys/OAuth). Python function tools run within the same process and don't require mTLS for invocation.

## 4. General Steps for Implementing mTLS

Implementing mTLS typically involves the following steps:

### a. Certificate Authority (CA) Setup
-   **Establish a Private CA:** This can be a dedicated CA service (like HashiCorp Vault, AWS Certificate Manager Private CA) or by generating your own CA certificate and key (e.g., using OpenSSL). This CA will be responsible for signing certificates for all your internal services.
-   **Distribute CA Certificate:** All services need to trust this CA. The CA's public certificate must be securely distributed to them.

### b. Service Certificate Generation
-   **Generate Private Key and CSR:** Each service (e.g., FastAPI backend, other internal microservices) needs its own private key and a Certificate Signing Request (CSR). The CSR includes information about the service (e.g., its common name, often a service identifier like `orchestration-service.internal.mydomain.com`).
-   **Sign CSR with Private CA:** The CSR is sent to the private CA, which verifies it and issues a signed certificate for the service. This certificate identifies the service and is valid for a defined period.
-   **Securely Store Certificates and Keys:** Each service must securely store its private key and its signed certificate. The CA's public certificate is also needed.

### c. Configure Web Servers/Services (e.g., FastAPI with Uvicorn/Hypercorn)
-   **Server-Side mTLS:**
    *   The server (e.g., Uvicorn running the FastAPI app) is configured to require clients to present a certificate during the TLS handshake (`SSLContext.verify_mode = ssl.CERT_REQUIRED`).
    *   It's configured with its own certificate and private key.
    *   It's configured with the CA certificate(s) it should trust for verifying client certificates.
    *   The server can then extract information from the validated client certificate (e.g., Common Name, Subject Alternative Names) to identify and authorize the calling service.

### d. Configure HTTP Clients (e.g., `httpx` in our services)
-   **Client-Side mTLS:**
    *   When Service A calls Service B, Service A's HTTP client (`httpx`) is configured to:
        *   Present its own client certificate and private key to Service B.
        *   Verify Service B's server certificate against the trusted private CA certificate(s).
    *   Example with `httpx`:
      ```python
      # import httpx
      # import ssl
      # context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
      # context.load_verify_locations('path/to/ca_cert.pem') # Trust our private CA
      # context.load_cert_chain(certfile='path/to/client_service_cert.pem', keyfile='path/to/client_service_key.pem')
      # async with httpx.AsyncClient(verify=context) as client:
      #     response = await client.get("https://internal-service-b.example.com/api/data")
      ```

### e. Certificate Revocation and Rotation
-   Implement a process for revoking compromised certificates (e.g., using Certificate Revocation Lists - CRLs, or Online Certificate Status Protocol - OCSP).
-   Establish a schedule and process for regularly rotating service certificates before they expire.

## 5. Considerations for Our Backend

-   **Deployment Environment:** The ease of implementing mTLS can depend on the deployment platform (e.g., Kubernetes with a service mesh like Istio or Linkerd can automate much of the mTLS setup and certificate management).
-   **Complexity:** mTLS adds operational complexity, especially around certificate management. It should be adopted where the security benefits justify this.
-   **Current Scope:** For the immediate Phase 3, with the current architecture (FastAPI backend, Supabase DB, Supabase Edge Function for auth, mock tools/A2A server), direct mTLS implementation *within* the FastAPI backend for its own exposed endpoints is not the primary focus, as client auth is handled by the Edge Function. However, if the `MCPToolService` or `A2ACommunicationService` were to call other *internal* backend services that we own and deploy, mTLS would be the recommended approach for those specific outbound calls.

This document serves as a strategic overview. Detailed implementation guides would depend on the specific services involved and the chosen CA/certificate management tools.
```
