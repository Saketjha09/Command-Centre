import { AdminGridResponse } from "../types/availabilityTypes";
import { AvailabilityRecord, SlotInput, WeekAvailability } from "../types/availability";

import { BASE_URL } from './config';
const API_BASE_URL = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

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

/**
 * Fetches the availability records for a specific freelancer and flattens the nested response.
 * @param userID The ID of the freelancer
 * @param days Number of days to look ahead (max 30)
 */
export async function getFreelancerAvailability(
  userID: string,
  days: number
): Promise<AvailabilityRecord[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/availability/${userID}?days=${days}`,
    { method: 'GET', credentials: 'include' }
  );

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: Failed to fetch availability`);
  }

  const data = await response.json() as WeekAvailability;
  // Flatten nested days[].slots[] into a single array
  return data.days.flatMap(day => day.slots);
}

/**
 * Saves all 3 slots for a specific day for a freelancer.
 * @param userID The ID of the freelancer
 * @param date The date to save (YYYY-MM-DD)
 * @param slots Array of slot inputs
 */
export async function saveDay(
  userID: string,
  date: string,
  slots: SlotInput[]
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/availability/${userID}/${date}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slots }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: Failed to save availability for ${date}`);
  }
}
