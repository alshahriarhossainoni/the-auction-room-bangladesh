# TAR SEO Foundation v4

Built on TAR Institutional Quant v3.1 COT Fix. All original scripts, existing content and authentication assets retained.

## Deployment
Upload the full ZIP contents into the GitHub Pages repository root. Keep CNAME, all JS/CSS and quantflow folder. Confirm that https://theauctionroombd.com/sitemap.xml and /robots.txt return successfully.

## Google Search Console
1. Open https://search.google.com/search-console and add theauctionroombd.com as a Domain property (DNS TXT verification) or URL prefix (HTML file/meta tag verification).
2. Submit sitemap URL: https://theauctionroombd.com/sitemap.xml.
3. Inspect the homepage, courses.html, cot.html, and four learn/ pages; request indexing as appropriate.
4. Monitor Performance, indexing coverage, and Core Web Vitals. Search appearance and ranking are not guaranteed.

## Notes
- New educational guide content is a starting point: review for accuracy and add real examples, authored insights and citations.
- Private/login pages use noindex as a discovery hint, NOT an access control. Supabase access rules must still protect private data.
- Existing COT data sync was not modified.
- No fabricated reviews, ratings, certificates, or ranking claims are included.
- Sitemap only lists public content pages; other site paths remain accessible.
- Google indexing and live site behavior have not been verified.
