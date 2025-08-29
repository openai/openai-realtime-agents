# Load Testing Strategy for Backend Service

This document outlines a strategy for conducting performance and load testing on the Realtime Agent Interaction Backend service. Effective load testing is crucial to ensure the service is scalable, responsive, and reliable under anticipated user loads.

## 1. Objectives of Load Testing

-   **Identify Performance Bottlenecks:** Pinpoint components or operations that degrade performance under load (e.g., CPU, memory, I/O, database, external API calls).
-   **Determine System Capacity:** Understand the maximum load (e.g., concurrent users, requests per second) the system can handle while meeting performance targets.
-   **Validate Scalability:** Ensure the system can scale effectively (e.g., with Kubernetes HPA) to handle increasing load.
-   **Assess Stability and Reliability:** Verify that the system remains stable and recovers gracefully from high-load conditions or transient failures.
-   **Measure Key Performance Indicators (KPIs):** Track metrics like latency, throughput, and error rates.
-   **Inform Capacity Planning:** Provide data for making decisions about resource allocation and infrastructure sizing.

## 2. Suggested Load Testing Tools

Several open-source tools are well-suited for load testing this type of backend service:

-   **k6 (by Grafana Labs):**
    -   Modern load testing tool for engineering teams.
    -   Scripts are written in JavaScript (ES2015/ES6).
    -   Supports testing APIs and microservices, including WebSocket and gRPC (SSE testing might require custom handling or community extensions).
    -   Good for developer-centric testing and CI/CD integration.
    -   Can output metrics to various backends (Prometheus, Grafana, Datadog, etc.).
-   **Locust:**
    -   User behavior is defined in Python code.
    -   Distributed and scalable, capable of simulating millions of users.
    -   Web UI for monitoring test progress.
    -   Good for testing complex user flows.
-   **Apache JMeter:**
    -   Java-based, feature-rich, and widely used.
    -   GUI for test plan creation, but can also run in CLI mode.
    -   Supports various protocols, including HTTP, HTTPS, WebSockets.
    -   Steeper learning curve compared to k6 or Locust for simple API tests.

**Choice of Tool:** For this backend, **k6** or **Locust** are likely good starting points due to their scripting capabilities in common languages (JavaScript/Python) and focus on API testing.

## 3. Key Scenarios to Test

The load tests should simulate realistic user interactions and stress critical parts of the system.

### a. AG-UI SSE Endpoint (`/ag-ui/events`)
-   **Connection Establishment and Duration:**
    -   Simulate a large number of clients establishing SSE connections simultaneously.
    -   Maintain these connections for varying durations (e.g., short, medium, long sessions).
    -   Measure connection setup time and ability to handle concurrent connections.
-   **Message Rate and Latency (User-to-Agent):**
    -   Simulate clients sending `user_message` queries at different rates.
    -   Measure the time taken for the first AG-UI event (e.g., `AGENT_RESPONSE` or `TOOL_CALL_START`) to be received after a user message is sent.
-   **Event Streaming Volume:**
    -   Test scenarios where the agent streams multiple events per user request (e.g., tool calls, A2A delegations followed by agent responses).
    -   Monitor the backend's ability to handle a high volume of outbound SSE messages.

### b. Concurrent User Sessions
-   Simulate a target number of concurrent users, each engaging in a typical conversation flow (e.g., sending a few messages, some of which trigger tools or A2A calls).
-   Monitor overall system stability and resource usage.

### c. High-Volume Simple LLM Queries
-   Focus on scenarios where most user messages result in direct LLM responses without tool usage or A2A delegation.
-   This tests the raw throughput of the OpenAI API integration and basic orchestration.

### d. Interactions Involving MCP Tool Calls
-   **Specific Tool Load:** Test scenarios that heavily utilize one or more specific MCP tools (e.g., many calculator requests, many weather requests).
    -   If a tool is an HTTP endpoint, this also tests the performance of that external HTTP call.
    -   If a tool involves I/O (like the in-memory notes tool, though less critical), its performance under concurrent access should be observed.
-   **Multi-Step Tool Chains:** Test scenarios where the LLM makes a sequence of tool calls within a single user turn.

### e. Interactions Involving A2A Delegations
-   Simulate scenarios where the agent delegates tasks to other agents (via the `A2ACommunicationService` calling the `mock_a2a_server` or, in the future, real external agents).
-   Measure the latency added by A2A calls and the system's ability to manage these distributed interactions.

### f. Database Performance
-   Monitor database performance (CPU, memory, I/O, query latency, connection count) during all load test scenarios, as conversation history and audit logs are written.
-   Specifically test scenarios that might involve frequent writes or reads if other DB-heavy features are added.

### g. Audit Logging Performance
-   Ensure that enabling audit logging does not introduce significant performance overhead, especially under high load.

## 4. Metrics to Monitor

### a. Backend Service Metrics (from `/metrics-debug` or Prometheus if integrated)
-   **Request Latency:** p50, p90, p95, p99 for all HTTP endpoints, especially `/ag-ui/events`.
-   **Request Throughput:** Requests per second (RPS) for all endpoints.
-   **Error Rates:** Percentage of 4xx and 5xx errors.
-   **Resource Utilization:** CPU and memory usage of backend instances/pods.
-   **SSE Connection Metrics:** Number of active SSE connections.

### b. LLM API Metrics (if available from OpenAI or via proxy)
-   API call latency.
-   Rate limits and error rates from the OpenAI API.

### c. Database Metrics (from Supabase dashboard or PostgreSQL monitoring tools)
-   CPU and memory utilization.
-   Active connections.
-   Query latency.
-   Disk I/O and storage capacity.

### d. Load Testing Tool Metrics
-   Number of virtual users (VUs).
-   Request rate (RPS).
-   Response times (min, max, avg, percentiles).
-   Number of successful and failed requests.

## 5. Load Testing Environment

-   **Staging/Pre-production Environment:** Ideally, load tests should be run in an environment that mirrors production as closely as possible in terms of infrastructure, data volume (anonymized), and configurations.
-   **Isolate from Production:** Avoid running high-intensity load tests directly against the production environment to prevent impacting real users.
-   **Network Considerations:** Ensure the load generation tool has sufficient network bandwidth and low latency to the test environment to avoid becoming a bottleneck itself.
-   **Dependency Mocking/Stubbing:** For external services that cannot be included in the load test (e.g., actual third-party APIs called by tools), consider using mocks or stubs that simulate their expected performance characteristics. The `mock_a2a_server` is an example of this.

## 6. Load Testing Process

1.  **Define Baselines and Goals:** Establish current performance baselines and set clear performance goals (e.g., "handle 500 concurrent users with p95 latency < 500ms for AG-UI responses").
2.  **Develop Test Scripts:** Create scripts for the chosen load testing tool based on the key scenarios.
3.  **Gradual Load Increase (Ramp-up):** Start with a low load and gradually increase it to identify at what point performance degrades or bottlenecks appear.
4.  **Soak Testing:** Run tests for extended periods at a sustained, expected load to check for memory leaks, resource exhaustion, or performance degradation over time.
5.  **Stress Testing:** Push the system beyond its expected limits to understand its failure modes and recovery behavior.
6.  **Analyze Results:** Collect and analyze metrics from all monitored components (backend, database, load testing tool).
7.  **Identify Bottlenecks:** Use the collected data and profiling tools (if necessary) to find performance hotspots.
8.  **Optimize:** Make necessary code, configuration, or infrastructure changes to address bottlenecks.
9.  **Re-test:** Repeat the load tests to verify improvements and ensure goals are met.
10. **Integrate into CI/CD (Optional but Recommended):** Incorporate smaller-scale performance tests into the CI/CD pipeline to catch regressions early.

By following a structured load testing strategy, we can build confidence in the backend service's ability to perform under pressure and deliver a good user experience.
```
