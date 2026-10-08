import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { sectionForPath } from './navigation';

export const onRequest = defineRouteMiddleware(({ locals, url }) => {
  const section = sectionForPath(url.pathname);
  const route = locals.starlightRoute;
  // Starlight derives pagination from the full configuration before middleware.
  // Keep automatic previous/next links inside the current documentation area.
  for (const direction of ['prev', 'next'] as const) {
    const link = route.pagination[direction];
    if (link && sectionForPath(link.href)?.id !== section?.id) {
      route.pagination[direction] = undefined;
    }
  }
});
