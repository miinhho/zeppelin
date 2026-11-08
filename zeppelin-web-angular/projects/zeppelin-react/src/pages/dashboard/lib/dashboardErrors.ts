/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const dashboardRequestError = (error: unknown, fallback: string): string => {
  if (typeof error === 'string' && error) return error;
  if (!error || typeof error !== 'object') return fallback;

  const response = error as { status?: number; message?: unknown; error?: { message?: unknown } | string };
  const message = typeof response.error === 'string' ? response.error : response.error?.message;

  if (typeof message === 'string' && message) return message;
  if (typeof response.message === 'string' && response.message) return response.message;
  if (response.status === 401 || response.status === 403) return 'You do not have access to this document.';
  if (response.status === 404) return 'Document not found.';

  return fallback;
};
