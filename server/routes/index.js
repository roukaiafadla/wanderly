'use strict';

const api = {
  ...require('./public'),
  ...require('./adminAuth'),
  ...require('./adminStats'),
  ...require('./adminDestinations'),
  ...require('./adminTestimonials'),
  ...require('./adminLeads'),
  ...require('./adminImages')
};

// route matcher supporting one ":param" segment
function matchRoute(method, pathname) {
  for (const key of Object.keys(api)) {
    const [routeMethod, routePath] = key.split(' ');
    if (routeMethod !== method) continue;
    const routeParts = routePath.split('/');
    const pathParts = pathname.split('/');
    if (routeParts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      else if (routeParts[i] !== pathParts[i]) { ok = false; break; }
    }
    if (ok) return { handler: api[key], params };
  }
  return null;
}

module.exports = { matchRoute };
