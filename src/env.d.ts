/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ADSENSE_PUBLISHER_ID?: string;
  readonly PUBLIC_ADSENSE_SLOT_HOME_TOP?: string;
  readonly PUBLIC_ADSENSE_SLOT_HOME_MID?: string;
  readonly PUBLIC_ADSENSE_SLOT_ARTICLE_EARLY?: string;
  readonly PUBLIC_ADSENSE_SLOT_ARTICLE_MID?: string;
  readonly PUBLIC_ADSENSE_SLOT_ARTICLE_LATE?: string;
  readonly PUBLIC_ADSENSE_SLOT_SIDEBAR?: string;
  readonly PUBLIC_NEWSLETTER_ENDPOINT?: string;
  readonly PUBLIC_NEWSLETTER_FORMAT?: string;
  readonly PUBLIC_ANALYTICS?: string;
  readonly PUBLIC_PLAUSIBLE_DOMAIN?: string;
  readonly PUBLIC_PLAUSIBLE_SRC?: string;
  readonly PUBLIC_GA4_ID?: string;
  readonly PUBLIC_CONTACT_EMAIL?: string;
  readonly PUBLIC_CONTACT_ENDPOINT?: string;
  readonly PUBLIC_CMP_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
