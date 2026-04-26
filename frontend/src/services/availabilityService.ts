import { AdminGridResponse } from "../types/availabilityTypes";

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
const API_BASE_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

export async function getAdminGrid(): Promise<AdminGridResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/availability/grid`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    // Include status code for the hook to handle/display
    throw new Error(`API Error ${response.status}: Failed to fetch availability grid`);
  }

  return response.json() as Promise<AdminGridResponse>;
}
