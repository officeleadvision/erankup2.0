interface ApiCallOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  isFormData?: boolean;
  body?: Record<string, unknown> | BodyInit | null;
  responseType?: "json" | "text" | "blob";
}

const isBodyInit = (body: unknown): body is BodyInit =>
  typeof body === "string" ||
  body instanceof Blob ||
  body instanceof ArrayBuffer ||
  ArrayBuffer.isView(body) ||
  body instanceof FormData ||
  body instanceof URLSearchParams ||
  (typeof ReadableStream !== "undefined" && body instanceof ReadableStream);

async function apiClient<T>(
  endpoint: string,
  options: ApiCallOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  let finalBody: BodyInit | null | undefined = undefined;
  const { body, token, isFormData, responseType, ...restOptions } = options;

  if (token) {
    headers.append("Authorization", `Bearer ${token}`);
  }

  if (body) {
    if (isFormData || isBodyInit(body)) {
      finalBody = body as BodyInit;
    } else {
      if (!headers.has("Content-Type")) {
        headers.append("Content-Type", "application/json");
      }
      finalBody = JSON.stringify(body);
    }
  }

  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
  };
  if (typeof finalBody !== "undefined") {
    fetchOptions.body = finalBody;
  }

  const response = await fetch(`/api${endpoint}`, fetchOptions);

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = (await response.json()) as {
        message?: string;
        error?: string;
      };
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === "blob") {
    return (await response.blob()) as T;
  }

  if (responseType === "text") {
    return (await response.text()) as T;
  }

  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export default apiClient;
