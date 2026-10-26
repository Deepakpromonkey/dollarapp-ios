/*
| Pages on the DollarTraq website the app links to.
|
| Opened in an in-app browser tab (utils/openExternalLink), so they are kept
| here rather than in the screens: a URL that changes changes in one place.
*/
export const LINKS = {
    privacy: "https://www.dollartraq.com/privacy-policy",
    support: "https://www.dollartraq.com/contact",
} as const;

export type LinkName = keyof typeof LINKS;
