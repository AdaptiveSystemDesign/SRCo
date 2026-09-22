// PUBLIC configuration only. Populate after AWS setup; do NOT put credentials here.
// The page fails closed while any entry is blank.
window.SRCO_PORTAL_CONFIG = Object.freeze({
  domain: '',       // e.g. https://YOURPREFIX.auth.us-east-1.amazoncognito.com
  clientId: '',     // Cognito public app client ID (not a secret)
  apiUrl: '',       // e.g. https://YOURAPI.execute-api.us-east-1.amazonaws.com
  redirectUri: ''   // exact HTTPS portal origin + /, registered in Cognito
});
