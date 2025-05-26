# High Availability (HA) and Disaster Recovery (DR) Strategy

## 1. Introduction

This document outlines the conceptual strategy for ensuring High Availability (HA) and planning for Disaster Recovery (DR) for the Realtime Agent Interaction Backend service.

-   **High Availability (HA):** Refers to the system's ability to remain operational and accessible to users despite component failures or planned maintenance. The goal is to minimize downtime and ensure continuous service.
-   **Disaster Recovery (DR):** Encompasses the processes and procedures for recovering data and restoring critical services in the event of a catastrophic failure or disaster (e.g., regional outage, major data corruption).

**Objectives:**
-   Minimize service downtime for users.
-   Prevent or minimize data loss in case of a disaster.
-   Define a clear path to service restoration.
-   While specific values are not set in this document, key metrics to consider are:
    -   **Recovery Time Objective (RTO):** The target maximum time allowed to restore service functionality after an outage.
    -   **Recovery Point Objective (RPO):** The maximum acceptable amount of data loss, measured in time (e.g., 1 hour of data).

## 2. High Availability (HA) Strategy

### a. Database (Supabase PostgreSQL)

The backend relies heavily on Supabase for its database capabilities. Supabase is built on top of cloud infrastructure (typically AWS) and provides several features that contribute to HA:

-   **Managed Infrastructure:** Supabase manages the underlying database servers, patching, and maintenance, which often includes built-in redundancy at the infrastructure level (e.g., redundant power, networking, storage within an availability zone).
-   **Automated Backups:** Supabase performs regular automated backups of the PostgreSQL database. These are crucial for data protection and are a cornerstone of DR, but also contribute to HA by enabling restoration in case of non-disaster data corruption.
-   **Point-in-Time Recovery (PITR):** Supabase typically offers PITR (check specific plan details), allowing restoration to a specific point in time, which is vital for recovering from logical errors (e.g., accidental data deletion by an application bug).
-   **Connection Pooling:** Supabase uses PgBouncer for connection pooling. This efficiently manages database connections from stateless application instances (like our FastAPI backend), improving performance and stability under load.
-   **Underlying Cloud Provider Redundancy:** The physical infrastructure where Supabase hosts databases usually has built-in redundancies (e.g., within an Availability Zone).

### b. Backend Service (FastAPI Application)

The FastAPI application itself is designed with HA in mind:

-   **Stateless Design:** The backend service is designed to be stateless. User session information (beyond the JWT handled by the Edge Function) and conversation history are stored in the Supabase database. This allows any instance of the backend to handle any user request, making horizontal scaling and load balancing effective.
-   **Multiple Instances & Load Balancing:**
    -   In a containerized environment like Kubernetes (see `kubernetes_deployment_guide.md`), multiple replicas (instances/pods) of the Dockerized backend service are run.
    -   A Kubernetes Service of type `LoadBalancer` (or an equivalent load balancer in other deployment environments like AWS ALB/ELB, Google Cloud Load Balancing) distributes incoming traffic across these healthy instances.
-   **Health and Readiness Checks:**
    -   The `/health` endpoint is used by the load balancer (or K8s) as a liveness probe to ensure the application process is running. If an instance fails this check, it's restarted.
    -   The `/readiness` endpoint is used as a readiness probe to ensure the application instance is ready to accept traffic (e.g., can connect to the database). If an instance fails this, it's temporarily removed from the load balancer's pool.
-   **Zero-Downtime Deployments (Conceptual):**
    -   When deploying new versions of the backend, strategies like **rolling updates** (default in K8s Deployments) ensure that instances are updated one by one, maintaining service availability.
    -   **Blue/green deployments** could also be used, where a new version is deployed alongside the old, and traffic is switched once the new version is confirmed healthy.

### c. Caching Layer (In-Memory `cachetools`)

-   **Current State:** The `MCPToolRegistry` uses an in-memory LRU cache (`cachetools.LRUCache`) for tool definitions. This cache is local to each instance of the backend service.
-   **HA Implication:** If an instance restarts, its in-memory cache is lost and needs to be repopulated (which happens on first access via `get_tool`). This is acceptable for tool definitions as they are loaded at startup and are small.
-   **Future Enhancement for Critical Caching:** If more extensive caching were implemented for frequently accessed, dynamically generated, or expensive-to-compute data that requires HA itself, an external distributed cache (e.g., Redis, Memcached) would be necessary. This would ensure that cached data is shared and available across all backend instances and persists through instance restarts.

### d. Mock A2A Server & External Agents

-   **Mock A2A Server:** The provided `mock_a2a_server` is a single instance for development and testing.
-   **Real A2A Agents:** In a production scenario where the backend communicates with other real agents (internal or external), each of those agents would be responsible for its own HA strategy. Our `A2ACommunicationService` would rely on their availability.

### e. Supabase Edge Functions (`auth-gateway`)

-   The `auth-gateway` Edge Function, responsible for JWT validation, runs on Supabase's distributed Edge Network.
-   Supabase manages the availability and scalability of its Edge Functions, providing inherent HA for this authentication layer.

## 3. Disaster Recovery (DR) Strategy

DR focuses on restoring service and data in the event of a major outage (e.g., regional cloud failure, severe data corruption).

### a. Database (Supabase PostgreSQL)

-   **Automated Backups:** The primary DR mechanism for the database relies on Supabase's automated backup procedures.
    -   **Recovery Process:** Familiarize yourself with the Supabase dashboard and documentation for restoring a database from an automated backup. This typically involves selecting a backup and initiating a restore process, which might create a new database instance.
-   **Point-in-Time Recovery (PITR):**
    -   If available on your Supabase plan, PITR allows for more granular recovery to a specific moment before data loss or corruption occurred (e.g., just before a faulty `DELETE` statement was run).
-   **Cross-Region Replication (Advanced DR):**
    -   For very high DR requirements, investigate if Supabase offers or supports configuring cross-region replication for your database. This would replicate your data to a different geographical region, allowing for failover in case of a complete regional outage. This is an advanced feature and may have cost implications.
-   **Data Export:** Consider periodic manual or scripted exports of critical data (if feasible and compliant with data handling policies) as an additional data safety measure, stored in a separate secure location.

### b. Backend Service Configuration & Code

-   **Infrastructure as Code (IaC):**
    -   If deploying via Kubernetes, all K8s manifests (`deployment.yaml`, `service.yaml`, `configmap.yaml`, `secret.yaml` stubs) should be stored in version control (e.g., Git).
    -   If using other IaC tools (e.g., Terraform, CloudFormation), those configurations should also be version-controlled.
    -   This allows for rapid and consistent redeployment of the application infrastructure in a new region or environment if necessary.
-   **Container Images:**
    -   Docker images for the backend service (and mock A2A server if used in DR testing) are stored in a resilient container registry (e.g., Docker Hub, GCR, ECR, ACR). These registries typically have their own HA and DR measures.

### c. Secrets & Credentials Management

-   **Supabase Environment Variables/Secrets:** Sensitive configurations like `SUPABASE_DATABASE_URL`, `OPENAI_API_KEY`, and any tool-specific API keys (e.g., `MOCK_WEATHER_TOOL_API_KEY`) are stored as environment variables.
    -   For K8s deployments, these are managed via K8s Secrets. The K8s Secrets themselves should be backed up or managed via a GitOps approach (e.g., using sealed secrets or a secrets manager that integrates with K8s).
    -   For Supabase Edge Functions, secrets like `FASTAPI_ORIGIN_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are managed within the Supabase project settings and are part of Supabase's platform DR.
-   **Secrets Manager (Recommended Practice):** For a more robust solution, consider using a dedicated secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager, Google Secret Manager, Azure Key Vault). The application would then fetch secrets from this manager at startup or runtime. These managers typically have their own robust HA/DR capabilities.

### d. Data Restoration Process (General Steps for Full DR)

1.  **Declare Disaster & Assess Impact:** Confirm the nature and scope of the disaster.
2.  **Activate DR Plan:** Initiate the documented DR procedures.
3.  **Restore Database:**
    *   Use Supabase's console/tools to restore the database from the latest available and consistent backup (or PITR point) to a new instance, potentially in a different region if necessary.
    *   Update the `SUPABASE_DATABASE_URL` configuration for the backend service to point to the restored database instance.
4.  **Deploy Backend Application:**
    *   Using IaC (K8s manifests, etc.), deploy the backend Docker image to the recovery environment/region.
    *   Ensure all necessary configurations (ConfigMaps, K8s Secrets populated with restored application secrets) are applied.
5.  **Deploy Supabase Edge Function(s):**
    *   Edge Functions are globally distributed by Supabase, but ensure their configuration (especially `FASTAPI_ORIGIN_URL`) is updated to point to the new backend deployment if its address has changed.
6.  **Update DNS & Routing:**
    *   If public-facing DNS records need to change (e.g., the Edge Function URL's underlying target or a custom domain for the API), update them to point to the new infrastructure in the recovery region.
7.  **Thorough Testing:** Conduct comprehensive testing to ensure all functionalities are working as expected and data integrity is maintained.
8.  **Communicate Recovery:** Inform stakeholders once the service is restored.

### e. DR Drills

-   **Periodic Testing:** Regularly conduct DR drills (e.g., annually or semi-annually). This involves simulating a disaster scenario and running through the actual restoration process.
-   **Identify Gaps:** Drills help identify weaknesses in the DR plan, outdated procedures, or issues with configurations.
-   **Improve RTO/RPO:** Use learnings from drills to refine the DR plan and improve recovery times and reduce potential data loss.

## 4. Key Metrics for HA/DR (Conceptual)

While specific values depend on business requirements, these are the concepts to define:

-   **Recovery Time Objective (RTO):** The maximum acceptable duration of downtime for the service after a disaster. *Example: "The service must be restored within 4 hours of a declared disaster."*
-   **Recovery Point Objective (RPO):** The maximum acceptable amount of data loss, measured in time. This is largely determined by the backup frequency. *Example: "No more than 15 minutes of data loss is acceptable."* (Supabase's PITR capabilities would influence this).

Defining and agreeing upon RTO and RPO values are critical for designing an appropriate HA/DR strategy and setting user/stakeholder expectations.
```
