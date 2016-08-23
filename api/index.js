//Configure cookie and sessions
var
  bodyParser      = require('body-parser')
  ,Analytics      = require('./Analytics')
  ,Salesforce     = require('./Salesforce')
  ,Storage        = require('./Storage')
  ,APIError       = require('./Error/Error')
  ,APIErrorCodes  = require('./Error/ErrorCodes')
  ,express        = require('express')
;


// Expose a the app API
module.exports = function appApi(app, config){
  // This is a rough sample api
  app.logger.info('Configuring the API');

  // Add a reference to some essential API elements
  app.use((req,res,next)=>{
    req.APIError      = APIError;
    req.APIErrorCodes = APIErrorCodes;
    req.auth          = shared.authorize;
    req.logger        = app.logger;
    next();
  });

  // Configure analytics, this will expose req.analytics to any middleware
  // REVIEW: This is one way of configuring it, we could have done it here or a seperate module
  // REVIEW: Should it authorize when server starts? Depends on how we end up implementing it
  Analytics(app, config);

  //Configure storage and aws, this will expose storage and aws
  Storage(app, config);

  //Configure salesforce
  Salesforce(app, config);

  // Add a body parser
  // =============================
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({'extended': true}))
  // =============================

  // Add the cookie manager
  // Some endpoints might want to track actions between
  // requests without the frontend being smart about it
  // avoid this as much as possible to keep thing stateless
  // =============================
  var cookieParser = require('cookie-parser');
  app.use(cookieParser());
  // =============================


  // ========================================
  // Always cache all partners
  // ========================================
  var partnerEndpoint = require('./Partner');
  app.use(partnerEndpoint.all.cache);
  app.use(partnerEndpoint.all.current);

  var locationEndpoint = require('./Location');
  var industryEndpoint = require('./Industry');
  var investment_levelsEndpoint = require('./Investment_level');
  var pagesEndpoint = require('./Pages');


  // ========================================
  // Passport Endpoints + Configuration
  // ========================================
  var
    passport  = require('passport')
    ,identify = require('./Passport/identify')(config, app, passport)
  ;

  // Initialize passport
  app.use(passport.initialize())

  // Register /api/auth/* routes (facebook, google, linkedin)
  require('./Passport/local')(config, app, passport, identify)
  require('./Passport/facebook')(config, app, passport, identify)
  require('./Passport/google')(config, app, passport, identify)
  require('./Passport/linkedin')(config, app, passport, identify)

  // For local it is login endpoint, for others it is the identify callback
  // The identify callback/endpoint expects ?provider=<local,google,facebook,linkedin>[&start=</some/url#/for/view>]
  app.all(config.passport.indentifyUrl, identify);
  app.post(
    '/api/auth/claim'
    ,require('./authenticate')
    ,identify.claim
  )


  // ========================================
  // Language and Locale endpoint
  // ========================================
  // NOTE:
  // >> Language is being used as language/branding (should mainly only contain text) for a specific locale
  // >> Locale is for currency, date and maybe pluralization (counts)
  // -- For a few reasons the implementation is done with files, the server needs to restart to update these files (new deployment).
  // -- TODO: Use etag implementation to keep locale cached? This is important for performance
  // -- TODO: The implementation can be done through database, for each  partner (branding/partner/domain) and language (locale)
  // -- TODO: The req.params.locale is being ignored, but it should be taken into consideration to resolve the language_locale if possible, but only after resolving it through negotiation or negotiate at the frontend too (read other TODOs)
  // -- TODO: Eventually allow the user to override the locale through paramslocale, for now always using the partner locale, will need to default to partner.locale
  // -- TODO: Fix/improve the frontend implementation of app_modules/shared/locale
  // -- TODO: If there is an error finding the requested language, try finding the language with country, if it fails then use the baseLang
  // -- TODO: Negotiate the requested locale using https://www.npmjs.com/package/locale, it will need the frontend to by default allow the negotiation, and only if the user wants a different language then perform the change
  app.get(
    // TODO: Read above fore params.locale ... req.params.locale.toLowerCase();
    '/api/lang/:locale'
    ,(req,res,next)=>{
      delete require.cache[require.resolve('./Lang/base.json')]; // Only for dev environment (on server the language are bundled so a new deployment is needed)
      var
        fs               = require('fs')
        ,partnerLangFile = `${req.partner.domain}/${req.partner.locale}.json`
        ,filePath        = (typeof __webpack_require__ !== 'function'?'./api/':'')+`./Lang/${partnerLangFile}` // Ugly hack but no other nice way around it
        ,baseLang        = require('./Lang/base.json')
      ;
      // Lang had to be relative to the process running, otherwise once built the file would not be found.
      // This is a combination of prebundle and file existing detection to avoid require failing, it could have been done with readFile and JSON.parse
      // it would have been slightly less efficient like that
      fs.stat(filePath, (err,stats)=>{
        if(!err) {
          var objAssign = require('lodash/assign');
          delete require.cache[require.resolve('./Lang/'+partnerLangFile)]; // Only for dev environment (on server the language are bundled so a new deployment is needed)
          res.json(objAssign({},baseLang,require('./Lang/'+partnerLangFile))); // Using this pattern so webpack can include it
        } else {
          res.json(baseLang);
        }
      });
    }
  )
  app.get(
    // TODO: Read above fore params.locale ... req.params.locale.toLowerCase();
    '/api/locale/:locale'
    ,(req,res,next)=>{
      var locale = (req.partner.locale||"").toLowerCase(); // toLowerCase due to angular-i18n
      if(locale)
        res.sendFile(require('./Locale/angular')(locale)); // Using this pattern so webpack can ignore all locales by using ./Lang/angular as external in the build
      else
        res.end();
    }
  )


  // ========================================
  // Token Endpoints
  // ========================================
  app.get(
    '/api/token',
    require('./authenticate'),
    require('./Token/get.token')
  )

  // ========================================
  // Analytics Endpoints
  // ========================================
  app.post(
    '/api/analytics/query',
    require('./Analytics/post.query')
  )
  app.get(
    '/api/analytics/token',
    require('./Analytics/get.token')
  )

  // ========================================
  // Storage Endpoints
  // ========================================
  app.post(
    '/api/storage/',
    require('./Storage/post.store')
  )

  app.get(
    '/api/storage/*?',
    require('./Storage/get.resizer')
  )

  // ========================================
  // Email test endpoint TODO: add authentication or remove test endpoint
  // ========================================
  app.get(
    '/api/email/test/:to?',
    require('./Email/get.test')
  )

  // ========================================
  // SMS test endpoint TODO: add authentication or remove test endpoint
  // ========================================
  app.get(
    '/api/sms/test/:phone?/:message?',
    require('./Sms/get.test')
  )

  // ========================================
  // Options Endpoints (data to be used for API calls)
  // and search with filter option endpoints.
  // ========================================
  app.route('/api/option/franchise/search')
  .get(require('./Option/get.franchise.search'))
  .post(require('./Option/post.franchise.search'))

  app.route('/api/option/franchise/industry')
  .get(require('./Option/get.industry'))

  app.route('/api/option/franchise/levels')
  .get(require('./Option/get.investment_level'))

  app.route('/api/option/franchise/location')
  .get(require('./Option/get.location'))

  app.get(
    '/api/option/franchise/:id',
    require('./Option/get.franchise')
  )

  app.delete(
    '/api/option/franchise/:id',
    require('./authenticate'),
    require('./Option/delete.franchise_request')
  )

  app.get(
    '/api/categories-search',
    require('./Category/get.category_search')
  )
  // ========================================
  // Users
  // ========================================
  // TODO: Define convention for params in this api
  app.param('user_id',require('./User/all.user').user_id);
  app.route('/api/user/:user_id?')
  .all(
    require('./authenticate')
    ,require('./User/all.user')
  ) // TODO: Maybe move authenticate to the app.param middleware
  .get(require('./User/get.user'))
  .patch(require('./User/patch.user'))
  .post(require('./User/post.users'))
  .delete(require('./User/delete.user'))
  // Creating a user uses the same API as the self registration
  .post((req,res,next)=>{
    req.query.provider='local';
    identify(req, res, next);
  })

  //check for user by email
  app.route('/api/useremail/:id')
  .get(require('./User/get.email'))

  // ========================================
  // Users password reset and email confirmation
  // ========================================
  var SendToken = require('./Reset/post.sendtoken');
  app.post(
    '/api/sendtoken/:user_id?',
    function(req, res, next){
      SendToken(req, res, next, config);
    });


  var SendMail =  require('./Reset/post.newpass');
  app.post(
    '/api/newpass/:user_id?',
    function(req, res, next){
      SendMail(req, res, next, config);
    });

  app.get(
    '/api/confirm/:token?',
    require('./Reset/get.confirm')
  )

  app.get(
    '/api/confirmpass/:token?',
    require('./Reset/get.confirmpass')
  )

  var SendEmail = require('./Contact/post.contact');
  app.post(
    '/api/contactus',
    function(req, res, next){
      SendEmail(req, res, next, config);
    });

  var SendAdRequest = require('./Contact/post.request');
  app.post(
    '/api/advertiseus',
    function(req, res, next){
      SendAdRequest(req, res, next, config);
    });


  app.get(
    '/api/newsletter/users/:csv?',
    //require('./authenticate'),
    require('./Newsletter/get.users')
  )
  app.post(
    '/api/newsletter/users',
    //require('./authenticate'),
    require('./Newsletter/post.users')
  )

  // ========================================
  // Reports
  // ========================================

  app.get('/api/reports',
    require('./Report/get.reports')
  )
  app.post('/api/reports',
    require('./authenticate'),
    require('./Report/post.reports')
  )
  app.post(
    '/api/reports/edit/:report_id',
    require('./Report/put.report')
  )
  app.post(
    '/api/reports/run/:report_id',
    require('./Report/run.report')
  )

  app.post(
    '/api/reports/lead',
    require('./Report/post.lead')
  )

  app.post(
    '/api/reports/lead_csv',
    require('./Report/post.lead_csv')
  )

  app.patch(
    '/api/reports/lead/:id',
    require('./Report/put.lead')
  )

  app.get(
    '/api/reports/franchisee/:email',
    require('./Report/get.franchisee_user')
  )

  app.get(
    '/api/reports/pdf',
    require('./authenticate'),
    require('./franchise.authenticate'),
    require('./Report/get.pdf')
  )
  app.post(
    '/api/reports/dashboard/',
    require('./authenticate'),
    require('./franchise.authenticate'),
    require('./Report/post.dashboard')
  )
  app.post(
    '/api/reports/franchisor_dashboard/',
    require('./authenticate'),
    require('./franchise.authenticate'),
    require('./Report/post.franchisor_dashboard')
  )
  app.get(
    '/api/reports/registrations/:csv?',
    //require('./authenticate'),
    require('./Report/get.registrations')
  )
  app.get(
    '/api/reports/visitors/:csv?',
    //require('./authenticate'),
    require('./Report/get.visitors')
  )
  app.get(
    '/api/reports/leads/:csv?',
    // require('./authenticate'),
    require('./Report/get.leads')
  )
  app.get(
    '/api/reports/franchises/:csv',
    require('./authenticate'),
    require('./Report/get.franchises')
  )
  app.get(
    '/api/reports/locations/:csv',
    require('./authenticate'),
    require('./Report/get.locations')
  )
  app.get(
    '/api/reports/industries/:csv',
    require('./authenticate'),
    require('./Report/get.industries')
  )
  app.get(
    '/api/reports/investment_levels/:csv',
    require('./authenticate'),
    require('./Report/get.investment_levels')
  )
  app.get(
    '/api/reports/pages/:csv',
    require('./authenticate'),
    require('./Report/get.pages')
  )
  app.get(
    '/api/reports/users/:csv',
    require('./authenticate'),
    require('./Report/get.users')
  )
  app.post(
    '/api/reports/leads',
    require('./authenticate'),
    require('./franchise.authenticate'),
    require('./Report/post.leads')
  )
  app.get(
      '/api/franchise/featured',
    //require('./authenticate'),
    require('./Franchise/get.featured')
  )
  app.get(
      '/api/franchise_types',
    require('./Franchise/get.types')
  )
  app.get(
      '/api/franchise/top',
    //require('./authenticate'),
    require('./Franchise/get.top')
  )
  app.get(
    '/api/franchise/users',
    require('./authenticate'),
    require('./Franchise/get.users.all')
  )
  app.post(
    '/api/franchise/users_by_store',
    require('./authenticate'),
    require('./Franchise/post.users')
  )

  app
    .route('/api/franchise-request')
    .all(require('./authenticate'))
    .post(
      require('./Franchise/post.request')
    )
    .get(require('./Franchise/get.request'))


  // ========================================
  // Partners
  // ========================================
  // TODO: Define convention for params in this api
  app.param('partner_id',partnerEndpoint.all.partner_id);
  app.route('/api/partner/:partner_id?')
  .all(
    require('./authenticate')
    ,partnerEndpoint.all
  ) // TODO: Maybe move authenticate to the app.param middleware
  .get(partnerEndpoint.get)
  .patch(partnerEndpoint.patch)
  .delete(partnerEndpoint.delete)
  .post(partnerEndpoint.post)

  // ========================================
  // Location
  // ========================================
  app.param('location_id',locationEndpoint.all.location_id);
  app.route('/api/location/:location_id?')
  .all(
    require('./authenticate')
    ,locationEndpoint.all
  )
  .get(locationEndpoint.get)
  .patch(locationEndpoint.patch)
  .delete(locationEndpoint.delete)
  .post(locationEndpoint.post)


  // ========================================
  // Industry
  // ========================================
  app.param('industry_id',industryEndpoint.all.industry_id);
  app.route('/api/industry/:industry_id?')
  .all(
    require('./authenticate')
    ,industryEndpoint.all
  )
  .get(industryEndpoint.get)
  .patch(industryEndpoint.patch)
  .delete(industryEndpoint.delete)
  .post(industryEndpoint.post)

  // ========================================
  // Investment_levels
  // ========================================
  app.param('investment_level',investment_levelsEndpoint.all.investment_level_id);
  app.route('/api/investment_level/:investment_level_id?')
  .all(
    require('./authenticate')
    ,investment_levelsEndpoint.all
  )
  .get(investment_levelsEndpoint.get)
  .patch(investment_levelsEndpoint.patch)
  .delete(investment_levelsEndpoint.delete)
  .post(investment_levelsEndpoint.post)

  // ========================================
  // Pages
  // ========================================

  app.route('/api/pages/experts')
  .get(pagesEndpoint.experts.get);

  app.param('resource_id',pagesEndpoint.all.resource_id);
  app.route('/api/pages/:resource_id?')
  .all(
    pagesEndpoint.all
  )
  .get(pagesEndpoint.get)
  .patch(pagesEndpoint.patch)
  .delete(pagesEndpoint.delete)
  .post(pagesEndpoint.post)

  // ========================================
  // Franchise Endpoints
  // ========================================

  var franchiseRoute = '/api/franchise/:franchise_id?'
  app.param('franchise_id',require('./Franchise/all.franchise').franchise_id);
  app.route(franchiseRoute.replace(/franchise/,'franchise-public'))
    .get(require('./Franchise/get.franchise')(true))
  app.route(franchiseRoute)
  .all(
    require('./authenticate')
    ,require('./Franchise/all.franchise')
  ) // TODO: Maybe move authenticate to the app.param middleware
  .patch(require('./Franchise/patch.franchise'))
  .delete(require('./Franchise/delete.franchise'))
  .post(require('./Franchise/post.franchise'))
  .get(require('./Franchise/get.franchise')(false))



  // ========================================
  // Franchise Template Startpoints
  // ========================================
  app.use('/uploadImage', express.static('publish/data/'));

  app.post(
    '/api/publish/saveTemplate',
    require('./authenticate'),
    require('./Publish/post.template')
  )

  app.get(
    '/api/publish/getTemplate',
    require('./Publish/get.template')
  )
  app.post(
    '/api/publish/uploadImage',
    require('./authenticate'),
    require('./Publish/post.image')
  )

  // ========================================
  // Image Table Startpoints
  // ========================================
  app.route('/api/image/:image_id?')
  .get(require('./Image/get.image'))
  .post(
    require('./authenticate'),
    require('./Image/post.image')
  )

  // ========================================
  // Salesforce routes
  // ========================================
  app
  .get('/api/oauth2/salesforce',
    require('./Salesforce/get.authorize')
  )
  .get("/api/oauth2/salesforce_callback",
    require('./Salesforce/get.authorization_callback')
  )
}
