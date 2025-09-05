# Monitoring Dashboards & Alerting Strategy

This document outlines a strategy for comprehensive monitoring, dashboarding, and alerting for the Realtime Agent Interaction Backend service. The goal is to maintain high availability, performance, and reliability by proactively identifying and addressing issues.

## 1. Objectives

-   **Visibility:** Gain deep insights into the health, performance, and usage patterns of the backend service and its dependencies.
-   **Proactive Issue Detection:** Identify potential problems and anomalies before they impact users.
-   **Rapid Troubleshooting:** Facilitate quick diagnosis and resolution of incidents.
-   **Performance Optimization:** Understand system behavior under various loads to guide optimization efforts.
-   **Capacity Planning:** Inform infrastructure scaling decisions based on observed trends.
-   **Security Monitoring:** Detect and alert on potential security threats or breaches.

## 2. Key Data Sources for Monitoring

Monitoring data will be collected from several sources:

1.  **Application Metrics:**
    *   Collected via `BasicMetricsMiddleware` (in-memory for now, ideally exported to Prometheus).
    *   Includes: request rates, error rates (HTTP 4xx/5xx), request latencies (p50, p95, p99), counts per endpoint/method/status.
2.  **Distributed Traces:**
    *   Collected via OpenTelemetry SDK and instrumentations (FastAPI, HTTPX, OpenAI).
    *   Exported to an OTLP-compatible backend (e.g., Jaeger, Grafana Tempo, SigNoz).
    *   Provides: end-to-end request flow visibility, latency breakdown per component (LLM, tools, A2A, database queries if instrumented).
3.  **Structured Logs:**
    *   JSON formatted logs from `python-json-logger`, output to `stdout`.
    *   Collected by a log aggregation platform (e.g., ELK Stack, Loki, Grafana Loki, cloud provider logging services).
    *   Provides: detailed event information, error messages, contextual data for debugging.
4.  **Database Metrics (Supabase PostgreSQL):**
    *   Supabase provides its own dashboard for key database metrics.
    *   If direct access or a dedicated monitoring integration is available, metrics include: CPU/memory utilization, active connections, query performance, disk I/O, storage.
5.  **LLM API Metrics (OpenAI):**
    *   OpenAI dashboard provides usage metrics (tokens, requests).
    *   Consider proxying OpenAI calls through a component that can extract metrics like latency, error rates, and token counts per call for more granular monitoring.
6.  **Infrastructure Metrics (Kubernetes/Cloud Provider):**
    *   If deployed on Kubernetes: CPU/memory/network/disk utilization per pod/node, HPA metrics, K8s event logs.
    *   Cloud provider metrics for load balancers, network traffic, etc.

## 3. Monitoring Dashboards (Using Grafana or similar)

Visual dashboards are essential for understanding system health and performance at a glance. Grafana is a popular choice, capable of integrating data from Prometheus (metrics), Loki (logs), and tracing backends.

### a. Overview Dashboard (High-Level Health)
-   **Key Performance Indicators (KPIs):**
    -   Overall Request Rate (RPS) for `/ag-ui/events`.
    -   Overall Error Rate (%) (HTTP 5xx, and potentially key 4xx like 401/403).
    -   P95 & P99 Latency for `/ag-ui/events`.
    -   Number of active SSE connections (if measurable).
-   **System-Wide Status:**
    -   Status of critical dependencies (Database, LLM API - based on error rates/latency).
    -   CPU/Memory utilization trends for the backend service.

### b. LLM Performance Dashboard
-   **LLM Call Rate:** Number of calls to OpenAI API over time.
-   **LLM Call Latency:** P50, P95, P99 latency for OpenAI API calls (from OpenTelemetry traces).
-   **LLM Error Rate:** Percentage of failed calls to OpenAI API.
-   **Token Usage:**
    -   Input tokens, output tokens, total tokens per request/per user/per model (if available).
    -   Trends in token usage to anticipate costs and potential rate limiting.
-   **Cost Monitoring (Estimated):** If token usage can be tracked, estimate costs based on OpenAI pricing.

### c. MCP Tool Dashboard
-   **Call Rate per Tool:** How often each registered MCP tool is invoked.
-   **Latency per Tool:** P50, P95, P99 latency for each tool invocation (especially for HTTP tools).
-   **Error Rate per Tool:** Percentage of failed invocations for each tool (e.g., `ERROR_EXECUTION`, `ERROR_HTTP`, `ERROR_FORBIDDEN`).
-   **Credential Loading Errors:** Track if tools fail due to missing credentials (from logs/audit events).

### d. A2A Communication Dashboard
-   **A2A Delegation Rate:** Number of A2A tasks delegated, per target agent.
-   **A2A Delegation Latency:** P50, P95, P99 latency for A2A `send_task_to_agent` calls (from OpenTelemetry traces).
-   **A2A Error Rate:** Percentage of failed A2A delegations, per target agent (e.g., `ERROR_NETWORK`, `ERROR_HTTP` from target).

### e. Resource Utilization Dashboard (from K8s/Host metrics)
-   **Backend Service:**
    -   CPU Utilization (%) per pod/instance.
    -   Memory Usage (MB/GB) per pod/instance.
    -   Network I/O (bytes/sec) per pod/instance.
    -   Number of running pods vs. desired pods (for K8s).
-   **Database (Supabase):** Key metrics from the Supabase dashboard (CPU, memory, connections, disk usage, IOPS).

### f. Audit Log & Security Dashboard
-   **Rate of Audit Events:** Overall volume of audit logs.
-   **Authentication Failures:** Rate of `AUTH_GATEWAY_VALIDATION` failures (from audit logs).
-   **RBAC Denials:** Rate of `MCP_TOOL_INVOKE_ATTEMPT` with status `ERROR_FORBIDDEN` (from audit logs).
-   **Guardrail Violations:** Rate of `GUARDRAIL_VIOLATION_DETECTED` events (from audit logs).
-   **Critical Errors:** Counts of specific critical error log messages.

## 4. Alerting Strategy

Alerts notify the team of critical issues requiring attention. Use tools like Prometheus Alertmanager, Grafana Alerting, or cloud provider alerting services.

### a. Critical Alerts (Immediate Notification - e.g., PagerDuty, SMS, urgent Slack)
-   **Service Unavailability:**
    -   High overall error rate (e.g., >5% HTTP 5xx errors on `/ag-ui/events` for >5 minutes).
    -   `/health` or `/readiness` probes failing consistently for multiple instances.
-   **Critical Dependency Failure:**
    -   LLM API completely unavailable or very high error rate (>20% for >5 minutes).
    -   Database down/unresponsive (readiness probe failing for all instances due to DB).
-   **Performance Degradation:**
    -   High AG-UI endpoint latency (e.g., p99 > 5 seconds for >5 minutes).
-   **Resource Exhaustion (Critical):**
    -   CPU or Memory utilization at 100% for critical components for an extended period, leading to instability.
    -   Running out of disk space on the database server.
-   **Security Alerts (High Severity):**
    -   Sudden spike in authentication failures.
    -   High rate of `GUARDRAIL_VIOLATION_DETECTED` events.
    -   Suspicious activity detected in audit logs (e.g., unauthorized admin tool access attempts).

### b. Warning Alerts (Investigation Needed - e.g., Slack, Email)
-   **Elevated Error Rates (Non-Critical):**
    -   Increased (but not critical) rate of HTTP 4xx or 5xx errors.
    -   Increased error rates for specific MCP tools or A2A delegations.
-   **Performance Warnings:**
    -   Latency for specific tools or A2A agents consistently above defined thresholds.
    -   LLM API latency increasing.
-   **Resource Utilization Warnings:**
    -   CPU or Memory utilization consistently above a warning threshold (e.g., >80% for >15 minutes).
    -   Database connections approaching limits.
-   **LLM Usage Warnings:**
    -   LLM token usage approaching daily/monthly quotas or budget limits.
-   **Cache Performance (If applicable for distributed cache):**
    -   High cache miss rate.
    -   Cache latency increasing.

### c. Alert Configuration Details
-   **Thresholds:** Define clear, measurable thresholds for each alert.
-   **Evaluation Period:** Specify how long a condition must persist before an alert fires (to avoid flapping).
-   **Severity:** Categorize alerts (e.g., critical, warning, info).
-   **Notification Channels:** Define how alerts are delivered based on severity (PagerDuty, Slack, email, etc.).
-   **Playbooks/Runbooks:** For critical alerts, link to or provide clear instructions on initial troubleshooting steps and escalation procedures.

## 5. Tools and Integration

-   **Metrics Backend:** Prometheus (for scraping and storing metrics).
-   **Logging Backend:** Loki, ELK Stack, or cloud provider solution.
-   **Tracing Backend:** Jaeger, Grafana Tempo, or SigNoz.
-   **Visualization & Alerting:** Grafana is a strong candidate as it can integrate with all the above. Prometheus Alertmanager for dedicated alert routing.
-   **Log & Trace Correlation:** Ensure tools allow easy correlation between logs, traces, and metrics for a given request or user session (e.g., using a shared trace ID or request ID in logs).

This strategy provides a framework for establishing a robust monitoring and alerting system. It will need to be iteratively refined as the system evolves and more specific operational characteristics are understood.
```
