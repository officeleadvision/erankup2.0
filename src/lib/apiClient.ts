interface ApiCallOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  isFormData?: boolean;
  body?: Record<string, any> | BodyInit | null;
  responseType?: "json" | "text" | "blob";
}

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
    if (isFormData) {
      finalBody = body as FormData;
    } else if (
      typeof body === "object" &&
      !(body instanceof Blob) &&
      !(body instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(body) &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams) &&
      typeof (body as any).pipe !== "function"
    ) {
      if (!headers.has("Content-Type")) {
        headers.append("Content-Type", "application/json");
      }
      finalBody = JSON.stringify(body);
    } else {
      finalBody = body as BodyInit;
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
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      /* Ignore */
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type");

  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === "blob") {
    return response.blob() as Promise<T>;
  }

  if (responseType === "text") {
    return response.text() as Promise<T>;
  }

  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  if (
    contentType &&
    (contentType.includes("text/csv") || contentType.includes("text/plain"))
  ) {
    return response.text() as Promise<T>;
  }

  if (!contentType || !contentType.includes("application/json")) {
    return response.text() as Promise<T>;
  }

  return response.json();
}

export default apiClient;
