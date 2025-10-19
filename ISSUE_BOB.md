# Issue BOB - Already Added Service Detection Not Working

## Problem
When user sarah@soluisrael.org visits a shared service link (http://localhost:3001/service/code/K7ZJ) for a service she has already added to her account, the page still shows the green "Add to My Services" button instead of showing the text "Added to my services".

## Expected Behavior
- If user has already added the service (it appears in their services list), the page should show:
  - A text message (NOT a button): "Added to my services"
  - No "Add to My Services" button

## Current Behavior
- The page always shows the "Add to My Services" button
- Even though sarah@soluisrael.org has the service in her account

## Root Cause
The `/api/services/code/:code` endpoint was not using authentication middleware, so `req.user` was never set even for authenticated users. This prevented the backend from detecting if a user already owns or has shared access to the service.

## Changes Made (Not Yet Verified)

### server/routes/services.js
- Line 3: Added `authenticateOptional` to imports
- Line 22: Applied `authenticateOptional` middleware to `/code/:code` route

```javascript
// Before:
router.get('/code/:code', getServiceByCode);

// After:
router.get('/code/:code', authenticateOptional, getServiceByCode);
```

### server/controllers/serviceController.js
- Lines 187-203: Added debug logging to track authentication and already-added detection

```javascript
// Check if authenticated user already has this service
if (req.user) {
  console.log('User authenticated:', req.user.id, req.user.email);
  const isOwner = service.created_by === req.user.id;
  const sharedService = await SharedService.findOne({
    where: {
      service_id: service.id,
      user_id: req.user.id
    }
  });
  serviceData.alreadyAdded = isOwner || !!sharedService;
  serviceData.isOwner = isOwner;
  console.log('Already added check:', { isOwner, hasSharedService: !!sharedService, alreadyAdded: serviceData.alreadyAdded });
} else {
  console.log('No authenticated user - guest access');
  serviceData.alreadyAdded = false;
  serviceData.isOwner = false;
}
```

### client/src/pages/GuestServiceView.jsx
- Lines 160-175: Conditional rendering already implemented

```javascript
{serviceDetails.alreadyAdded ? (
  <div className="already-added-section">
    <div className="already-added-notice">
      ✓ {serviceDetails.isOwner ? 'You own this service' : 'Added to your services'}
    </div>
  </div>
) : (
  <div className="add-service-section">
    <button
      className="btn-add-service"
      onClick={handleAddToMyServices}
    >
      {isAuthenticated ? 'Add to My Services' : 'Login to Add to Your Services'}
    </button>
  </div>
)}
```

## Status
- Changes made but not yet verified due to server restart issues
- Server needs to be manually restarted to pick up the changes
- Debug logging added to help diagnose the issue

## Next Steps to Fix
1. Restart the server manually:
   ```bash
   netstat -ano | findstr :5002
   taskkill /F /PID <PID>
   cd server && npm start
   ```

2. Test with sarah@soluisrael.org:
   - Login as sarah@soluisrael.org
   - Visit http://localhost:3001/service/code/K7ZJ
   - Should see "✓ Added to your services" instead of button

3. Check server logs for debug output:
   - Should see "User authenticated: <id> <email>"
   - Should see "Already added check: { isOwner, hasSharedService, alreadyAdded }"

## Additional Investigation Needed
If the fix doesn't work after server restart:
- Verify that the authentication token is being sent with the request
- Check browser console for any errors
- Verify that SharedService table has the correct record
- Check if the serviceDetails.alreadyAdded flag is being received by the frontend
