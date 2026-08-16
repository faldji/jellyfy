import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
