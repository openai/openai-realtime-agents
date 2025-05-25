# Kubernetes (K8s) Deployment Guide for Backend Service

This document provides a conceptual guide and key considerations for deploying the Python/FastAPI backend service to a Kubernetes cluster.

## 1. Prerequisites

-   A running Kubernetes cluster.
-   `kubectl` command-line tool configured to interact with your cluster.
-   A Docker container registry (e.g., Docker Hub, Google Container Registry (GCR), Amazon Elastic Container Registry (ECR), Azure Container Registry (ACR)) where the backend service's Docker image will be stored.
-   The backend service Docker image built and pushed to your container registry (see `backend/Dockerfile`).

## 2. Core Kubernetes Components

You will typically need at least two main Kubernetes manifest files: a `Deployment` and a `Service`.

### a. Deployment (`deployment.yaml` - Example)

A Deployment manages stateless applications like our FastAPI backend. It ensures a specified number of replicas (pods) are running and handles updates.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: realtime-agent-backend
  labels:
    app: realtime-agent-backend
spec:
  replicas: 3 # Example: Start with 3 replicas, adjust based on load
  selector:
    matchLabels:
      app: realtime-agent-backend
  template:
    metadata:
      labels:
        app: realtime-agent-backend
    spec:
      containers:
      - name: backend-container
        image: YOUR_CONTAINER_REGISTRY/YOUR_IMAGE_NAME:YOUR_TAG # Replace with your actual image path
        imagePullPolicy: Always # Or "IfNotPresent" for stable tags
        ports:
        - containerPort: 8000 # Port exposed by Uvicorn in the Dockerfile
        envFrom:
        - configMapRef:
            name: backend-configmap # For non-sensitive config
        - secretRef:
            name: backend-secrets   # For sensitive config (API keys, DB URL)
        resources:
          requests: # Example: Adjust based on load testing and requirements
            memory: "256Mi"
            cpu: "250m" # 0.25 CPU core
          limits:
            memory: "1Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /health # Path to the health check endpoint
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 20
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /readiness # Path to the readiness check endpoint
            port: 8000
          initialDelaySeconds: 20 # Give more time for initial DB connection etc.
          periodSeconds: 20
          timeoutSeconds: 5
          failureThreshold: 3
```

**Key points for `Deployment.yaml`:**
-   **`replicas`**: Defines the desired number of running instances (pods) of your application.
-   **`image`**: Specifies the path to your Docker image in a container registry.
-   **`ports.containerPort`**: Must match the port your application listens on inside the container (8000 as per our Dockerfile).
-   **`envFrom`**:
    -   `configMapRef`: For non-sensitive configuration (e.g., `LOG_LEVEL`).
    -   `secretRef`: For sensitive data like `SUPABASE_DATABASE_URL`, `OPENAI_API_KEY`.
-   **`resources`**: Defines CPU and memory requests (guaranteed) and limits (maximum allowed) for your containers. Crucial for stability and resource allocation.
-   **`livenessProbe`**: K8s uses this to know if a container is still running correctly. If it fails, K8s will restart the container. Our `/health` endpoint is suitable.
-   **`readinessProbe`**: K8s uses this to know if a container is ready to accept traffic. If it fails, the pod is not added to the service's load balancing pool. Our `/readiness` endpoint (which checks DB connectivity) is suitable.

### b. Service (`service.yaml` - Example)

A Service exposes your Deployment to the network. The type of service depends on how you want to access it.

**Example: LoadBalancer (for external access via cloud provider's load balancer)**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: realtime-agent-backend-svc
  labels:
    app: realtime-agent-backend
spec:
  type: LoadBalancer # Exposes the service externally using a cloud provider's load balancer.
                     # For internal-only access, consider ClusterIP.
                     # For more control over ingress, consider NodePort with an Ingress controller.
  selector:
    app: realtime-agent-backend # Must match the labels of your pods (from Deployment)
  ports:
  - protocol: TCP
    port: 80       # Port the service will be available on externally (e.g., via LoadBalancer IP)
    targetPort: 8000 # Port on the pods (containerPort)
```

**Key points for `Service.yaml`:**
-   **`type`**:
    -   `LoadBalancer`: Good for public cloud deployments to get an external IP.
    -   `ClusterIP`: Exposes the service only within the K8s cluster (e.g., if an Ingress controller or API Gateway like Supabase Edge Functions handles external traffic).
    -   `NodePort`: Exposes the service on a static port on each K8s node's IP.
-   **`selector`**: Connects the Service to your Deployment's pods.
-   **`ports`**: Defines how traffic is routed. `port` is the service's port, `targetPort` is the container's port.

## 3. Health and Readiness Endpoints

The FastAPI application (`backend/main.py`) should have these endpoints:

-   **`/health` (Liveness Probe):**
    -   A simple endpoint that returns an HTTP 200 OK if the application process is running.
    -   Example: `async def health_check(): return {"status": "ok"}`
-   **`/readiness` (Readiness Probe):**
    -   An endpoint that returns HTTP 200 OK if the application is ready to serve requests. This means it can connect to essential dependencies like the database.
    -   Example:
        ```python
        # async def readiness_check(db: Session = Depends(get_db)):
        #     try:
        #         db.execute(text("SELECT 1")) # Simple query to check DB
        #         return {"status": "ready", "dependencies": {"database": "ok"}}
        #     except Exception as e:
        #         raise HTTPException(status_code=503, detail={"status": "not_ready", "dependencies": {"database": "error"}})
        ```
These endpoints are crucial for Kubernetes to manage the application lifecycle effectively. They were added in `backend/main.py`.

## 4. Configuration Management

-   **ConfigMaps (`configmap.yaml` - Example):** For non-sensitive configuration like `LOG_LEVEL`.
    ```yaml
    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: backend-configmap
    data:
      LOG_LEVEL: "INFO" # Or "DEBUG" for more verbose logging in K8s
      # Add other non-sensitive environment variables here
    ```
-   **Secrets (`secret.yaml` - Example):** For sensitive data. Values should be base64 encoded.
    ```yaml
    apiVersion: v1
    kind: Secret
    metadata:
      name: backend-secrets
    type: Opaque
    data: # Values must be base64 encoded: echo -n 'your-value' | base64
      SUPABASE_DATABASE_URL: YOUR_BASE64_ENCODED_SUPABASE_DB_URL
      OPENAI_API_KEY: YOUR_BASE64_ENCODED_OPENAI_KEY
      # Note: EXPECTED_API_KEY is no longer used by the backend.
      # The Supabase Edge Function will have its own mechanism for secrets.
      MOCK_WEATHER_TOOL_API_KEY: YOUR_BASE64_ENCODED_MOCK_WEATHER_KEY # If used
    ```
    **Creating Secrets Imperatively (Recommended for actual secrets):**
    ```bash
    kubectl create secret generic backend-secrets \
      --from-literal=SUPABASE_DATABASE_URL='your-actual-db-url' \
      --from-literal=OPENAI_API_KEY='your-actual-openai-key' \
      --from-literal=MOCK_WEATHER_TOOL_API_KEY='test_weather_key'
    ```

## 5. Logging

-   The application is configured for structured JSON logging to `stdout` (see `backend/logging_config.py`).
-   Kubernetes typically collects logs from `stdout` and `stderr` of containers.
-   Use your cluster's logging solution (e.g., ELK stack, Loki, cloud provider's logging service like Google Cloud Logging, AWS CloudWatch Logs) to aggregate, search, and analyze these JSON logs.

## 6. Scaling

-   **Horizontal Pod Autoscaler (HPA):**
    -   To automatically scale the number of pods based on metrics like CPU utilization or custom metrics.
    -   Example HPA manifest (`hpa.yaml`):
      ```yaml
      apiVersion: autoscaling/v2
      kind: HorizontalPodAutoscaler
      metadata:
        name: realtime-agent-backend-hpa
      spec:
        scaleTargetRef:
          apiVersion: apps/v1
          kind: Deployment
          name: realtime-agent-backend # Name of your Deployment
        minReplicas: 2 # Minimum number of replicas
        maxReplicas: 10 # Maximum number of replicas
        metrics:
        - type: Resource
          resource:
            name: cpu
            target:
              type: Utilization
              averageUtilization: 80 # Target 80% CPU utilization
        # - type: Resource
        #   resource:
        #     name: memory
        #     target:
        #       type: Utilization
        #       averageUtilization: 80 # Target 80% memory utilization
      ```

## 7. Deployment Steps (Simplified)

1.  **Build and Push Docker Image:**
    ```bash
    # From the 'backend/' directory
    docker build -t YOUR_CONTAINER_REGISTRY/YOUR_IMAGE_NAME:YOUR_TAG .
    docker push YOUR_CONTAINER_REGISTRY/YOUR_IMAGE_NAME:YOUR_TAG
    ```
2.  **Create K8s Namespace (Optional but Recommended):**
    ```bash
    kubectl create namespace agent-backend
    ```
3.  **Apply Manifests:**
    ```bash
    kubectl apply -f configmap.yaml -n agent-backend
    kubectl apply -f secret.yaml -n agent-backend # Or use imperative creation for secrets
    kubectl apply -f deployment.yaml -n agent-backend
    kubectl apply -f service.yaml -n agent-backend
    kubectl apply -f hpa.yaml -n agent-backend # Optional
    ```
4.  **Verify Deployment:**
    ```bash
    kubectl get pods -n agent-backend
    kubectl get services -n agent-backend
    kubectl logs -f <pod-name> -n agent-backend # To view logs
    ```

## 8. Considerations for Supabase Edge Function

-   The Supabase Edge Function (`auth-gateway`) acts as the public entry point.
-   The `FASTAPI_ORIGIN_URL` environment variable for the Edge Function should point to the K8s Service URL for the backend (e.g., the LoadBalancer IP or internal K8s DNS name if the Edge Function can resolve it, like `http://realtime-agent-backend-svc.agent-backend.svc.cluster.local:80`).
-   Ensure network policies in K8s allow ingress traffic from the Supabase Edge Function's IP range(s) to your backend service.

This guide provides a starting point. Specific configurations will vary based on your K8s environment, cloud provider, and networking setup.
```
