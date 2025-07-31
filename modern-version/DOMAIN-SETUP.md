# Domain Setup Guide for NEPP.org

## Step 1: Purchase Domain
1. Go to a domain registrar (Google Domains, Namecheap, GoDaddy, etc.)
2. Purchase `nepp.org`

## Step 2: Configure Firebase Hosting
1. In Firebase Console, go to Hosting
2. Click "Add custom domain"
3. Enter `nepp.org`
4. Follow the verification steps (add TXT record to DNS)
5. Add the A records provided by Firebase to your domain's DNS settings

## Step 3: DNS Configuration
Add these records to your domain's DNS settings:

### Required Records:
```
Type: A
Name: @
Value: [Firebase will provide IP addresses]

Type: CNAME
Name: www
Value: nepp.org

Type: TXT
Name: @
Value: [Firebase verification code]
```

## Step 4: SSL Certificate
- Firebase automatically provisions SSL certificates for custom domains
- This may take up to 24 hours to complete

## Step 5: Update Environment Configuration
After domain is active, update the environment detection in `/config/environment.js`:

```javascript
export const currentEnvironment = window.location.hostname === 'nepp.org' || window.location.hostname === 'www.nepp.org'
  ? environments.production 
  : environments.development;
```

## Step 6: Test
1. Deploy to Firebase: `firebase deploy`
2. Wait for DNS propagation (up to 48 hours)
3. Test both `nepp.org` and `www.nepp.org`
