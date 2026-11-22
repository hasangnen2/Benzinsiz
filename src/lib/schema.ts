import { categories, slogan, siteName, absUrl, logoPath, contactEmail, countryName, locale } from './site';

export interface Crumb {
  name: string;
  href: string;
}

export function organizationNode() {
  const email = contactEmail();
  return {
    '@type': 'NewsMediaOrganization',
    '@id': `${absUrl('/')}#organization`,
    name: siteName,
    url: absUrl('/'),
    slogan,
    masthead: absUrl('/kunye'),
    publishingPrinciples: absUrl('/yayin-ilkeleri'),
    correctionsPolicy: absUrl('/duzeltme-politikasi'),
    logo: {
      '@type': 'ImageObject',
      url: absUrl(logoPath),
      width: 112,
      height: 112,
    },
    areaServed: {
      '@type': 'Country',
      name: countryName,
      sameAs: 'https://www.wikidata.org/wiki/Q43',
    },
    availableLanguage: locale,
    knowsAbout: categories.map((item) => item.name),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'editorial',
      url: absUrl('/iletisim'),
      ...(email ? { email } : {}),
    },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': `${absUrl('/')}#website`,
    name: siteName,
    url: absUrl('/'),
    inLanguage: locale,
    publisher: { '@id': `${absUrl('/')}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absUrl('/ara')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbNode(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absUrl(crumb.href),
    })),
  };
}

export function graph(nodes: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
